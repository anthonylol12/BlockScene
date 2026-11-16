// Generador de malla para modelos de vóxeles:
// - elimina caras ocultas entre bloques opacos
// - oclusión ambiental por vértice (estilo "suavizado de luz" de Minecraft)
// - coordenadas UV en un atlas de texturas (texturas de Minecraft del usuario o textura procedural)
// - separa geometría opaca, recortada (plantas, vallas…), translúcida y emisiva
import { classifyBlock, type BlockLook } from './blocks'
import { resolveBlock, type FaceTiles } from './textures'
import type { VoxelModel } from './formats'

export interface MeshGroup {
  positions: Float32Array
  normals: Int8Array
  colors: Uint8Array // RGBA
  uvs: Float32Array
  indices: Uint32Array
}
export interface MeshResult {
  opaque: MeshGroup
  cutout: MeshGroup
  transparent: MeshGroup
  emissive: MeshGroup
  faces: number
  unknownBlocks: number
  /** bloques dibujados con la textura procedural porque no se encontró su textura */
  untextured: number
  size: [number, number, number]
}
export const GROUPS = ['opaque', 'cutout', 'transparent', 'emissive'] as const

export interface AtlasInfo {
  /** names[i] = nombre de la textura del tile i (el 0 es la textura procedural) */
  names: string[]
  cols: number
  rows: number
  /** texturas por cara según los modelos del juego: nombre de bloque → [arriba, lado, abajo] */
  faces?: Record<string, [string, string, string]>
}

export const MAX_FACES = 16_000_000

class Grow<T extends Float32Array | Int8Array | Uint8Array | Uint32Array> {
  len = 0
  constructor(private ctor: new (n: number) => T, public arr: T) {}
  push4(a: number, b: number, c: number, d: number): void {
    if (this.len + 4 > this.arr.length) this.grow()
    const r = this.arr
    r[this.len++] = a
    r[this.len++] = b
    r[this.len++] = c
    r[this.len++] = d
  }
  push3(a: number, b: number, c: number): void {
    if (this.len + 3 > this.arr.length) this.grow()
    const r = this.arr
    r[this.len++] = a
    r[this.len++] = b
    r[this.len++] = c
  }
  push2(a: number, b: number): void {
    if (this.len + 2 > this.arr.length) this.grow()
    this.arr[this.len++] = a
    this.arr[this.len++] = b
  }
  private grow(): void {
    const n = new this.ctor(this.arr.length * 2)
    n.set(this.arr as never)
    this.arr = n
  }
  done(): T {
    return this.arr.slice(0, this.len) as T
  }
}

class GroupBuilder {
  pos = new Grow(Float32Array, new Float32Array(1 << 14))
  nor = new Grow(Int8Array, new Int8Array(1 << 14))
  col = new Grow(Uint8Array, new Uint8Array(1 << 14))
  uv = new Grow(Float32Array, new Float32Array(1 << 14))
  idx = new Grow(Uint32Array, new Uint32Array(1 << 13))
  verts = 0
  quad(p: number[], uv: number[], n: readonly number[], c: number[], a: number, ao: readonly number[]): void {
    const base = this.verts
    for (let i = 0; i < 4; i++) {
      this.pos.push3(p[i * 3], p[i * 3 + 1], p[i * 3 + 2])
      this.nor.push3(n[0] * 127, n[1] * 127, n[2] * 127)
      const f = ao[i]
      this.col.push4(Math.min(255, c[0] * f) | 0, Math.min(255, c[1] * f) | 0, Math.min(255, c[2] * f) | 0, (a * 255) | 0)
      this.uv.push2(uv[i * 2], uv[i * 2 + 1])
    }
    // Girar la diagonal según la AO para evitar artefactos anisotrópicos
    if (ao[0] + ao[2] < ao[1] + ao[3]) {
      this.idx.push3(base + 1, base + 2, base + 3)
      this.idx.push3(base + 1, base + 3, base)
    } else {
      this.idx.push3(base, base + 1, base + 2)
      this.idx.push3(base, base + 2, base + 3)
    }
    this.verts += 4
  }
  build(): MeshGroup {
    return { positions: this.pos.done(), normals: this.nor.done(), colors: this.col.done(), uvs: this.uv.done(), indices: this.idx.done() }
  }
}

