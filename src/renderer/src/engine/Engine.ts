import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js'
import { createPost, postKey, type PostChain } from './post'
import { shaderStack } from '../state/shaders'
import { prefsStore } from '../state/prefs'
import type { CameraView, EnvironmentSettings, SceneObject, Transform, Vec3 } from '@shared/types'
import { useStore } from '../state/store'
import { meshCache } from '../state/importer'
import { buildMesh, GROUPS, type MeshGroup, type MeshResult } from '../core/mesher'
import { atlas } from '../state/atlas'
import type { VoxelModel } from '../core/formats'
import { createSkyMaterial, createSkyMesh, patchHeightFog } from './sky'
import { buildProcedural } from './procedural'
import { WeatherSystem } from './weather'

const DEG = Math.PI / 180
const ORTHO_H = 50

export type StandardView = 'front' | 'side' | 'top' | 'iso' | 'threeQuarter' | 'perspective'

interface Entry {
  obj: SceneObject
  root: THREE.Object3D
  key: string
  tick?: (t: number) => void
}

type BuildGeo = Record<(typeof GROUPS)[number], THREE.BufferGeometry | null>

export interface StillOptions {
  width: number
  height: number
  samples: number
  view: CameraView | null
  isolateId?: string
  transparent: boolean
  /** con fondo transparente: recortar márgenes vacíos (por defecto sí) */
  trim?: boolean
  onProgress?: (f: number, label: string) => void
  cancelled?: () => boolean
}

function toGeometry(g: MeshGroup): THREE.BufferGeometry | null {
  if (!g.indices.length) return null
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(g.positions, 3))
  geo.setAttribute('normal', new THREE.BufferAttribute(g.normals, 3, true))
  geo.setAttribute('color', new THREE.BufferAttribute(g.colors, 4, true))
  geo.setAttribute('uv', new THREE.BufferAttribute(g.uvs, 2))
  geo.setIndex(new THREE.BufferAttribute(g.indices, 1))
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

const smooth = (a: number, b: number, x: number): number => THREE.MathUtils.smoothstep(x, a, b)

