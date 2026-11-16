// Shaders GLSL externos: pasadas de postprocesado escritas por el usuario.
// Interfaz disponible en el shader (todas opcionales):
//   uniform sampler2D tDiffuse;   imagen de la escena (HDR lineal en @stage hdr, sRGB en @stage ldr)
//   uniform sampler2D tDepth;     profundidad (0..1) — requiere la anotación // @depth
//   uniform vec2 uResolution;     tamaño en píxeles
//   uniform float uTime;          segundos
//   uniform float uNear, uFar;    planos de la cámara (para linealizar la profundidad)
//   varying vec2 vUv;
// Anotaciones: // @name, // @description, // @stage hdr|ldr, // @depth, // @param nombre defecto min max Etiqueta
import * as THREE from 'three'
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js'
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js'

export interface ShaderParam {
  name: string
  def: number
  min: number
  max: number
  label: string
}
export interface ShaderMeta {
  name: string
  description: string
  stage: 'hdr' | 'ldr'
  depth: boolean
  params: ShaderParam[]
}
export interface ActiveShader {
  file: string
  source: string
  meta: ShaderMeta
  values: Record<string, number>
}

export function parseShaderMeta(source: string, fallback: string): ShaderMeta {
  const meta: ShaderMeta = { name: fallback.replace(/\.(glsl|frag|fs)$/i, ''), description: '', stage: 'ldr', depth: false, params: [] }
  for (const line of source.split('\n')) {
    const m = /^\s*\/\/\s*@(\w+)\s*(.*)$/.exec(line)
    if (!m) continue
    const [, key, rest] = m
    if (key === 'name' && rest.trim()) meta.name = rest.trim()
    else if (key === 'description') meta.description = rest.trim()
    else if (key === 'stage') meta.stage = rest.trim() === 'hdr' ? 'hdr' : 'ldr'
    else if (key === 'depth') meta.depth = true
    else if (key === 'param') {
      const p = rest.trim().split(/\s+/)
      const [name, d, mn, mx] = p
      const def = parseFloat(d), min = parseFloat(mn), max = parseFloat(mx)
      if (name && /^[A-Za-z_]\w*$/.test(name) && [def, min, max].every(Number.isFinite))
        meta.params.push({ name, def, min, max, label: p.slice(4).join(' ') || name })
    }
  }
  return meta
}

const VERT = /* glsl */ `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`

function makeMaterial(sh: ActiveShader, shared: SharedUniforms): THREE.ShaderMaterial {
  const uniforms: Record<string, THREE.IUniform> = {
    tDiffuse: { value: null },
    tDepth: shared.tDepth,
    uResolution: shared.uResolution,
    uTime: shared.uTime,
    uNear: shared.uNear,
    uFar: shared.uFar
  }
  for (const p of sh.meta.params) uniforms[p.name] = { value: sh.values[p.name] ?? p.def }
  return new THREE.ShaderMaterial({ uniforms, vertexShader: VERT, fragmentShader: sh.source, depthTest: false, depthWrite: false })
}

export interface SharedUniforms {
  tDepth: THREE.IUniform<THREE.Texture | null>
  uResolution: THREE.IUniform<THREE.Vector2>
  uTime: THREE.IUniform<number>
  uNear: THREE.IUniform<number>
  uFar: THREE.IUniform<number>
}
export const makeShared = (): SharedUniforms => ({
  tDepth: { value: null },
  uResolution: { value: new THREE.Vector2(1, 1) },
  uTime: { value: 0 },
  uNear: { value: 0.1 },
  uFar: { value: 1000 }
})

export function userPass(sh: ActiveShader, shared: SharedUniforms): ShaderPass {
  const pass = new ShaderPass(makeMaterial(sh, shared))
  ;(pass as ShaderPass & { userFile: string }).userFile = sh.file
  return pass
}

/** Pasada previa que solo escribe la profundidad de la escena en una textura (si algún shader la usa). */
export class DepthPrePass extends Pass {
  private target: THREE.WebGLRenderTarget
  // con el atlas y alphaTest, plantas, hojas y paneles escriben profundidad con su silueta real
  private override = new THREE.MeshBasicMaterial({ colorWrite: false, alphaTest: 0.5, side: THREE.DoubleSide })
  constructor(private scene: THREE.Scene, private camera: THREE.Camera, private shared: SharedUniforms, private getMap?: () => THREE.Texture | null) {
    super()
    this.needsSwap = false
    this.target = new THREE.WebGLRenderTarget(1, 1, { depthTexture: new THREE.DepthTexture(1, 1) })
    shared.tDepth.value = this.target.depthTexture
  }
  setSize(w: number, h: number): void {
    this.target.setSize(w, h)
  }
  render(renderer: THREE.WebGLRenderer): void {
    const cam = this.camera as THREE.PerspectiveCamera
    this.shared.uNear.value = cam.near
    this.shared.uFar.value = cam.far
    const map = this.getMap?.() ?? null
    if (this.override.map !== map) {
      this.override.map = map
      this.override.needsUpdate = true
    }
    // el cielo, el suelo de sombra y las ayudas del editor no deben escribir profundidad
    const hidden: THREE.Object3D[] = []
    for (const c of this.scene.children) {
      if (c.visible && c.name.startsWith('__')) {
        c.visible = false
        hidden.push(c)
      }
    }
    const prevOverride = this.scene.overrideMaterial
    const prevBg = this.scene.background
    this.scene.overrideMaterial = this.override
    this.scene.background = null
    renderer.setRenderTarget(this.target)
    renderer.clear()
    renderer.render(this.scene, this.camera)
    this.scene.overrideMaterial = prevOverride
    this.scene.background = prevBg
    for (const c of hidden) c.visible = true
  }
  dispose(): void {
    this.target.depthTexture?.dispose()
    this.target.dispose()
    this.override.dispose()
  }
}

/** Compila el shader en un contexto aparte y devuelve el error de GLSL (o null si es correcto). */
export function createValidationRenderer(): THREE.WebGLRenderer {
  return new THREE.WebGLRenderer({ canvas: document.createElement('canvas') })
}

/** Compila el shader (en un renderer aparte, propio o compartido) y devuelve el error de GLSL o null. */
export function validateShader(source: string, file: string, shared?: THREE.WebGLRenderer): string | null {
  const meta = parseShaderMeta(source, file)
  const r = shared ?? createValidationRenderer()
  let error: string | null = null
  r.debug.onShaderError = (gl, _program, _vs, fs) => {
    error = (gl.getShaderInfoLog(fs) || 'Error de compilación desconocido').trim()
  }
  try {
    const shared = makeShared()
    shared.tDepth.value = new THREE.DepthTexture(1, 1)
    const quad = new FullScreenQuad(makeMaterial({ file, source, meta, values: {} }, shared))
    r.setSize(4, 4, false)
    quad.render(r)
    quad.material.dispose()
    quad.dispose()
  } catch (e) {
    error = error ?? (e as Error).message
  } finally {
    r.debug.onShaderError = null
    if (!shared) {
      r.dispose()
      r.forceContextLoss()
    }
  }
  return error
}
