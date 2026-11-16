// Elementos de escena procedurales construidos con BLOQUES de Minecraft reales (grass_block, oak_log, water…).
// Cada elemento genera un modelo de vóxeles que pasa por el mismo generador de malla y atlas que las construcciones.
import * as THREE from 'three'
import type { SceneObject } from '@shared/types'
import type { VoxelModel } from '../core/formats'

type P = Record<string, number | string | boolean>
const n = (p: P, k: string, d: number): number => (typeof p[k] === 'number' ? (p[k] as number) : d)
const s = (p: P, k: string, d: string): string => (typeof p[k] === 'string' ? (p[k] as string) : d)
const b = (p: P, k: string, d: boolean): boolean => (typeof p[k] === 'boolean' ? (p[k] as boolean) : d)
const mc = (x: string): string => (x.includes(':') ? x : `minecraft:${x}`)

export function rng(seed: number): () => number {
  let a = (seed * 2654435761) >>> 0 || 1
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function valueNoise2(seed: number): (x: number, y: number) => number {
  const perm = new Float32Array(1024)
  const r = rng(seed)
  for (let i = 0; i < 1024; i++) perm[i] = r()
  const h = (x: number, y: number): number => perm[(((x * 73856093) ^ (y * 19349663)) >>> 0) & 1023]
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y)
    const xf = x - xi, yf = y - yi
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf)
    const a = h(xi, yi), bb = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1)
    return a + (bb - a) * u + (c - a) * v + (a - bb - c + d) * u * v
  }
}

/** Modelo de vóxeles con paleta de bloques; coordenadas locales pueden ser negativas (se desplazan). */
class Vox {
  private cells = new Map<string, string>()
  minX = Infinity; minY = Infinity; minZ = Infinity; maxX = -Infinity; maxY = -Infinity; maxZ = -Infinity
  set(x: number, y: number, z: number, state: string, overwrite = true): void {
    const k = `${x},${y},${z}`
    if (!overwrite && this.cells.has(k)) return
    this.cells.set(k, mc(state))
    if (x < this.minX) this.minX = x
    if (y < this.minY) this.minY = y
    if (z < this.minZ) this.minZ = z
    if (x > this.maxX) this.maxX = x
    if (y > this.maxY) this.maxY = y
    if (z > this.maxZ) this.maxZ = z
  }
  has(x: number, y: number, z: number): boolean {
    return this.cells.has(`${x},${y},${z}`)
  }
  toModel(): { model: VoxelModel; offset: [number, number, number] } | null {
    if (!this.cells.size) return null
    const sx = this.maxX - this.minX + 1, sy = this.maxY - this.minY + 1, sz = this.maxZ - this.minZ + 1
    const palette = ['minecraft:air']
    const idx = new Map<string, number>([['minecraft:air', 0]])
    const data = new Uint16Array(sx * sy * sz)
    for (const [k, st] of this.cells) {
      const [x, y, z] = k.split(',').map(Number)
      let i = idx.get(st)
      if (i === undefined) {
        i = palette.length
        palette.push(st)
        idx.set(st, i)
      }
      data[((y - this.minY) * sz + (z - this.minZ)) * sx + (x - this.minX)] = i
    }
    return { model: { sx, sy, sz, data, palette }, offset: [this.minX, this.minY, this.minZ] }
  }
}

export type VoxelMesher = (model: VoxelModel) => THREE.Object3D

export interface BuiltProp {
  root: THREE.Object3D
  tick?: (t: number) => void
}

export const TREE_SPECIES: [string, string][] = [
  ['oak', 'Roble'], ['birch', 'Abedul'], ['spruce', 'Abeto'], ['dark_oak', 'Roble oscuro'], ['jungle', 'Jungla'],
  ['acacia', 'Acacia'], ['cherry', 'Cerezo'], ['mangrove', 'Mangle'], ['pale_oak', 'Roble pálido']
]
const FLOWERS = ['poppy', 'dandelion', 'cornflower', 'oxeye_daisy', 'azure_bluet', 'allium', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'lily_of_the_valley']