type V3 = readonly [number, number, number]
interface FaceDef {
  n: V3
  u: V3
  v: V3
}
const FACES: FaceDef[] = [
  { n: [1, 0, 0], u: [0, 1, 0], v: [0, 0, 1] },
  { n: [-1, 0, 0], u: [0, 0, 1], v: [0, 1, 0] },
  { n: [0, 1, 0], u: [0, 0, 1], v: [1, 0, 0] },
  { n: [0, -1, 0], u: [1, 0, 0], v: [0, 0, 1] },
  { n: [0, 0, 1], u: [1, 0, 0], v: [0, 1, 0] },
  { n: [0, 0, -1], u: [0, 1, 0], v: [1, 0, 0] }
]
const CORNERS: [number, number][] = [
  [-1, -1],
  [1, -1],
  [1, 1],
  [-1, 1]
]
const AO_LEVELS = [0.5, 0.68, 0.84, 1]
const ONE = [1, 1, 1, 1] as const
const UP = [0, 1, 0] as const

// los colores de vértice se interpretan en espacio lineal: convertimos desde sRGB
const toLin = (c: number): number => Math.pow(c / 255, 2.2) * 255
const linRGB = (c: [number, number, number]): [number, number, number] => [toLin(c[0]), toLin(c[1]), toLin(c[2])]