export class Engine {
  readonly renderer: THREE.WebGLRenderer
  readonly scene = new THREE.Scene()
  readonly persp = new THREE.PerspectiveCamera(45, 1, 0.1, 5000)
  readonly ortho = new THREE.OrthographicCamera(-ORTHO_H, ORTHO_H, ORTHO_H, -ORTHO_H, -2000, 4000)
  camera: THREE.PerspectiveCamera | THREE.OrthographicCamera = this.persp
  readonly controls: OrbitControls
  readonly tcontrols: TransformControls
  private tHelper: THREE.Object3D
  private sun = new THREE.DirectionalLight(0xffffff, 2.5)
  private hemi = new THREE.HemisphereLight(0xbcd4ff, 0x4a3f33, 0.9)
  private skyMat = createSkyMaterial()
  private sky: THREE.Mesh
  private envScene = new THREE.Scene()
  private weather = new WeatherSystem()
  private grid: THREE.GridHelper
  private selBox = new THREE.BoxHelper(new THREE.Object3D(), 0xffc94d)
  private entries = new Map<string, Entry>()
  private geoCache = new Map<string, BuildGeo>()
  private meshVersion = new Map<string, number>()
  private atlasTex = Engine.makeAtlasTexture()
  private matOpaque = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85, metalness: 0 })
  private matCutout = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0, alphaTest: 0.5, side: THREE.DoubleSide })
  private matTrans = new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, depthWrite: false, roughness: 0.1, metalness: 0, side: THREE.DoubleSide })
  private matEmissive = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false, alphaTest: 0.5, side: THREE.DoubleSide })
  private matPlaceholder = new THREE.MeshBasicMaterial({ color: 0x5aa9ff, wireframe: true })
  private matError = new THREE.MeshBasicMaterial({ color: 0xff5a5a, wireframe: true })
  private post: PostChain | null = null
  /** suelo invisible que solo recibe sombras (modo estudio) */
  private floor = new THREE.Mesh(new THREE.PlaneGeometry(4000, 4000).rotateX(-Math.PI / 2), new THREE.ShadowMaterial({ opacity: 0.55, transparent: true }))
  private pmrem: THREE.PMREMGenerator
  private envRT: THREE.WebGLRenderTarget | null = null
  private envTimer: number | null = null
  private ro: ResizeObserver
  private raf = 0
  private last = performance.now()
  private elapsed = 0
  private unsub: (() => void)[] = []
  private anim: { p0: THREE.Vector3; p1: THREE.Vector3; t0: THREE.Vector3; t1: THREE.Vector3; z0: number; z1: number; k: number } | null = null
  private cycleTime: number | null = null
  private down = { x: 0, y: 0, t: 0 }
  private fpsFrames = 0
  private fpsT = 0
  stats = { fps: 0, triangles: 0, calls: 0 }
  private width = 1
  private height = 1
  private rendering = false

  constructor(private container: HTMLElement) {
    patchHeightFog()
    this.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' })
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping
    this.renderer.outputColorSpace = THREE.SRGBColorSpace
    this.renderer.shadowMap.enabled = true
    this.renderer.info.autoReset = false // con postprocesado se cuentan todos los pases del fotograma
    this.renderer.shadowMap.type = THREE.PCFShadowMap
    container.appendChild(this.renderer.domElement)
    this.renderer.domElement.tabIndex = 0
    this.pmrem = new THREE.PMREMGenerator(this.renderer)

    this.persp.position.set(40, 30, 40)
    this.ortho.position.copy(this.persp.position)
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.12
    this.controls.screenSpacePanning = true
    this.controls.maxPolarAngle = Math.PI * 0.495
    this.controls.target.set(0, 4, 0)

    this.tcontrols = new TransformControls(this.camera, this.renderer.domElement)
    this.tHelper = this.tcontrols.getHelper()
    this.tHelper.name = '__tcontrols'
    this.scene.add(this.tHelper)
    this.tcontrols.addEventListener('dragging-changed', (e) => {
      this.controls.enabled = !(e as unknown as { value: boolean }).value
    })
    this.tcontrols.addEventListener('mouseUp', () => this.commitTransform())
    this.applyPrefs()
    this.unsub.push(prefsStore.subscribe(() => this.applyPrefs()))

    this.sun.castShadow = true
    this.sun.shadow.bias = -0.0005
    this.sun.shadow.normalBias = 0.04
    this.scene.add(this.sun, this.sun.target, this.hemi)
    this.sky = createSkyMesh(this.skyMat)
    this.scene.add(this.sky)
    this.envScene.add(createSkyMesh(this.skyMat))
    this.scene.add(this.weather.group)
    this.grid = new THREE.GridHelper(200, 200, 0x3a4150, 0x2a2f39)
    ;(this.grid.material as THREE.Material).transparent = true
    ;(this.grid.material as THREE.Material).opacity = 0.35
    this.grid.position.y = -0.01
    this.grid.name = '__grid'
    this.scene.add(this.grid)
    this.selBox.visible = false
    this.selBox.name = '__sel'
    this.floor.receiveShadow = true
    this.floor.visible = false
    this.floor.name = '__floor'
    this.floor.renderOrder = -1
    this.scene.add(this.floor)
    this.scene.add(this.selBox)

    this.ro = new ResizeObserver(() => this.resize())
    this.ro.observe(container)
    this.resize()

    const el = this.renderer.domElement
    el.addEventListener('pointerdown', (e) => {
      this.down = { x: e.clientX, y: e.clientY, t: performance.now() }
      this.anim = null
    })
    el.addEventListener('pointerup', (e) => this.onClick(e))

    this.unsub.push(shaderStack.subscribe(() => this.syncPost()))
    this.unsub.push(atlas.subscribe(() => {
      const old = this.atlasTex
      this.atlasTex = Engine.makeAtlasTexture()
      this.applyEnv()
      old.dispose()
      this.syncObjects()
    }))
    this.unsub.push(meshCache.subscribe((id) => {
      this.meshVersion.set(id, (this.meshVersion.get(id) ?? 0) + 1)
      const old = this.geoCache.get(id)
      this.geoCache.delete(id)
      this.syncObjects()
      if (old) for (const g of Object.values(old)) g?.dispose()
    }))
    this.unsub.push(
      useStore.subscribe((s, prev) => {
        if (s.project.objects !== prev.project.objects || s.project.layers !== prev.project.layers || s.project.assets !== prev.project.assets || s.assetStatus !== prev.assetStatus)
          this.syncObjects()
        if (s.project.environment !== prev.project.environment) this.applyEnv()
        if (s.selectedId !== prev.selectedId) this.updateSelection()
        if (s.transformMode !== prev.transformMode) this.tcontrols.setMode(s.transformMode)
        if (s.sunCycle !== prev.sunCycle) {
          if (s.sunCycle) this.cycleTime = s.project.environment.timeOfDay
          else if (this.cycleTime != null) {
            const t = this.cycleTime
            this.cycleTime = null
            s.setEnv({ timeOfDay: Math.round(t * 10) / 10 })
          }
        }
      })
    )
    this.syncObjects()
    this.applyEnv()
    this.updateSelection()
    this.loop()
  }

  dispose(): void {
    cancelAnimationFrame(this.raf)
    this.unsub.forEach((u) => u())
    this.ro.disconnect()
    this.tcontrols.dispose()
    this.controls.dispose()
    if (this.envTimer) clearTimeout(this.envTimer)
    this.post?.dispose()
    this.envRT?.dispose()
    this.pmrem.dispose()
    this.atlasTex.dispose()
    this.renderer.dispose()
    this.renderer.domElement.remove()
  }

  // ------------------------------------------------------------------ tamaño y cámaras
  private resize(): void {
    const w = Math.max(1, this.container.clientWidth)
    const h = Math.max(1, this.container.clientHeight)
    this.width = w
    this.height = h
    const preset = useStore.getState().project.environment.quality.preset
    const dpr = window.devicePixelRatio || 1
    this.renderer.setPixelRatio(preset === 'low' ? 1 : preset === 'medium' ? Math.min(dpr, 1.5) : Math.min(dpr, 2))
    this.renderer.setSize(w, h)
    this.persp.aspect = w / h
    this.persp.updateProjectionMatrix()
    const a = w / h
    this.ortho.left = -ORTHO_H * a
    this.ortho.right = ORTHO_H * a
    this.ortho.top = ORTHO_H
    this.ortho.bottom = -ORTHO_H
    this.ortho.updateProjectionMatrix()
    this.post?.setSize(w, h)
  }

  private useCamera(ortho: boolean): void {
    const next = ortho ? this.ortho : this.persp
    if (next === this.camera) return
    next.position.copy(this.camera.position)
    next.quaternion.copy(this.camera.quaternion)
    this.camera = next
    this.controls.object = next
    this.tcontrols.camera = next
    this.rebuildComposer()
  }

  get isOrtho(): boolean {
    return this.camera === this.ortho
  }

  toggleProjection(): void {
    const target = this.controls.target
    const dist = this.camera.position.distanceTo(target)
    if (this.isOrtho) {
      this.useCamera(false)
    } else {
      this.ortho.zoom = ORTHO_H / (dist * Math.tan((this.persp.fov * DEG) / 2))
      this.ortho.updateProjectionMatrix()
      this.useCamera(true)
    }
  }

  /** Caja que contiene las construcciones visibles (o el objeto seleccionado). */
  sceneBounds(onlySelected = false): THREE.Box3 {
    const box = new THREE.Box3()
    const sel = useStore.getState().selectedId
    for (const [id, e] of this.entries) {
      if (!e.root.visible) continue
      if (onlySelected ? id !== sel : !['build', 'base', 'tree', 'rock', 'decor'].includes(e.obj.kind)) continue
      box.expandByObject(e.root)
    }
    if (box.isEmpty()) box.set(new THREE.Vector3(-10, 0, -10), new THREE.Vector3(10, 10, 10))
    return box
  }

  setStandardView(v: StandardView, onlySelected = false): void {
    const box = this.sceneBounds(onlySelected)
    const center = box.getCenter(new THREE.Vector3())
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 4)
    const dirs: Record<StandardView, Vec3> = {
      front: [0, 0.0001, 1],
      side: [1, 0.0001, 0],
      top: [0, 1, 0.0001],
      iso: [1, Math.SQRT2 * 0.57735 * Math.SQRT2, 1],
      threeQuarter: [1, 0.62, 1],
      perspective: [0.55, 0.45, 1]
    }
    const ortho = v === 'front' || v === 'side' || v === 'top' || v === 'iso'
    const dir = new THREE.Vector3(...dirs[v]).normalize()
    const dist = (radius / Math.sin((this.persp.fov * DEG) / 2)) * 1.05
    this.useCamera(ortho)
    const zoom = ortho ? ORTHO_H / (radius * 1.15) : 1
    this.animateTo(center.clone().addScaledVector(dir, dist), center, zoom)
  }

  frameSelection(): void {
    const box = this.sceneBounds(!!useStore.getState().selectedId)
    const center = box.getCenter(new THREE.Vector3())
    const radius = Math.max(box.getSize(new THREE.Vector3()).length() / 2, 2)
    const dir = this.camera.position.clone().sub(this.controls.target).normalize()
    const dist = (radius / Math.sin((this.persp.fov * DEG) / 2)) * 1.05
    this.animateTo(center.clone().addScaledVector(dir, dist), center, this.isOrtho ? ORTHO_H / (radius * 1.15) : this.camera.zoom)
  }

  private animateTo(pos: THREE.Vector3, target: THREE.Vector3, zoom: number): void {
    this.anim = {
      p0: this.camera.position.clone(), p1: pos.clone(),
      t0: this.controls.target.clone(), t1: target.clone(),
      z0: this.camera.zoom, z1: zoom, k: 0
    }
  }

  currentView(name: string, id: string): CameraView {
    return {
      id, name,
      position: this.camera.position.toArray() as Vec3,
      target: this.controls.target.toArray() as Vec3,
      fov: this.persp.fov,
      ortho: this.isOrtho,
      zoom: this.camera.zoom
    }
  }

  applyView(v: CameraView, animate = true): void {
    this.useCamera(v.ortho)
    this.persp.fov = v.fov
    this.persp.updateProjectionMatrix()
    const p = new THREE.Vector3(...v.position), t = new THREE.Vector3(...v.target)
    if (animate) this.animateTo(p, t, v.zoom)
    else {
      this.camera.position.copy(p)
      this.controls.target.copy(t)
      this.camera.zoom = v.zoom
      this.camera.updateProjectionMatrix()
    }
  }

  setFov(fov: number): void {
    this.persp.fov = fov
    this.persp.updateProjectionMatrix()
  }

  // ------------------------------------------------------------------ objetos
  private buildGeo(assetId: string): BuildGeo | null {
    const cached = this.geoCache.get(assetId)
    if (cached) return cached
    const m = meshCache.get(assetId)
    if (!m) return null
    const g = Object.fromEntries(GROUPS.map((k) => [k, toGeometry(m[k])])) as BuildGeo
    this.geoCache.set(assetId, g)
    return g
  }

  private createRoot(o: SceneObject): { root: THREE.Object3D; tick?: (t: number) => void } {
    if (o.kind === 'build') {
      const root = new THREE.Group()
      const geo = o.assetId ? this.buildGeo(o.assetId) : null
      if (geo) {
        root.add(this.meshesFor(geo))
      } else {
        // marcador mientras se genera la malla (o si falló): caja con las dimensiones REALES del archivo
        const st = useStore.getState()
        const a = o.assetId ? st.project.assets[o.assetId] : undefined
        const status = o.assetId ? st.assetStatus[o.assetId] : undefined
        const w = a?.info.width ?? 4, h = a?.info.height ?? 4, l = a?.info.length ?? 4
        const box = new THREE.Mesh(new THREE.BoxGeometry(w, h, l), status?.state === 'error' ? this.matError : this.matPlaceholder)
        box.position.set(w / 2 - Math.floor(w / 2), h / 2, l / 2 - Math.floor(l / 2))
        box.userData.editorOnly = true
        root.add(box)
      }
      return { root }
    }
    return buildProcedural(o, (model) => this.meshVoxels(model))
  }

  /** Objeto 3D con los cuatro grupos de geometría y sus materiales compartidos. */
  private meshesFor(geo: BuildGeo): THREE.Group {
    const g = new THREE.Group()
    const mats = { opaque: this.matOpaque, cutout: this.matCutout, transparent: this.matTrans, emissive: this.matEmissive }
    for (const k of GROUPS) {
      const gg = geo[k]
      if (!gg) continue
      const m = new THREE.Mesh(gg, mats[k])
      m.castShadow = k === 'opaque' || k === 'cutout'
      m.receiveShadow = k !== 'emissive'
      if (k === 'transparent') m.renderOrder = 1
      g.add(m)
    }
    return g
  }

  private meshVoxels(model: VoxelModel): THREE.Object3D {
    const env = useStore.getState().project.environment
    const r: MeshResult = buildMesh(model, { vertexAO: env.material.vertexAO, colorVariation: env.material.colorVariation, atlas: atlas.get().info, center: false })
    const geo = Object.fromEntries(GROUPS.map((k) => [k, toGeometry(r[k])])) as BuildGeo
    return this.meshesFor(geo)
  }

  static makeAtlasTexture(): THREE.CanvasTexture {
    const t = new THREE.CanvasTexture(atlas.get().canvas)
    t.magFilter = THREE.NearestFilter
    // mipmaps: sin ellos, un bloque lejano (menos píxeles que texels) toma un texel al azar por píxel y el
    // render sale granulado. Las teselas son potencias de 2 alineadas, así que los niveles hasta 1 texel por
    // tesela no mezclan texturas vecinas; dentro de cada nivel se muestrea sin interpolar (aspecto pixelado).
    t.minFilter = THREE.NearestMipmapLinearFilter
    t.generateMipmaps = true
    t.colorSpace = THREE.SRGBColorSpace
    return t
  }

  private keyFor(o: SceneObject): string {
    if (o.kind === 'build') {
      const st = useStore.getState()
      return `${o.assetId}:${this.meshVersion.get(o.assetId ?? '') ?? 0}:${st.assetStatus[o.assetId ?? '']?.state ?? ''}`
    }
    const m = useStore.getState().project.environment.material
    return `${JSON.stringify(o.params)}|${atlas.get().version}|${m.vertexAO}|${m.colorVariation}`
  }

  private applyTransform(root: THREE.Object3D, t: Transform): void {
    root.position.set(...t.position)
    root.rotation.set(t.rotation[0] * DEG, t.rotation[1] * DEG, t.rotation[2] * DEG)
    root.scale.set(...t.scale)
  }

  private syncObjects(): void {
    const { project } = useStore.getState()
    const layerVis = new Map(project.layers.map((l) => [l.id, l.visible]))
    const seen = new Set<string>()
    for (const o of project.objects) {
      seen.add(o.id)
      let e = this.entries.get(o.id)
      const key = this.keyFor(o)
      if (!e || e.key !== key) {
        if (e) this.disposeRoot(e.root)
        const { root, tick } = this.createRoot(o)
        root.userData.objectId = o.id
        root.traverse((c) => (c.userData.objectId = o.id))
        this.scene.add(root)
        e = { obj: o, root, key, tick }
        this.entries.set(o.id, e)
      }
      e.obj = o
      if (!this.tcontrols.dragging || this.tcontrols.object !== e.root) this.applyTransform(e.root, o.transform)
      e.root.visible = o.visible && (layerVis.get(o.layerId) ?? true)
    }
    for (const [id, e] of this.entries) {
      if (seen.has(id)) continue
      this.disposeRoot(e.root)
      this.entries.delete(id)
    }
    this.syncVisibility()
    this.updateSelection()
    this.fitShadowCamera()
  }

  private disposeRoot(root: THREE.Object3D): void {
    if (this.tcontrols.object === root) this.tcontrols.detach()
    this.scene.remove(root)
    const shared = new Set<unknown>([this.matOpaque, this.matCutout, this.matTrans, this.matEmissive, this.matPlaceholder, this.matError])
    const sharedGeo = new Set<unknown>()
    for (const g of this.geoCache.values()) for (const x of Object.values(g)) if (x) sharedGeo.add(x)
    root.traverse((c) => {
      const m = c as THREE.Mesh
      if (m.isMesh) {
        if (!sharedGeo.has(m.geometry)) m.geometry.dispose()
        const mats = Array.isArray(m.material) ? m.material : [m.material]
        for (const mt of mats) if (!shared.has(mt)) mt.dispose()
      }
      if ((c as THREE.Light).isLight) (c as THREE.Light).dispose()
    })
  }

  private updateSelection(): void {
    const id = useStore.getState().selectedId
    const e = id ? this.entries.get(id) : undefined
    if (e && e.root.visible) {
      if (this.tcontrols.object !== e.root) this.tcontrols.attach(e.root)
      this.selBox.setFromObject(e.root)
      this.selBox.visible = true
    } else {
      this.tcontrols.detach()
      this.selBox.visible = false
    }
  }

  private commitTransform(): void {
    const id = useStore.getState().selectedId
    const e = id ? this.entries.get(id) : undefined
    if (!e) return
    const r = e.root
    const round = (v: number, k = 1000): number => Math.round(v * k) / k
    const t: Transform = {
      position: [round(r.position.x), round(r.position.y), round(r.position.z)],
      rotation: [round(r.rotation.x / DEG, 10), round(r.rotation.y / DEG, 10), round(r.rotation.z / DEG, 10)],
      scale: [round(r.scale.x), round(r.scale.y), round(r.scale.z)]
    }
    useStore.getState().setTransform(e.obj.id, t, true)
  }

  private onClick(e: PointerEvent): void {
    if (e.button !== 0) return
    if (Math.hypot(e.clientX - this.down.x, e.clientY - this.down.y) > 4) return
    if (this.tcontrols.dragging || (this.tcontrols as unknown as { axis: string | null }).axis) return
    const rect = this.renderer.domElement.getBoundingClientRect()
    const ndc = new THREE.Vector2(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1)
    const ray = new THREE.Raycaster()
    ray.setFromCamera(ndc, this.camera)
    const roots = [...this.entries.values()].filter((x) => x.root.visible).map((x) => x.root)
    const hits = ray.intersectObjects(roots, true)
    const hit = hits.find((h) => h.object.userData.objectId)
    const st = useStore.getState()
    // el terreno y la vegetación no roban la selección a menos que se hagan clic directamente sin nada más
    st.select(hit ? (hit.object.userData.objectId as string) : null)
  }

  // ------------------------------------------------------------------ ambiente
  private sunDirection(env: EnvironmentSettings, t: number): { dir: THREE.Vector3; elevSin: number } {
    const elev = Math.sin(((t - 6) / 12) * Math.PI) * 62 * DEG
    const az = (env.sunAzimuth + (t - 12) * 12) * DEG
    const dir = new THREE.Vector3(Math.cos(elev) * Math.sin(az), Math.sin(elev), Math.cos(elev) * Math.cos(az))
    return { dir, elevSin: Math.sin(elev) }
  }

  private applyEnv(timeOverride?: number): void {
    const env = useStore.getState().project.environment
    const t = timeOverride ?? this.cycleTime ?? env.timeOfDay
    const { dir, elevSin } = this.sunDirection(env, t)
    const day = smooth(-0.12, 0.18, elevSin)
    const sunset = day * (1 - smooth(0.05, 0.42, elevSin))
    const wI = env.weather === 'clear' ? 0 : env.weatherIntensity
    const wDim = 1 - (env.weather === 'rain' ? 0.65 : env.weather === 'snow' ? 0.4 : 0) * wI
    const night = elevSin < 0
    const lightDir = night ? new THREE.Vector3(-dir.x, Math.max(0.35, -dir.y), -dir.z).normalize() : dir
    const sunCol = new THREE.Color(env.sunColor).lerp(new THREE.Color(1, 0.5, 0.25), sunset * 0.75)
    this.sun.color.copy(night ? new THREE.Color(0.55, 0.65, 1) : sunCol)
    this.sun.intensity = night ? 0.35 * (1 - day) * wDim : env.sunIntensity * day * wDim
    const target = this.controls.target
    this.sun.target.position.copy(target)
    this.sun.position.copy(target).addScaledVector(lightDir, 200)
    this.sun.castShadow = env.shadows
    const ms = env.quality.preset === 'high' ? 4096 : env.quality.preset === 'medium' ? 2048 : 1024
    if (this.sun.shadow.mapSize.x !== ms) {
      this.sun.shadow.mapSize.set(ms, ms)
      this.sun.shadow.map?.dispose()
      ;(this.sun.shadow as { map: unknown }).map = null
    }
    this.sun.shadow.radius = 1 + env.shadowSoftness * 7
    this.sun.shadow.blurSamples = 8 + Math.round(env.shadowSoftness * 16)

    const amb = new THREE.Color(env.ambientColor)
    this.hemi.color.copy(amb).multiplyScalar(0.12 + 0.88 * day)
    this.hemi.groundColor.copy(amb).lerp(new THREE.Color('#5a4a38'), 0.7).multiplyScalar(0.1 + 0.6 * day)
    this.hemi.intensity = env.ambientIntensity

    const gray = new THREE.Color('#8b939c')
    const zenith = new THREE.Color(env.skyTint).multiplyScalar(0.03 + 0.97 * day).lerp(new THREE.Color('#05070d'), 1 - day).lerp(gray.clone().multiplyScalar(day * 0.8), wI * 0.7)
    const horizon = new THREE.Color('#cfe0f2').lerp(new THREE.Color('#ffae70'), sunset).multiplyScalar(0.06 + 0.94 * day).lerp(new THREE.Color('#0d1220'), 1 - day).lerp(gray.clone().multiplyScalar(0.2 + day * 0.8), wI * 0.6)
    const u = this.skyMat.uniforms
    u.uSunDir.value.copy(dir)
    u.uSunColor.value.copy(sunCol).multiplyScalar(day * wDim)
    u.uZenith.value.copy(zenith)
    u.uHorizon.value.copy(horizon)
    u.uGround.value.copy(horizon).multiplyScalar(0.45)
    u.uDay.value = day
    u.uSunset.value = sunset
    u.uClouds.value = env.clouds.enabled ? 1 : 0
    u.uCloudStyle.value = env.clouds.style === 'volumetric' ? 0 : 1
    u.uDensity.value = env.weather === 'clear' ? env.clouds.density : Math.max(env.clouds.density, 0.55 + 0.35 * wI)
    u.uScale.value = Math.max(0.2, env.clouds.scale)
    u.uDetail.value = Math.max(1, Math.min(6, Math.round(env.clouds.detail)))
    u.uCloudH.value = env.clouds.height
    u.uSteps.value = env.quality.preset === 'high' ? 44 : env.quality.preset === 'medium' ? 26 : 14
    u.uWeatherDark.value = wI * (env.weather === 'rain' ? 1 : 0.5)

    const fogCol = new THREE.Color(env.fog.color).multiplyScalar(0.07 + 0.93 * day).lerp(horizon, 0.35)
    if (env.weather !== 'clear') fogCol.lerp(gray.clone().multiplyScalar(0.15 + 0.7 * day), wI * 0.6)
    u.uFogColor.value.copy(fogCol)
    const fogDensity = env.fog.enabled ? env.fog.density * 0.006 + wI * 0.004 : wI * 0.004
    u.uFogAmt.value = env.fog.enabled ? Math.min(0.9, env.fog.density * 0.9 + 0.08) : 0.06
    if (fogDensity > 0) {
      if (!(this.scene.fog instanceof THREE.Fog)) this.scene.fog = new THREE.Fog(fogCol, 0, 1)
      const f = this.scene.fog as THREE.Fog
      f.color.copy(fogCol)
      f.near = fogDensity
      f.far = env.fog.enabled ? env.fog.height : 40
    } else this.scene.fog = null

    const studio = env.background.mode === 'studio'
    u.uStudio.value = studio ? 1 : 0
    u.uBg1.value.set(env.background.color1)
    u.uBg2.value.set(env.background.color2)
    u.uSpecks.value = env.background.specks
    if (studio) {
      this.scene.fog = null
      u.uClouds.value = 0
    }
    this.floor.visible = studio && env.background.floorShadow
    ;(this.floor.material as THREE.ShadowMaterial).opacity = env.background.shadowOpacity

    this.renderer.toneMappingExposure = env.exposure
    const style = env.material.style
    this.matOpaque.roughness = style === 'matte' ? 1 : style === 'soft' ? 0.82 : 0.38
    this.matOpaque.metalness = style === 'glossy' ? 0.05 : 0
    this.matOpaque.envMapIntensity = env.quality.reflections ? (style === 'glossy' ? 1 : 0.6) : 0.25
    this.matTrans.envMapIntensity = env.quality.reflections ? 1.2 : 0.3
    this.matCutout.roughness = this.matOpaque.roughness
    const map = env.material.pixelTexture ? this.atlasTex : null
    for (const m of [this.matOpaque, this.matCutout, this.matTrans, this.matEmissive]) {
      if (m.map !== map) {
        m.map = map
        m.needsUpdate = true
      }
    }
    this.weather.set(studio ? 'clear' : env.weather, env.weatherIntensity)
    this.syncPost()
    if (timeOverride !== undefined) return // ciclo solar: solo luz y cielo, nada más por fotograma
    this.syncVisibility()
    this.scheduleEnvMap()
    // la resolución interna solo cambia con la calidad del visor
    if (env.quality.preset !== this.lastPreset) {
      this.lastPreset = env.quality.preset
      this.resize()
    }
    // la AO por vértice y la variación de color se calculan al generar la malla de los elementos procedurales
    const matKey = `${env.material.vertexAO}|${env.material.colorVariation}`
    if (matKey !== this.lastMatKey) {
      const first = this.lastMatKey === ''
      this.lastMatKey = matKey
      if (!first) this.syncObjects()
    }
  }
  private lastPreset = ''
  private lastMatKey = ''

  private scheduleEnvMap(): void {
    if (this.envTimer) clearTimeout(this.envTimer)
    this.envTimer = window.setTimeout(() => {
      this.envTimer = null
      const env = useStore.getState().project.environment
      if (!env.quality.reflections) {
        this.scene.environment = null
        return
      }
      const rt = this.pmrem.fromScene(this.envScene, 0, 0.1, 1000)
      this.envRT?.dispose()
      this.envRT = rt
      this.scene.environment = rt.texture
    }, 250)
  }

  private fitShadowCamera(): void {
    const box = this.sceneBounds()
    const c = box.getCenter(new THREE.Vector3())
    const r = Math.min(Math.max(box.getSize(new THREE.Vector3()).length() / 2 + 12, 25), 260)
    const cam = this.sun.shadow.camera
    cam.left = -r
    cam.right = r
    cam.top = r
    cam.bottom = -r
    cam.near = 1
    cam.far = 600
    cam.updateProjectionMatrix()
    this.sunAnchor.copy(c)
    this.floor.position.y = box.isEmpty() ? 0 : box.min.y - 0.002
  }
  private sunAnchor = new THREE.Vector3()

  /** Controles de cámara y del gizmo según las preferencias. */
  private applyPrefs(): void {
    const p = prefsStore.get()
    const c = this.controls
    c.rotateSpeed = p.orbitSpeed
    c.zoomSpeed = p.zoomSpeed * (p.invertZoom ? -1 : 1)
    c.panSpeed = p.panSpeed
    c.enableDamping = p.smoothCamera
    const NONE = -1 as unknown as THREE.MOUSE
    if (p.mouse === 'blender') c.mouseButtons = { LEFT: NONE, MIDDLE: THREE.MOUSE.ROTATE, RIGHT: NONE }
    else if (p.mouse === 'touchpad') c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    else c.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    const DEG2 = Math.PI / 180
    this.tcontrols.setTranslationSnap(p.snapMove > 0 ? p.snapMove : null)
    this.tcontrols.setRotationSnap(p.snapRotate > 0 ? p.snapRotate * DEG2 : null)
    this.tcontrols.setScaleSnap(p.snapScale > 0 ? p.snapScale : null)
    this.tcontrols.setSize(p.gizmoSize)
  }

  /** Reconstruye la cadena si cambió su estructura; si no, solo actualiza valores. */
  private syncPost(): void {
    const env = useStore.getState().project.environment
    const sh = shaderStack.active()
    if (!this.post || this.post.key !== postKey(env, sh)) this.rebuildComposer()
    else this.post.update(env, 0, sh)
  }

  private rebuildComposer(): void {
    this.post?.dispose()
    this.post = createPost(this.renderer, this.scene, this.camera, this.width, this.height, useStore.getState().project.environment, undefined, shaderStack.active(), () => this.atlasTex)
  }

  /** En modo estudio con "ocultar entorno", el terreno, el agua, los caminos y la vegetación no se ven. */
  private syncVisibility(): void {
    const { project } = useStore.getState()
    const bg = project.environment.background
    const hideEnv = bg.mode === 'studio' && bg.hideEnvironment
    const layerVis = new Map(project.layers.map((l) => [l.id, l.visible]))
    for (const e of this.entries.values()) {
      const envKind = e.obj.kind === 'terrain' || e.obj.kind === 'water' || e.obj.kind === 'vegetation' || e.obj.kind === 'path'
      e.root.visible = e.obj.visible && (layerVis.get(e.obj.layerId) ?? true) && !(hideEnv && envKind)
    }
    this.grid.visible = bg.mode !== 'studio' && ![...this.entries.values()].some((e) => e.obj.kind === 'terrain' && e.root.visible)
  }

  // ------------------------------------------------------------------ bucle
  private loop = (): void => {
    this.raf = requestAnimationFrame(this.loop)
    if (this.rendering || !this.container.clientWidth) return
    const now = performance.now()
    const dt = Math.min((now - this.last) / 1000, 0.1)
    this.last = now
    this.elapsed += dt
    const st = useStore.getState()
    if (this.anim) {
      const a = this.anim
      a.k = Math.min(1, a.k + dt / 0.45)
      const e = 1 - Math.pow(1 - a.k, 3)
      this.camera.position.lerpVectors(a.p0, a.p1, e)
      this.controls.target.lerpVectors(a.t0, a.t1, e)
      this.camera.zoom = a.z0 + (a.z1 - a.z0) * e
      this.camera.updateProjectionMatrix()
      if (a.k >= 1) this.anim = null
    }
    if (st.turntable.playing) {
      const off = this.camera.position.clone().sub(this.controls.target)
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), dt * st.turntable.speed)
      this.camera.position.copy(this.controls.target).add(off)
    }
    if (this.cycleTime != null) {
      this.cycleTime = (this.cycleTime + dt * 1.2) % 24
      this.applyEnv(this.cycleTime)
    }
    this.controls.update()
    // la luz sigue al centro de la escena para que el mapa de sombras cubra las construcciones
    const env = st.project.environment
    const { dir, elevSin } = this.sunDirection(env, this.cycleTime ?? env.timeOfDay)
    const lightDir = elevSin < 0 ? new THREE.Vector3(-dir.x, Math.max(0.35, -dir.y), -dir.z).normalize() : dir
    this.sun.target.position.copy(this.sunAnchor)
    this.sun.position.copy(this.sunAnchor).addScaledVector(lightDir, 200)
    this.skyMat.uniforms.uTime.value = this.elapsed * env.clouds.speed * 10
    this.weather.update(this.elapsed, this.controls.target)
    for (const e of this.entries.values()) e.tick?.(this.elapsed)
    if (this.selBox.visible) {
      const id = st.selectedId
      const e = id ? this.entries.get(id) : undefined
      if (e) this.selBox.setFromObject(e.root)
    }
    this.renderer.info.reset()
    this.post?.setTime(this.elapsed)
    if (this.post) this.post.composer.render(dt)
    else this.renderer.render(this.scene, this.camera)
    this.fpsFrames++
    this.fpsT += dt
    if (this.fpsT >= 1) {
      this.stats = { fps: Math.round(this.fpsFrames / this.fpsT), triangles: this.renderer.info.render.triangles, calls: this.renderer.info.render.calls }
      this.fpsFrames = 0
      this.fpsT = 0
    }
  }

  // ------------------------------------------------------------------ render final
  static gpuLimits(): { maxSize: number; maxViewport: [number, number] } {
    const c = document.createElement('canvas')
    const gl = c.getContext('webgl2')
    if (!gl) return { maxSize: 4096, maxViewport: [4096, 4096] }
    const r = { maxSize: gl.getParameter(gl.MAX_RENDERBUFFER_SIZE) as number, maxViewport: Array.from(gl.getParameter(gl.MAX_VIEWPORT_DIMS) as Int32Array) as [number, number] }
    gl.getExtension('WEBGL_lose_context')?.loseContext()
    return r
  }

  async renderStill(o: StillOptions): Promise<HTMLCanvasElement> {
    const { width: W, height: H } = o
    const lim = Engine.gpuLimits()
    const maxSide = Math.min(lim.maxSize, lim.maxViewport[0], lim.maxViewport[1], 8192)
    if (W > maxSide || H > maxSide) throw new Error(`La GPU de este equipo admite como máximo ${maxSide} px por lado; se pidieron ${W}×${H}.`)
    if (W < 16 || H < 16) throw new Error('El tamaño mínimo de render es 16×16 px.')
    const samples = Math.max(1, Math.min(64, Math.round(o.samples)))
    const env = useStore.getState().project.environment
    this.rendering = true
    const off = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false, powerPreference: 'high-performance' })
    const hidden: THREE.Object3D[] = []
    const prevFog = this.scene.fog
    const prevEnv = this.scene.environment
    const prevMap = this.sun.shadow.mapSize.x
    let offPmrem: THREE.PMREMGenerator | null = null
    let offEnv: THREE.WebGLRenderTarget | null = null
    try {
      off.setPixelRatio(1)
      off.setSize(W, H, false)
      const gl = off.getContext()
      if (gl.drawingBufferWidth !== W || gl.drawingBufferHeight !== H)
        throw new Error(`La GPU no pudo reservar un lienzo de ${W}×${H} (obtuvo ${gl.drawingBufferWidth}×${gl.drawingBufferHeight}). Prueba con un tamaño menor.`)
      off.toneMapping = this.renderer.toneMapping
      off.toneMappingExposure = this.renderer.toneMappingExposure
      off.outputColorSpace = THREE.SRGBColorSpace
      off.shadowMap.enabled = true
      off.shadowMap.type = THREE.PCFShadowMap
      off.setClearColor(0x000000, 0)

      // ocultar ayudas del editor
      const hide = (obj: THREE.Object3D): void => {
        if (obj.visible) {
          obj.visible = false
          hidden.push(obj)
        }
      }
      hide(this.grid)
      hide(this.selBox)
      hide(this.tHelper)
      this.scene.traverse((c) => c.userData.editorOnly && hide(c))
      if (o.isolateId) for (const [id, e] of this.entries) if (id !== o.isolateId) hide(e.root)
      if (o.transparent) {
        hide(this.sky)
        hide(this.weather.group)
        this.scene.fog = null
      }
      // sombras de alta resolución para el render final
      if (prevMap < 4096) {
        this.sun.shadow.mapSize.set(4096, 4096)
        this.sun.shadow.map?.dispose()
        ;(this.sun.shadow as { map: unknown }).map = null
      }
      // el mapa de entorno debe generarse en el contexto del renderer de salida
      if (env.quality.reflections) {
        offPmrem = new THREE.PMREMGenerator(off)
        offEnv = offPmrem.fromScene(this.envScene, 0, 0.1, 1000)
        this.scene.environment = offEnv.texture
      }

      // cámara
      const isOrtho = o.view ? o.view.ortho : this.isOrtho
      const cam = isOrtho ? new THREE.OrthographicCamera(-ORTHO_H * (W / H), ORTHO_H * (W / H), ORTHO_H, -ORTHO_H, -2000, 4000) : new THREE.PerspectiveCamera(this.persp.fov, W / H, 0.1, 5000)
      const target = new THREE.Vector3()
      if (o.view) {
        cam.position.set(...o.view.position)
        target.set(...o.view.target)
        cam.zoom = o.view.zoom
        if (!isOrtho) (cam as THREE.PerspectiveCamera).fov = o.view.fov
      } else if (o.isolateId) {
        const e = this.entries.get(o.isolateId)
        const box = new THREE.Box3().setFromObject(e?.root ?? new THREE.Object3D())
        const c = box.getCenter(new THREE.Vector3())
        const size = box.getSize(new THREE.Vector3())
        const radius = Math.max(size.length() / 2, 1)
        const fov = (cam as THREE.PerspectiveCamera).fov ?? 45
        const fit = W >= H ? 1 : H / W
        const dist = ((radius * fit) / Math.sin((fov * DEG) / 2)) * 1.02
        target.copy(c)
        cam.position.copy(c).addScaledVector(new THREE.Vector3(1, 0.62, 1).normalize(), dist)
        if (isOrtho) cam.zoom = ORTHO_H / (radius * 1.05 * fit)
      } else {
        cam.position.copy(this.camera.position)
        target.copy(this.controls.target)
        cam.zoom = this.camera.zoom
      }
      cam.lookAt(target)
      cam.updateProjectionMatrix()
      cam.updateMatrixWorld()

      // misma cadena de postproceso que el visor (GTAO, bloom, gradación, viñeta, grano)
      const post = createPost(off, this.scene, cam, W, H, env, 1, shaderStack.active(), () => this.atlasTex)
      post.update(env, 17, shaderStack.active())
      post.setTime(this.elapsed)

      const acc = new Uint16Array(W * H * 4)
      const buf = new Uint8Array(W * H * 4)
      const basePos = this.sun.position.clone()
      const softR = env.shadowSoftness * 6
      for (let i = 0; i < samples; i++) {
        if (o.cancelled?.()) throw new Error('Render cancelado por el usuario.')
        o.onProgress?.(i / samples, i === 0 ? 'Compilando shaders y calculando sombras' : `Muestra ${i + 1} de ${samples}`)
        await new Promise((r) => setTimeout(r, 0))
        // jitter subpíxel (antialiasing) y del sol (sombras suaves)
        const jx = samples > 1 ? (halton(i + 1, 2) - 0.5) : 0
        const jy = samples > 1 ? (halton(i + 1, 3) - 0.5) : 0
        cam.setViewOffset(W, H, jx, jy, W, H)
        if (samples > 1 && env.shadows) {
          const a = halton(i + 1, 5) * Math.PI * 2, rr = Math.sqrt(halton(i + 1, 7)) * softR
          this.sun.position.copy(basePos).add(new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr))
        }
        post.composer.render()
        gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, buf)
        for (let k = 0; k < buf.length; k++) acc[k] += buf[k]
      }
      this.sun.position.copy(basePos)
      o.onProgress?.(1, 'Componiendo imagen')
      const out = document.createElement('canvas')
      out.width = W
      out.height = H
      const ctx = out.getContext('2d')!
      const img = ctx.createImageData(W, H)
      const d = img.data
      for (let y = 0; y < H; y++) {
        const src = (H - 1 - y) * W * 4, dst = y * W * 4
        for (let x = 0; x < W * 4; x += 4) {
          const a = acc[src + x + 3] / samples
          let r = acc[src + x] / samples, g = acc[src + x + 1] / samples, b = acc[src + x + 2] / samples
          if (o.transparent && a > 0 && a < 255) {
            const f = 255 / a
            r *= f
            g *= f
            b *= f
          }
          d[dst + x] = r
          d[dst + x + 1] = g
          d[dst + x + 2] = b
          d[dst + x + 3] = o.transparent ? a : 255
        }
      }
      ctx.putImageData(img, 0, 0)
      post.dispose()
      return o.transparent && o.trim !== false ? trimTransparent(out, d, W, H) : out
    } finally {
      for (const h of hidden) h.visible = true
      this.scene.fog = prevFog
      this.scene.environment = prevEnv
      offEnv?.dispose()
      offPmrem?.dispose()
      if (this.sun.shadow.mapSize.x !== prevMap) {
        this.sun.shadow.mapSize.set(prevMap, prevMap)
        this.sun.shadow.map?.dispose()
        ;(this.sun.shadow as { map: unknown }).map = null
      }
      off.dispose()
      off.forceContextLoss()
      this.rendering = false
      this.last = performance.now()
    }
  }
}

/** Recorta los márgenes totalmente transparentes (con un pequeño margen), conservando la sombra del suelo. */
function trimTransparent(src: HTMLCanvasElement, d: Uint8ClampedArray, W: number, H: number): HTMLCanvasElement {
  let x0 = W, y0 = H, x1 = -1, y1 = -1
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++)
      if (d[(y * W + x) * 4 + 3] > 6) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
  if (x1 < 0) return src
  const pad = Math.round(Math.max(x1 - x0, y1 - y0) * 0.04)
  x0 = Math.max(0, x0 - pad)
  y0 = Math.max(0, y0 - pad)
  x1 = Math.min(W - 1, x1 + pad)
  y1 = Math.min(H - 1, y1 + pad)
  const out = document.createElement('canvas')
  out.width = x1 - x0 + 1
  out.height = y1 - y0 + 1
  out.getContext('2d')!.drawImage(src, x0, y0, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

function halton(i: number, b: number): number {
  let f = 1, r = 0
  while (i > 0) {
    f /= b
    r += f * (i % b)
    i = Math.floor(i / b)
  }
  return r
}

let instance: Engine | null = null
export const setEngine = (e: Engine | null): void => {
  instance = e
}
export const getEngine = (): Engine | null => instance