/** Árbol de bloques en (x, y, z) con la base del tronco en y. */
function growTree(v: Vox, x: number, y: number, z: number, species: string, height: number, r: () => number): void {
  const log = `${species}_log[axis=y]`
  const leaves = `${species}_leaves[persistent=true]`
  const H = Math.max(4, Math.round(height))
  if (species === 'spruce') {
    for (let i = 0; i < H; i++) v.set(x, y + i, z, log)
    for (let i = 2; i <= H; i++) {
      const rad = Math.max(0, Math.round(((H - i) / (H - 2)) * 3 - (i % 2 ? 0.7 : 0)))
      for (let dx = -rad; dx <= rad; dx++) for (let dz = -rad; dz <= rad; dz++)
        if (Math.abs(dx) + Math.abs(dz) <= rad + 0.5 && !(dx === 0 && dz === 0 && i < H)) v.set(x + dx, y + i, z + dz, leaves, false)
    }
    v.set(x, y + H, z, leaves)
    return
  }
  const trunk = species === 'dark_oak' || species === 'pale_oak' ? 2 : 1
  const th = Math.max(3, Math.round(H * 0.62))
  for (let i = 0; i < th; i++) for (let a = 0; a < trunk; a++) for (let c = 0; c < trunk; c++) v.set(x + a, y + i, z + c, log)
  const R = species === 'birch' ? 2 : Math.max(2, Math.round(H * 0.3))
  const cy = y + th
  for (let dx = -R; dx <= R + trunk - 1; dx++)
    for (let dy = -1; dy <= 2; dy++)
      for (let dz = -R; dz <= R + trunk - 1; dz++) {
        const rr = dy >= 1 ? R - 1 : R
        const ex = dx < 0 ? -dx : Math.max(0, dx - trunk + 1)
        const ez = dz < 0 ? -dz : Math.max(0, dz - trunk + 1)
        if (ex > rr || ez > rr) continue
        if (ex === rr && ez === rr && r() < 0.6) continue
        v.set(x + dx, cy + dy, z + dz, leaves, false)
      }
}

/** Paleta de superficie por estilo de isla: [bloque, peso] */
const ISLAND_SURFACE: Record<string, [string, number][]> = {
  verde: [['grass_block', 70], ['coarse_dirt', 8], ['podzol', 8], ['moss_block', 6], ['gravel', 4], ['rooted_dirt', 4]],
  seca: [['coarse_dirt', 34], ['grass_block', 26], ['dirt', 16], ['rooted_dirt', 10], ['packed_mud', 6], ['sand', 8]],
  nieve: [['snow_block', 60], ['grass_block[snowy=true]', 12], ['packed_ice', 6], ['stone', 10], ['gravel', 12]],
  arena: [['sand', 60], ['sandstone', 12], ['red_sand', 8], ['coarse_dirt', 12], ['gravel', 8]]
}
const ISLAND_PLANTS: Record<string, [string, number][]> = {
  verde: [['short_grass', 60], ['fern', 15], ['poppy', 5], ['dandelion', 5], ['oxeye_daisy', 5], ['azure_bluet', 5], ['cornflower', 5]],
  seca: [['short_grass', 40], ['dead_bush', 35], ['fern', 10], ['dandelion', 10], ['poppy', 5]],
  nieve: [['fern', 50], ['short_grass', 30], ['sweet_berry_bush', 20]],
  arena: [['dead_bush', 70], ['short_grass', 30]]
}
function pickWeighted(list: [string, number][], r: number): string {
  const total = list.reduce((a, [, w]) => a + w, 0)
  let t = r * total
  for (const [b, w] of list) {
    if ((t -= w) <= 0) return b
  }
  return list[0][0]
}