function hash3(x: number, y: number, z: number): number {
  let h = (x * 374761393 + y * 668265263 + z * 2147483647) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

export interface MeshOptions {
  vertexAO: boolean
  colorVariation: number // 0..0.2
  atlas?: AtlasInfo | null
  /** desplazamiento del origen; por defecto centra en X/Z y apoya en Y = 0 */
  center?: boolean
  onProgress?: (f: number) => void
}

interface Look extends BlockLook {
  tiles: FaceTiles
  textured: boolean
  base: [number, number, number]
  props: Record<string, string>
  /** eje de troncos / pilares: la textura "top" va en las caras de ese eje */
  axis: 'x' | 'y' | 'z'
}

function parseProps(state: string): Record<string, string> {
  const out: Record<string, string> = {}
  const b = state.indexOf('[')
  if (b < 0) return out
  for (const kv of state.slice(b + 1, -1).split(',')) {
    const [k, v] = kv.split('=')
    if (k) out[k] = v
  }
  return out
}

type Box = [number, number, number, number, number, number]
const FACING: Record<string, [number, number]> = { north: [0, -1], south: [0, 1], east: [1, 0], west: [-1, 0] }

/** Cajas (en coordenadas 0..1 del bloque) que forman cada forma especial, según sus propiedades. */
export function shapeBoxes(shape: string, p: Record<string, string>, name: string): Box[] {
  const on = (k: string): boolean => p[k] === 'true' || p[k] === 'low' || p[k] === 'tall'
  switch (shape) {
    case 'stairs': {
      const top = p.half === 'top'
      const slab: Box = top ? [0, 0.5, 0, 1, 1, 1] : [0, 0, 0, 1, 0.5, 1]
      const [fx, fz] = FACING[p.facing ?? 'north'] ?? [0, -1]
      const y0 = top ? 0 : 0.5, y1 = top ? 0.5 : 1
      const step: Box = [fx > 0 ? 0.5 : 0, y0, fz > 0 ? 0.5 : 0, fx < 0 ? 0.5 : 1, y1, fz < 0 ? 0.5 : 1]
      return [slab, step]
    }
    case 'fence': {
      if (name.endsWith('_fence_gate')) {
        const ew = p.facing === 'north' || p.facing === 'south'
        const out: Box[] = ew
          ? [[0, 0.3125, 0.4375, 0.125, 1, 0.5625], [0.875, 0.3125, 0.4375, 1, 1, 0.5625]]
          : [[0.4375, 0.3125, 0, 0.5625, 1, 0.125], [0.4375, 0.3125, 0.875, 0.5625, 1, 1]]
        if (p.open !== 'true') {
          for (const [ya, yb] of [[0.375, 0.5625], [0.75, 0.9375]])
            out.push(ew ? [0, ya, 0.4375, 1, yb, 0.5625] : [0.4375, ya, 0, 0.5625, yb, 1])
        }
        return out
      }
      const out: Box[] = [[0.375, 0, 0.375, 0.625, 1, 0.625]]
      for (const [ya, yb] of [[0.375, 0.5625], [0.75, 0.9375]]) {
        if (on('north')) out.push([0.4375, ya, 0, 0.5625, yb, 0.375])
        if (on('south')) out.push([0.4375, ya, 0.625, 0.5625, yb, 1])
        if (on('west')) out.push([0, ya, 0.4375, 0.375, yb, 0.5625])
        if (on('east')) out.push([0.625, ya, 0.4375, 1, yb, 0.5625])
      }
      return out
    }
    case 'wall': {
      const out: Box[] = []
      if (p.up !== 'false') out.push([0.25, 0, 0.25, 0.75, 1, 0.75])
      const h = (k: string): number => (p[k] === 'tall' ? 1 : 0.875)
      if (on('north')) out.push([0.3125, 0, 0, 0.6875, h('north'), 0.5])
      if (on('south')) out.push([0.3125, 0, 0.5, 0.6875, h('south'), 1])
      if (on('west')) out.push([0, 0, 0.3125, 0.5, h('west'), 0.6875])
      if (on('east')) out.push([0.5, 0, 0.3125, 1, h('east'), 0.6875])
      if (!out.length) out.push([0.25, 0, 0.25, 0.75, 1, 0.75])
      return out
    }
    case 'pane': {
      const out: Box[] = [[0.4375, 0, 0.4375, 0.5625, 1, 0.5625]]
      if (on('north')) out.push([0.4375, 0, 0, 0.5625, 1, 0.4375])
      if (on('south')) out.push([0.4375, 0, 0.5625, 0.5625, 1, 1])
      if (on('west')) out.push([0, 0, 0.4375, 0.4375, 1, 0.5625])
      if (on('east')) out.push([0.5625, 0, 0.4375, 1, 1, 0.5625])
      return out
    }
    case 'door': {
      // puerta cerrada: panel en el lado opuesto a "facing"; abierta: girada 90° hacia la bisagra
      let dir = p.facing ?? 'north'
      if (p.open === 'true') {
        const right = p.hinge === 'right'
        const cw: Record<string, string> = { north: 'east', east: 'south', south: 'west', west: 'north' }
        const ccw: Record<string, string> = { north: 'west', west: 'south', south: 'east', east: 'north' }
        dir = right ? ccw[dir] : cw[dir]
      }
      return [panel(dir, 0.1875)]
    }
    case 'trapdoor': {
      if (p.open === 'true') return [panel(p.facing ?? 'north', 0.1875)]
      return [p.half === 'top' ? [0, 0.8125, 0, 1, 1, 1] : [0, 0, 0, 1, 0.1875, 1]]
    }
    case 'torch': {
      if (name.includes('wall_')) {
        const [fx, fz] = FACING[p.facing ?? 'north'] ?? [0, -1]
        const cx = 0.5 - fx * 0.3, cz = 0.5 - fz * 0.3
        return [[cx - 0.0625, 0.2, cz - 0.0625, cx + 0.0625, 0.825, cz + 0.0625]]
      }
      return [[0.4375, 0, 0.4375, 0.5625, 0.625, 0.5625]]
    }
    default:
      return [[0.375, 0, 0.375, 0.625, 1, 0.625]]
  }
}

/** Panel fino pegado al lado opuesto a la dirección indicada. */
function panel(facing: string, t: number): Box {
  switch (facing) {
    case 'north': return [0, 0, 1 - t, 1, 1, 1]
    case 'south': return [0, 0, 0, 1, 1, t]
    case 'east': return [0, 0, 0, t, 1, 1]
    default: return [1 - t, 0, 0, 1, 1, 1]
  }
}

export function buildMesh(model: VoxelModel, opts: MeshOptions): MeshResult {
  const { sx, sy, sz, data, palette } = model
  const atlas = opts.atlas ?? { names: ['__procedural'], cols: 1, rows: 1 }
  const tileIndex = new Map(atlas.names.map((n, i) => [n, i]))
  const has = (n: string): number => tileIndex.get(n) ?? 0
  const looks: Look[] = palette.map((s) => {
    const l = classifyBlock(s)
    const faces = atlas.names.length > 1 ? resolveBlock(s, has, atlas.faces) : null
    const textured = !!faces
    const tiles = faces ?? { top: 0, side: 0, bottom: 0, tint: null }
    const base: [number, number, number] = linRGB(textured ? (tiles.tint ?? [255, 255, 255]) : l.color)
    const props = parseProps(s)
    const axis = props.axis === 'x' || props.axis === 'z' ? props.axis : 'y'
    // puertas: la mitad superior usa su propia textura
    if (l.shape === 'door' && props.half === 'upper' && textured) tiles.side = tiles.top
    return { ...l, tiles, textured, base, props, axis }
  })
  const solid = new Uint8Array(looks.length)
  looks.forEach((l, i) => (solid[i] = l.shape === 'cube' && l.alpha >= 1 ? 1 : 0))
  const counts = new Float64Array(palette.length)
  for (let i = 0; i < data.length; i++) counts[data[i]]++
  let unknownBlocks = 0
  let untextured = 0
  looks.forEach((l, i) => {
    if (l.shape === 'none') return
    if (!l.known) unknownBlocks += counts[i]
    if (!l.textured) untextured += counts[i]
  })

  const groups = { opaque: new GroupBuilder(), cutout: new GroupBuilder(), transparent: new GroupBuilder(), emissive: new GroupBuilder() }
  const center = opts.center ?? true
  // centrado en bloques enteros: así las construcciones de ancho impar también encajan en la rejilla de bloques
  const ox = center ? -Math.floor(sx / 2) : 0
  const oz = center ? -Math.floor(sz / 2) : 0
  const layer = sx * sz
  const at = (x: number, y: number, z: number): number =>
    x < 0 || y < 0 || z < 0 || x >= sx || y >= sy || z >= sz ? 0 : data[y * layer + z * sx + x]
  const isSolid = (x: number, y: number, z: number): number => solid[at(x, y, z)]
  let faces = 0
  const pts: number[] = new Array(12)
  const uvs: number[] = new Array(8)
  const tint = [0, 0, 0]
  const WHITE = [255, 255, 255]
  const ao4 = [1, 1, 1, 1]
  const { cols, rows } = atlas
  const E = 0.012
  const setUV = (i: number, tile: number, tu: number, tv: number): void => {
    const c = tile % cols, r = Math.floor(tile / cols)
    uvs[i * 2] = (c + E + tu * (1 - 2 * E)) / cols
    uvs[i * 2 + 1] = 1 - (r + 1 - (E + tv * (1 - 2 * E))) / rows
  }

  const emitBox = (
    g: GroupBuilder, x: number, y: number, z: number,
    x0: number, y0: number, z0: number, x1: number, y1: number, z1: number,
    look: Look, selfIdx: number, cullSame: boolean, alpha: number
  ): void => {
    for (const f of FACES) {
      const [nx, ny, nz] = f.n
      const touches = (nx > 0 && x1 >= 1) || (nx < 0 && x0 <= 0) || (ny > 0 && y1 >= 1) || (ny < 0 && y0 <= 0) || (nz > 0 && z1 >= 1) || (nz < 0 && z0 <= 0)
      if (touches) {
        const nb = at(x + nx, y + ny, z + nz)
        if (solid[nb]) continue
        if (cullSame && nb === selfIdx) continue
        if (look.shape === 'liquid' && looks[nb].shape === 'liquid') continue
      }
      const tile =
        look.axis === 'y'
          ? ny > 0 ? look.tiles.top : ny < 0 ? look.tiles.bottom : look.tiles.side
          : (look.axis === 'x' ? nx !== 0 : nz !== 0) ? look.tiles.top : look.tiles.side
      for (let i = 0; i < 4; i++) {
        const [su, sv] = CORNERS[i]
        const cx = nx !== 0 ? (nx > 0 ? x1 : x0) : f.u[0] ? (su > 0 ? x1 : x0) : (sv > 0 ? x1 : x0)
        const cy = ny !== 0 ? (ny > 0 ? y1 : y0) : f.u[1] ? (su > 0 ? y1 : y0) : (sv > 0 ? y1 : y0)
        const cz = nz !== 0 ? (nz > 0 ? z1 : z0) : f.u[2] ? (su > 0 ? z1 : z0) : (sv > 0 ? z1 : z0)
        pts[i * 3] = x + cx + ox
        pts[i * 3 + 1] = y + cy
        pts[i * 3 + 2] = z + cz + oz
        if (ny !== 0) setUV(i, tile, cx, cz)
        else if (nx !== 0) setUV(i, tile, nx > 0 ? 1 - cz : cz, cy)
        else setUV(i, tile, nz > 0 ? cx : 1 - cx, cy)
      }
      let ao: readonly number[] = ONE
      if (opts.vertexAO && look.shape === 'cube') {
        const bx = x + nx, by = y + ny, bz = z + nz
        for (let i = 0; i < 4; i++) {
          const [su, sv] = CORNERS[i]
          const s1 = isSolid(bx + f.u[0] * su, by + f.u[1] * su, bz + f.u[2] * su)
          const s2 = isSolid(bx + f.v[0] * sv, by + f.v[1] * sv, bz + f.v[2] * sv)
          const c = isSolid(bx + f.u[0] * su + f.v[0] * sv, by + f.u[1] * su + f.v[1] * sv, bz + f.u[2] * su + f.v[2] * sv)
          ao4[i] = AO_LEVELS[s1 && s2 ? 0 : 3 - (s1 + s2 + c)]
        }
        ao = ao4
      }
      g.quad(pts, uvs, f.n, look.tiles.tintTopOnly && ny <= 0 ? WHITE : tint, alpha, ao)
      faces++
    }
  }

  // vallas, paneles y muros sin propiedades de conexión: se deducen de los vecinos
  const CONNECTABLE = new Set(['fence', 'wall', 'pane'])
  const connections = (look: Look, x: number, y: number, z: number): Record<string, string> => {
    const p = look.props
    if (!CONNECTABLE.has(look.shape) || 'north' in p || 'east' in p) return p
    const out = { ...p }
    for (const [dir, [dx, dz]] of Object.entries(FACING)) {
      const nb = looks[at(x + dx, y, z + dz)]
      const ok = solid[at(x + dx, y, z + dz)] === 1 || nb.shape === look.shape || (look.shape === 'wall' && nb.shape === 'fence')
      out[dir] = ok ? (look.shape === 'wall' ? 'low' : 'true') : look.shape === 'wall' ? 'none' : 'false'
    }
    return out
  }

  // planta: dos planos cruzados en diagonal (como en Minecraft)
  const emitCross = (g: GroupBuilder, x: number, y: number, z: number, look: Look, h: number): void => {
    const tile = look.tiles.side
    const diag = [
      [0.15, 0.15, 0.85, 0.85],
      [0.85, 0.15, 0.15, 0.85]
    ]
    for (const [ax, az, bx, bz] of diag) {
      const P = [[ax, 0, az], [bx, 0, bz], [bx, h, bz], [ax, h, az]]
      for (let i = 0; i < 4; i++) {
        pts[i * 3] = x + P[i][0] + ox
        pts[i * 3 + 1] = y + P[i][1]
        pts[i * 3 + 2] = z + P[i][2] + oz
        setUV(i, tile, i === 0 || i === 3 ? 0 : 1, i >= 2 ? 1 : 0)
      }
      g.quad(pts, uvs, UP, tint, 1, ONE)
      faces++
    }
  }

  for (let y = 0; y < sy; y++) {
    if (opts.onProgress && (y & 7) === 0) opts.onProgress(y / sy)
    if (faces > MAX_FACES)
      throw new Error(`La malla supera ${MAX_FACES / 1e6} millones de caras. Esta construcción es demasiado grande para el visor actual.`)
    for (let z = 0; z < sz; z++) {
      for (let x = 0; x < sx; x++) {
        const idx = data[y * layer + z * sx + x]
        const look = looks[idx]
        if (look.shape === 'none') continue
        const v = opts.colorVariation > 0 && !look.textured ? 1 + (hash3(x, y, z) - 0.5) * 2 * opts.colorVariation : 1
        tint[0] = look.base[0] * v
        tint[1] = look.base[1] * v
        tint[2] = look.base[2] * v
        // translucidez: con textura, el canal alfa lo da la propia textura (salvo el agua)
        const alpha = look.shape === 'liquid' ? look.alpha : look.textured ? 1 : look.alpha
        const thin = look.shape !== 'cube' && look.shape !== 'glass' && look.shape !== 'liquid' && look.shape !== 'slab_bottom' && look.shape !== 'slab_top' && look.shape !== 'stairs'
        const g = look.emissive
          ? groups.emissive
          : alpha < 1 || (look.shape === 'glass' && look.textured)
            ? groups.transparent
            : thin && look.textured
              ? groups.cutout
              : groups.opaque
        switch (look.shape) {
          case 'cube':
            emitBox(g, x, y, z, 0, 0, 0, 1, 1, 1, look, idx, false, alpha)
            break
          case 'glass':
            emitBox(g, x, y, z, 0, 0, 0, 1, 1, 1, look, idx, true, alpha)
            break
          case 'liquid': {
            const above = looks[at(x, y + 1, z)].shape === 'liquid'
            emitBox(g, x, y, z, 0, 0, 0, 1, above ? 1 : 0.875, 1, look, idx, true, alpha)
            break
          }
          case 'slab_bottom':
            emitBox(g, x, y, z, 0, 0, 0, 1, 0.5, 1, look, idx, false, alpha)
            break
          case 'slab_top':
            emitBox(g, x, y, z, 0, 0.5, 0, 1, 1, 1, look, idx, false, alpha)
            break
          case 'carpet':
            emitBox(g, x, y, z, 0, 0, 0, 1, 0.0625, 1, look, idx, false, alpha)
            break
          case 'post':
            emitBox(g, x, y, z, 0.375, 0, 0.375, 0.625, 1, 0.625, look, idx, false, alpha)
            break
          case 'small':
            if (look.textured) emitCross(g, x, y, z, look, 1)
            else emitBox(g, x, y, z, 0.32, 0, 0.32, 0.68, 0.62, 0.68, look, idx, false, alpha)
            break
          case 'stairs':
          case 'fence':
          case 'wall':
          case 'pane':
          case 'door':
          case 'trapdoor':
          case 'torch':
            for (const bx of shapeBoxes(look.shape, connections(look, x, y, z), palette[idx]))
              emitBox(g, x, y, z, bx[0], bx[1], bx[2], bx[3], bx[4], bx[5], look, idx, false, alpha)
            break
        }
      }
    }
  }
  opts.onProgress?.(1)
  return {
    opaque: groups.opaque.build(),
    cutout: groups.cutout.build(),
    transparent: groups.transparent.build(),
    emissive: groups.emissive.build(),
    faces,
    unknownBlocks,
    untextured,
    size: [sx, sy, sz]
  }
}