/** Isla de terreno orgánica bajo una construcción (como en las presentaciones de construcciones). */
function buildIsland(v: Vox, R: number, H: number, style: string, plants: number, seed: number): void {
  const r = rng(seed)
  const noise = valueNoise2(seed + 17)
  const surface = ISLAND_SURFACE[style] ?? ISLAND_SURFACE.verde
  const flora = ISLAND_PLANTS[style] ?? ISLAND_PLANTS.verde
  const under = style === 'arena' ? 'sandstone' : style === 'nieve' ? 'dirt' : 'dirt'
  const radiusAt = (x: number, z: number): number => {
    const a = Math.atan2(z, x)
    return R * (0.82 + 0.3 * noise(Math.cos(a) * 2.2 + 50, Math.sin(a) * 2.2 + 50))
  }
  const ext = Math.ceil(R * 1.15)
  for (let x = -ext; x <= ext; x++)
    for (let z = -ext; z <= ext; z++) {
      const d = Math.hypot(x, z)
      const rr = radiusAt(x, z)
      if (d > rr) continue
      // borde más fino y con capas irregulares hacia abajo
      const edge = 1 - d / rr
      const depth = Math.max(1, Math.round(H * (0.35 + edge * 0.9) + (r() - 0.5)))
      for (let k = 0; k < depth; k++) {
        const y = H - 1 - k
        if (k === 0) v.set(x, y, z, pickWeighted(surface, r()))
        else v.set(x, y, z, k > 2 && style !== 'arena' && r() < 0.35 ? 'stone' : under)
      }
      // sin plantas en el centro, donde se coloca la construcción
      if (plants > 0 && d > rr * 0.5 && r() < plants * (0.4 + edge)) v.set(x, H, z, pickWeighted(flora, r()))
    }
}

export function buildProcedural(o: SceneObject, meshVoxels: VoxelMesher): BuiltProp {
  const p = o.params
  const v = new Vox()
  const extra: THREE.Object3D[] = []
  switch (o.kind) {
    case 'base': {
      const R = Math.max(2, Math.round(n(p, 'radius', 12)))
      const H = Math.max(1, Math.round(n(p, 'height', 2)))
      const shape = s(p, 'shape', 'blocks')
      const top = s(p, 'block', 'polished_andesite'), side = s(p, 'sideBlock', 'stone_bricks'), rim = s(p, 'rimBlock', 'gold_block')
      const useRim = b(p, 'rim', true)
      if (shape === 'island') {
        buildIsland(v, R, H, s(p, 'islandStyle', 'verde'), n(p, 'plants', 0.25), n(p, 'seed', 7))
        break
      }
      for (let y = 0; y < H; y++) {
        const r = shape === 'blocks' ? R - (H - 1 - y) * 0 - (y === H - 1 && H > 1 ? 1 : 0) : R
        for (let x = -r; x <= r; x++)
          for (let z = -r; z <= r; z++) {
            const inside = shape === 'square' ? true : x * x + z * z <= r * r + r * 0.8
            if (!inside) continue
            const edge = shape === 'square' ? Math.max(Math.abs(x), Math.abs(z)) === r : (x * x + z * z) > (r - 1) * (r - 1) + (r - 1) * 0.8
            const isTop = y === H - 1
            v.set(x, y, z, isTop ? (edge && useRim ? rim : top) : side)
          }
      }
      break
    }
    case 'terrain': {
      const S = Math.min(256, Math.max(16, Math.round(n(p, 'size', 128))))
      const amp = n(p, 'amplitude', 6), rough = n(p, 'roughness', 0.5), flat = n(p, 'flatCenter', 24)
      const noise = valueNoise2(n(p, 'seed', 7))
      const r = rng(n(p, 'seed', 7) + 99)
      const surface = s(p, 'block', 'grass_block'), fill = s(p, 'fillBlock', 'dirt'), deep = s(p, 'deepBlock', 'stone')
      const plants = n(p, 'plants', 0.12), trees = Math.round(n(p, 'trees', 0)), species = s(p, 'treeSpecies', 'oak')
      const half = Math.floor(S / 2)
      const heights = new Int16Array(S * S)
      let minH = Infinity
      for (let i = 0; i < S; i++)
        for (let j = 0; j < S; j++) {
          const x = i - half, z = j - half
          let h = 0, a = 1, f = 1 / 32, norm = 0
          for (let k = 0; k < 5; k++) {
            h += a * (noise(x * f + 100, z * f + 100) - 0.5)
            norm += a
            a *= rough
            f *= 2
          }
          const k2 = THREE.MathUtils.smoothstep(Math.hypot(x, z), flat, flat * 1.8)
          const hh = Math.round((h / norm) * 2.4 * amp * k2)
          heights[i * S + j] = hh
          if (hh < minH) minH = hh
        }
      const bottom = minH - 3
      for (let i = 0; i < S; i++)
        for (let j = 0; j < S; j++) {
          const x = i - half, z = j - half
          const h = heights[i * S + j]
          for (let y = bottom; y < h; y++) v.set(x, y, z, y === h - 1 ? surface : y >= h - 4 ? fill : deep)
        }
      // vegetación sobre la superficie (hierba y flores reales)
      const surfaceHasPlants = surface === 'grass_block' || surface === 'podzol' || surface === 'moss_block'
      if (surfaceHasPlants && plants > 0)
        for (let i = 1; i < S - 1; i++)
          for (let j = 1; j < S - 1; j++) {
            const x = i - half, z = j - half
            if (Math.hypot(x, z) < flat * 0.85) continue
            const q = r()
            if (q > plants) continue
            const h = heights[i * S + j]
            v.set(x, h, z, q < plants * 0.15 ? FLOWERS[Math.floor(r() * FLOWERS.length)] : q < plants * 0.25 ? 'fern' : 'short_grass')
          }
      for (let t = 0, tries = 0; t < trees && tries < trees * 30; tries++) {
        const i = 3 + Math.floor(r() * (S - 6)), j = 3 + Math.floor(r() * (S - 6))
        const x = i - half, z = j - half
        if (Math.hypot(x, z) < flat * 0.9) continue
        const h = heights[i * S + j]
        growTree(v, x, h, z, species, 5 + r() * 4, r)
        t++
      }
      break
    }
    case 'water': {
      const S = Math.max(2, Math.round(n(p, 'size', 90)))
      const half = Math.floor(S / 2)
      const D = Math.max(1, Math.round(n(p, 'depth', 1)))
      for (let x = -half; x < S - half; x++) for (let z = -half; z < S - half; z++) for (let y = 0; y < D; y++) v.set(x, y, z, 'water[level=0]')
      break
    }
    case 'path': {
      const L = Math.max(1, Math.round(n(p, 'length', 30))), W = Math.max(1, Math.round(n(p, 'width', 3))), curve = n(p, 'curve', 0)
      const block = s(p, 'block', 'dirt_path')
      const r = rng(n(p, 'seed', 3))
      for (let i = 0; i < L; i++) {
        const cx = Math.round(Math.sin((i / Math.max(L, 1)) * Math.PI * 2) * curve)
        for (let j = 0; j < W; j++) v.set(cx + j - Math.floor(W / 2), 0, i - Math.floor(L / 2), block === 'mixed' ? ['gravel', 'cobblestone', 'dirt_path', 'coarse_dirt'][Math.floor(r() * 4)] : block)
      }
      break
    }
    case 'rock': {
      const R = Math.max(1, n(p, 'size', 2.5)), jag = n(p, 'jagged', 0.35)
      const r = rng(n(p, 'seed', 11))
      const main = s(p, 'block', 'stone')
      const mixes = main === 'stone' ? ['stone', 'stone', 'andesite', 'cobblestone', 'mossy_cobblestone'] : [main]
      const Ri = Math.ceil(R)
      for (let x = -Ri; x <= Ri; x++)
        for (let y = 0; y <= Ri; y++)
          for (let z = -Ri; z <= Ri; z++) {
            const d = Math.hypot(x, y * 1.3, z)
            if (d <= R * (1 - jag * 0.5 + r() * jag)) v.set(x, y, z, mixes[Math.floor(r() * mixes.length)])
          }
      break
    }
    case 'tree': {
      growTree(v, 0, 0, 0, s(p, 'species', 'oak'), n(p, 'height', 7), rng(n(p, 'seed', 5)))
      break
    }
    case 'vegetation': {
      const A = Math.round(n(p, 'area', 50)), count = Math.min(20000, Math.round(n(p, 'count', 400))), avoid = n(p, 'avoidCenter', 16)
      const mix = s(p, 'mix', 'mixed')
      const r = rng(n(p, 'seed', 2))
      for (let k = 0, tries = 0; k < count && tries < count * 5; tries++) {
        const a = r() * Math.PI * 2, d = Math.sqrt(r()) * A * 0.5
        if (d < avoid) continue
        const x = Math.round(Math.cos(a) * d), z = Math.round(Math.sin(a) * d)
        if (v.has(x, 0, z)) continue
        const flower = mix === 'flowers' || (mix === 'mixed' && r() < 0.2)
        v.set(x, 0, z, flower ? FLOWERS[Math.floor(r() * FLOWERS.length)] : r() < 0.15 ? 'fern' : 'short_grass')
        k++
      }
      break
    }
    case 'light': {
      const g = new THREE.Group()
      const color = s(p, 'color', '#ffc98a'), inten = n(p, 'intensity', 40), dist = n(p, 'distance', 30)
      const light = s(p, 'type', 'point') === 'spot' ? new THREE.SpotLight(color, inten, dist, Math.PI / 5, 0.4, 2) : new THREE.PointLight(color, inten, dist, 2)
      light.castShadow = b(p, 'castShadow', false)
      light.shadow.mapSize.set(1024, 1024)
      light.shadow.bias = -0.002
      if ((light as THREE.SpotLight).isSpotLight) {
        const sl = light as THREE.SpotLight
        sl.target.position.set(0, -1, 0)
        g.add(sl.target)
      }
      g.add(light)
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.25, 16, 8), new THREE.MeshBasicMaterial({ color }))
      bulb.userData.editorOnly = true
      g.add(bulb)
      return { root: g }
    }
    case 'decor': {
      const type = s(p, 'type', 'lamp')
      const wood = s(p, 'wood', 'oak')
      if (type === 'lamp') {
        v.set(0, 0, 0, 'cobblestone_wall')
        v.set(0, 1, 0, `${wood}_fence`)
        v.set(0, 2, 0, `${wood}_fence`)
        v.set(0, 3, 0, 'lantern[hanging=false]')
        const l = new THREE.PointLight('#ffcf7a', 14, 16, 2)
        l.position.set(0.5, 3.5, 0.5)
        extra.push(l)
      } else if (type === 'fence') {
        for (let x = -4; x <= 4; x++) v.set(x, 0, 0, `${wood}_fence`)
      } else if (type === 'bench') {
        for (let x = -1; x <= 1; x++) v.set(x, 0, 0, `${wood}_slab[type=bottom]`)
      } else if (type === 'campfire') {
        v.set(0, 0, 0, 'campfire')
        const l = new THREE.PointLight('#ff9a4a', 10, 12, 2)
        l.position.set(0.5, 1, 0.5)
        extra.push(l)
      } else if (type === 'well') {
        for (let x = -1; x <= 1; x++) for (let z = -1; z <= 1; z++) {
          if (x === 0 && z === 0) v.set(0, 0, 0, 'water[level=0]')
          else v.set(x, 0, z, 'cobblestone')
          if (Math.abs(x) === 1 && Math.abs(z) === 1) { v.set(x, 1, z, `${wood}_fence`); v.set(x, 2, z, `${wood}_fence`) }
          v.set(x, 3, z, `${wood}_slab[type=bottom]`)
        }
      } else {
        v.set(0, 0, 0, 'barrel')
        v.set(1, 0, 0, 'hay_block')
        v.set(0, 1, 0, 'pumpkin')
      }
      break
    }
  }
  const m = v.toModel()
  const root = new THREE.Group()
  if (m) {
    const mesh = meshVoxels(m.model)
    // el generador de malla coloca el vóxel (0,0,0) del modelo en el origen; aplicamos el desplazamiento real
    mesh.position.set(m.offset[0], m.offset[1], m.offset[2])
    root.add(mesh)
  }
  for (const e of extra) root.add(e)
  return { root }
}
