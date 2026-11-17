// Analizadores de formatos de construcciones de Minecraft.
// Todos convierten el archivo en un VoxelModel común y metadatos REALES del archivo.

import type { BuildInfo } from '@shared/types'
import { decompress, isCompound, num, readNbt, readNbtRaw, str, type NbtCompound, type NbtLongArray, type NbtValue } from '../nbt'
import { legacyToModern } from '../legacyIds'

export interface VoxelModel {
  sx: number
  sy: number
  sz: number
  /** índice de paleta por vóxel; orden (y * sz + z) * sx + x */
  data: Uint16Array | Uint32Array
  /** estados de bloque, p. ej. "minecraft:oak_slab[type=bottom]" */
  palette: string[]
}

export interface ParseMeta {
  format: string
  formatLabel: string
  version: string | null
  dataVersion: number | null
  regions: number | null
  author: string | null
  name: string | null
  warnings: string[]
}

export class FormatError extends Error {}

export const MAX_VOLUME = 120_000_000

export const SUPPORTED_FORMATS = [
  { ext: '.schem', label: 'Sponge Schematic', detail: 'Versiones 1, 2 y 3 (WorldEdit 7+, FAWE, Amulet). Minecraft 1.13 en adelante.', status: 'completo' },
  { ext: '.schematic', label: 'MCEdit / WorldEdit clásico', detail: 'IDs numéricos anteriores a 1.13 (Materials = Alpha). Se traducen los bloques más comunes; el resto se marca como desconocido.', status: 'parcial' },
  { ext: '.litematic', label: 'Litematica', detail: 'Versiones de formato 4 a 7, con varias regiones (se combinan en una sola construcción).', status: 'completo' },
  { ext: '.nbt', label: 'Estructura de Minecraft', detail: 'Archivos de bloque de estructura (Structure Block) de Java 1.13+. Si hay varias paletas se usa la primera.', status: 'completo' },
  { ext: '.mca', label: 'Región de mundo (Anvil)', detail: 'Un archivo de región de Java 1.13+ (carpeta region/ del mundo). Se recorta al contenido; chunks con compresión LZ4 se omiten.', status: 'parcial' }
] as const

const AIR = new Set(['minecraft:air', 'minecraft:cave_air', 'minecraft:void_air', 'minecraft:structure_void', 'air', 'cave_air', 'void_air'])
export const isAirState = (s: string): boolean => AIR.has(s.split('[')[0])

// DataVersion → versión de Minecraft (aproximada: se toma la versión conocida inmediatamente inferior)
const DATA_VERSIONS: [number, string][] = [
  [1343, '1.12.2'], [1519, '1.13'], [1631, '1.13.2'], [1952, '1.14.4'], [2230, '1.15.2'], [2566, '1.16'],
  [2586, '1.16.5'], [2724, '1.17'], [2730, '1.17.1'], [2860, '1.18'], [2975, '1.18.2'], [3105, '1.19'],
  [3120, '1.19.2'], [3218, '1.19.3'], [3337, '1.19.4'], [3463, '1.20'], [3465, '1.20.1'], [3578, '1.20.2'],
  [3698, '1.20.3'], [3700, '1.20.4'], [3837, '1.20.5'], [3839, '1.20.6'], [3953, '1.21'], [3955, '1.21.1'],
  [4080, '1.21.3'], [4189, '1.21.4'], [4325, '1.21.5'], [4435, '1.21.6'], [4438, '1.21.7'], [4440, '1.21.8'],
  [4554, '1.21.9'], [4556, '1.21.10']
]
export function minecraftVersionFor(dv: number | null): string | null {
  if (dv == null || dv <= 0) return null
  let best: string | null = null
  for (const [v, name] of DATA_VERSIONS) if (dv >= v) best = name
  if (!best) return 'anterior a 1.12.2'
  const last = DATA_VERSIONS[DATA_VERSIONS.length - 1]
  if (dv > last[0]) return `posterior a ${last[1]}`
  const exact = DATA_VERSIONS.find(([v]) => v === dv)
  return exact ? exact[1] : `≈ ${best}`
}

/**
 * Estado de bloque de una entrada de paleta. Formatos: {Name, Properties} (clásico) y, desde las
 * snapshots 26.4, {id, properties} o {"": "minecraft:stone"} (bloque sin propiedades).
 */
export function stateString(c: NbtValue): string {
  if (typeof c === 'string') return c
  if (!isCompound(c)) return 'minecraft:air'
  const name = str(c.Name) ?? str(c.id) ?? str(c['']) ?? 'minecraft:air'
  const props = c.Properties ?? c.properties
  if (!isCompound(props)) return name
  const keys = Object.keys(props).sort()
  if (!keys.length) return name
  return `${name}[${keys.map((k) => `${k}=${String(props[k])}`).join(',')}]`
}

function checkVolume(sx: number, sy: number, sz: number): void {
  if (sx <= 0 || sy <= 0 || sz <= 0) throw new FormatError(`Dimensiones inválidas en el archivo (${sx}×${sy}×${sz})`)
  const v = sx * sy * sz
  if (v > MAX_VOLUME)
    throw new FormatError(
      `La construcción ocupa ${sx}×${sy}×${sz} = ${(v / 1e6).toFixed(0)} millones de vóxeles; el límite actual es ${MAX_VOLUME / 1e6} millones.`
    )
}

const allocData = (vol: number, paletteSize: number): Uint16Array | Uint32Array =>
  paletteSize > 65535 ? new Uint32Array(vol) : new Uint16Array(vol)

/** Extrae `bits` bits empezando en la posición de bit `bit` de un long array (LSB primero). */
function getBits(words: Uint32Array, bit: number, bits: number, mask: number): number {
  const w = bit >>> 5
  const o = bit & 31
  let v = words[w] >>> o
  if (o + bits > 32 && w + 1 < words.length) v |= words[w + 1] << (32 - o)
  return (v & mask) >>> 0
}
const bitsFor = (n: number, min: number): number => Math.max(min, Math.ceil(Math.log2(Math.max(n, 1))))

// ---------------------------------------------------------------- Sponge .schem
function parseSponge(root: NbtCompound, warnings: string[]): { model: VoxelModel; meta: Partial<ParseMeta> } {
  const s = isCompound(root.Schematic) ? root.Schematic : root
  const version = num(s.Version)
  const W = (num(s.Width) ?? 0) & 0xffff
  const H = (num(s.Height) ?? 0) & 0xffff
  const L = (num(s.Length) ?? 0) & 0xffff
  checkVolume(W, H, L)
  let pal: NbtValue | undefined
  let bd: NbtValue | undefined
  if (version === 3) {
    const b = s.Blocks
    if (!isCompound(b)) throw new FormatError('Sponge v3 sin sección "Blocks"')
    pal = b.Palette
    bd = b.Data
  } else {
    pal = s.Palette
    bd = s.BlockData
  }
  if (!isCompound(pal) || !(bd instanceof Int8Array)) throw new FormatError('Faltan la paleta o los datos de bloques (Palette/BlockData)')
  const entries = Object.entries(pal)
  const max = entries.reduce((m, [, v]) => Math.max(m, num(v) ?? 0), 0)
  const palette: string[] = new Array(max + 1).fill('minecraft:air')
  for (const [name, idx] of entries) palette[num(idx) ?? 0] = name
  const vol = W * H * L
  const data = allocData(vol, palette.length)
  let i = 0
  let p = 0
  const n = bd.length
  while (p < vol && i < n) {
    let value = 0
    let shift = 0
    let b: number
    do {
      b = bd[i++] & 0xff
      value |= (b & 0x7f) << shift
      shift += 7
      if (shift > 35) throw new FormatError('BlockData con varint inválido')
    } while (b & 0x80 && i < n)
    data[p++] = value < palette.length ? value : 0
  }
  if (p < vol) warnings.push(`BlockData incompleto: se leyeron ${p} de ${vol} vóxeles; el resto se trata como aire.`)
  const md = isCompound(s.Metadata) ? s.Metadata : null
  const dv = num(s.DataVersion)
  return {
    model: { sx: W, sy: H, sz: L, data, palette },
    meta: {
      format: 'sponge',
      formatLabel: `Sponge Schematic v${version ?? '?'}`,
      version: version != null ? String(version) : null,
      dataVersion: dv,
      author: md ? str(md.Author) : null,
      name: md ? str(md.Name) : null
    }
  }
}

// ---------------------------------------------------------------- MCEdit .schematic
/**
 * En los IDs antiguos la mitad superior de una puerta no guarda su orientación (está en la inferior).
 * Se copia "facing" y "open" de la mitad de abajo para que las dos mitades queden alineadas.
 */
export function inheritUpperDoors(W: number, L: number, data: Uint16Array, palette: string[]): void {
  const upper = new Set<number>()
  palette.forEach((s, i) => { if (/_door\[half=upper\]$/.test(s)) upper.add(i) })
  if (!upper.size) return
  const layer = W * L
  const cache = new Map<string, number>()
  for (let i = layer; i < data.length; i++) {
    if (!upper.has(data[i])) continue
    const below = palette[data[i - layer]]
    const m = below?.match(/_door\[facing=(\w+),half=lower,open=(\w+)\]$/)
    if (!m) continue
    const s = palette[data[i]].replace('[half=upper]', `[facing=${m[1]},half=upper,open=${m[2]}]`)
    let idx = cache.get(s)
    if (idx === undefined) {
      idx = palette.indexOf(s)
      if (idx < 0) { idx = palette.length; palette.push(s) }
      cache.set(s, idx)
    }
    data[i] = idx
  }
}

function parseMcedit(root: NbtCompound, warnings: string[]): { model: VoxelModel; meta: Partial<ParseMeta> } {
  const W = (num(root.Width) ?? 0) & 0xffff
  const H = (num(root.Height) ?? 0) & 0xffff
  const L = (num(root.Length) ?? 0) & 0xffff
  checkVolume(W, H, L)
  const blocks = root.Blocks
  const meta = root.Data
  if (!(blocks instanceof Int8Array) || !(meta instanceof Int8Array)) throw new FormatError('Faltan los arrays Blocks/Data')
  const add = root.AddBlocks instanceof Int8Array ? root.AddBlocks : null
  const materials = str(root.Materials)
  if (materials && materials !== 'Alpha') warnings.push(`Materials = "${materials}": solo se garantiza el formato "Alpha" (Java).`)
  const vol = W * H * L
  if (blocks.length < vol) throw new FormatError(`Blocks tiene ${blocks.length} entradas, se esperaban ${vol}`)
  const palette: string[] = ['minecraft:air']
  const keyToIdx = new Map<number, number>([[0, 0]])
  const unknownIds = new Set<number>()
  const data = new Uint16Array(vol)
  for (let i = 0; i < vol; i++) {
    let id = blocks[i] & 0xff
    if (add) id |= ((i & 1 ? add[i >> 1] & 0x0f : (add[i >> 1] >> 4) & 0x0f) << 8)
    if (id === 0) continue
    const d = meta[i] & 0x0f
    const key = (id << 4) | d
    let idx = keyToIdx.get(key)
    if (idx === undefined) {
      const name = legacyToModern(id, d)
      if (!name) unknownIds.add(id)
      idx = palette.length
      palette.push(name ?? `legacy:${id}`)
      keyToIdx.set(key, idx)
    }
    data[i] = idx
  }
  if (unknownIds.size)
    warnings.push(`IDs antiguos sin traducción (se dibujan en magenta): ${[...unknownIds].slice(0, 12).join(', ')}${unknownIds.size > 12 ? '…' : ''}`)
  inheritUpperDoors(W, L, data, palette)
  return {
    model: { sx: W, sy: H, sz: L, data, palette },
    meta: { format: 'mcedit', formatLabel: 'MCEdit Schematic (pre-1.13)', version: materials ?? null, dataVersion: null }
  }
}

// ---------------------------------------------------------------- Litematica
function parseLitematic(root: NbtCompound, warnings: string[]): { model: VoxelModel; meta: Partial<ParseMeta> } {
  const regions = root.Regions
  if (!isCompound(regions)) throw new FormatError('Litematic sin "Regions"')
  type R = { ox: number; oy: number; oz: number; sx: number; sy: number; sz: number; pal: string[]; words: Uint32Array }
  const list: R[] = []
  for (const [name, r] of Object.entries(regions)) {
    if (!isCompound(r) || !isCompound(r.Position) || !isCompound(r.Size)) {
      warnings.push(`Región "${name}" con formato inesperado; se omite.`)
      continue
    }
    const px = num(r.Position.x) ?? 0, py = num(r.Position.y) ?? 0, pz = num(r.Position.z) ?? 0
    const sx = num(r.Size.x) ?? 0, sy = num(r.Size.y) ?? 0, sz = num(r.Size.z) ?? 0
    const pl = r.BlockStatePalette
    const bs = r.BlockStates as NbtLongArray | undefined
    if (!Array.isArray(pl) || !bs || !('__longArray' in bs)) {
      warnings.push(`Región "${name}" sin paleta o sin BlockStates; se omite.`)
      continue
    }
    list.push({
      ox: px + (sx < 0 ? sx + 1 : 0), oy: py + (sy < 0 ? sy + 1 : 0), oz: pz + (sz < 0 ? sz + 1 : 0),
      sx: Math.abs(sx), sy: Math.abs(sy), sz: Math.abs(sz),
      pal: pl.map(stateString), words: bs.words
    })
  }
  if (!list.length) throw new FormatError('El archivo Litematic no contiene regiones legibles')
  const minX = Math.min(...list.map((r) => r.ox)), minY = Math.min(...list.map((r) => r.oy)), minZ = Math.min(...list.map((r) => r.oz))
  const maxX = Math.max(...list.map((r) => r.ox + r.sx)), maxY = Math.max(...list.map((r) => r.oy + r.sy)), maxZ = Math.max(...list.map((r) => r.oz + r.sz))
  const SX = maxX - minX, SY = maxY - minY, SZ = maxZ - minZ
  checkVolume(SX, SY, SZ)
  const palette: string[] = ['minecraft:air']
  const pIdx = new Map<string, number>([['minecraft:air', 0]])
  const data = new Uint16Array(SX * SY * SZ)
  for (const r of list) {
    const map = r.pal.map((s) => {
      if (isAirState(s)) return 0
      let i = pIdx.get(s)
      if (i === undefined) {
        i = palette.length
        palette.push(s)
        pIdx.set(s, i)
      }
      return i
    })
    const bits = bitsFor(r.pal.length, 2)
    const mask = bits >= 32 ? 0xffffffff : (1 << bits) - 1
    const vol = r.sx * r.sy * r.sz
    const needWords = Math.ceil((vol * bits) / 32)
    if (r.words.length < needWords) warnings.push('BlockStates más corto de lo esperado; parte de la región puede faltar.')
    const layer = r.sx * r.sz
    for (let i = 0; i < vol; i++) {
      const bit = i * bits
      if ((bit >>> 5) >= r.words.length) break
      const v = getBits(r.words, bit, bits, mask)
      const g = map[v] ?? 0
      if (!g) continue
      const y = (i / layer) | 0
      const rem = i - y * layer
      const z = (rem / r.sx) | 0
      const x = rem - z * r.sx
      data[((r.oy - minY + y) * SZ + (r.oz - minZ + z)) * SX + (r.ox - minX + x)] = g
    }
  }
  const md = isCompound(root.Metadata) ? root.Metadata : null
  const ver = num(root.Version)
  return {
    model: { sx: SX, sy: SY, sz: SZ, data, palette },
    meta: {
      format: 'litematic',
      formatLabel: `Litematica v${ver ?? '?'}`,
      version: ver != null ? String(ver) : null,
      dataVersion: num(root.MinecraftDataVersion),
      regions: list.length,
      author: md ? str(md.Author) : null,
      name: md ? str(md.Name) : null
    }
  }
}

// ---------------------------------------------------------------- Structure .nbt
function parseStructure(root: NbtCompound, warnings: string[]): { model: VoxelModel; meta: Partial<ParseMeta> } {
  const size = root.size
  const blocks = root.blocks
  let pal = root.palette
  if (!Array.isArray(pal) && Array.isArray(root.palettes)) {
    const ps = root.palettes as NbtValue[]
    pal = ps[0]
    if (ps.length > 1) warnings.push(`La estructura tiene ${ps.length} paletas alternativas; se usa la primera.`)
  }
  const sizeArr = Array.isArray(size) ? size.map((v) => num(v) ?? 0) : size instanceof Int32Array ? Array.from(size) : null
  if (!sizeArr || sizeArr.length !== 3 || !Array.isArray(blocks) || !Array.isArray(pal))
    throw new FormatError('Estructura NBT sin "size", "blocks" o "palette"')
  const [SX, SY, SZ] = sizeArr
  checkVolume(SX, SY, SZ)
  const palette = (pal as NbtValue[]).map(stateString)
  const data = allocData(SX * SY * SZ, palette.length + 1)
  // índice 0 reservado a "vacío"; desplazamos la paleta en 1
  palette.unshift('minecraft:structure_void')
  let outside = 0
  for (const b of blocks) {
    if (!isCompound(b)) continue
    const pos = b.pos
    const p = Array.isArray(pos) ? pos.map((v) => num(v) ?? 0) : pos instanceof Int32Array ? Array.from(pos) : null
    const st = num(b.state)
    if (!p || st == null) continue
    const [x, y, z] = p
    if (x < 0 || y < 0 || z < 0 || x >= SX || y >= SY || z >= SZ) {
      outside++
      continue
    }
    data[(y * SZ + z) * SX + x] = st + 1
  }
  if (outside) warnings.push(`${outside} bloques fuera de los límites declarados se omitieron.`)
  return {
    model: { sx: SX, sy: SY, sz: SZ, data, palette },
    meta: { format: 'structure', formatLabel: 'Estructura NBT de Minecraft', version: null, dataVersion: num(root.DataVersion) }
  }
}

// ---------------------------------------------------------------- Región .mca
export interface RegionSection { x: number; y: number; z: number; pal: string[]; idx: Uint16Array | null }
export interface RegionRead { sections: RegionSection[]; maxDataVersion: number | null; lz4: number; bad: number; legacy: number; chunks: number }

/**
 * Lee las secciones de bloques de un archivo de región Anvil. `chunkFilter(cx, cz)` permite leer solo
 * algunos chunks (importación de un área de un mundo) y `yMin/yMax` descarta secciones fuera de ese rango.
 */
export async function readRegionSections(bytes: Uint8Array, opts: { chunkFilter?: (cx: number, cz: number) => boolean; yMin?: number; yMax?: number; onProgress?: (f: number) => void } = {}): Promise<RegionRead> {
  if (bytes.length < 8192) throw new FormatError('El archivo de región es demasiado pequeño (cabecera incompleta)')
  const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const sections: RegionSection[] = []
  let maxDataVersion: number | null = null
  let lz4 = 0, bad = 0, legacy = 0, chunks = 0
  for (let i = 0; i < 1024; i++) {
    if (opts.onProgress && i % 32 === 0) opts.onProgress(i / 1024)
    const loc = dv.getUint32(i * 4)
    const off = (loc >>> 8) * 4096
    if (!off) continue
    if (off + 5 > bytes.length) { bad++; continue }
    const len = dv.getUint32(off)
    const comp = bytes[off + 4]
    if (comp & 0x80) { bad++; continue } // chunk externo .mcc
    const payload = bytes.subarray(off + 5, off + 4 + len)
    let raw: Uint8Array
    try {
      if (comp === 1) raw = await decompress(payload, 'gzip')
      else if (comp === 2) raw = await decompress(payload, 'zlib')
      else if (comp === 3) raw = payload
      else { if (comp === 4) lz4++; else bad++; continue }
    } catch { bad++; continue }
    let root: NbtCompound
    try { root = readNbtRaw(raw).root } catch { bad++; continue }
    const level = isCompound(root.Level) ? root.Level : root
    const cx = num(level.xPos) ?? num(root.xPos) ?? 0
    const cz = num(level.zPos) ?? num(root.zPos) ?? 0
    if (opts.chunkFilter && !opts.chunkFilter(cx, cz)) continue
    chunks++
    const dvn = num(root.DataVersion)
    if (dvn != null) maxDataVersion = Math.max(maxDataVersion ?? 0, dvn)
    const secs = (Array.isArray(root.sections) ? root.sections : Array.isArray(level.Sections) ? level.Sections : []) as NbtValue[]
    if (dvn != null && dvn < 1451) { legacy++; continue }
    const spanning = dvn != null && dvn < 2527
    for (const s of secs) {
      if (!isCompound(s)) continue
      const sy = num(s.Y) ?? 0
      if (opts.yMin != null && sy * 16 + 15 < opts.yMin) continue
      if (opts.yMax != null && sy * 16 > opts.yMax) continue
      let palRaw: NbtValue | undefined, dataRaw: NbtValue | undefined
      if (isCompound(s.block_states)) { palRaw = s.block_states.palette; dataRaw = s.block_states.data }
      else { palRaw = s.Palette; dataRaw = s.BlockStates }
      if (!Array.isArray(palRaw) || !palRaw.length) continue
      const pal = palRaw.map(stateString)
      if (pal.every(isAirState)) continue
      let idx: Uint16Array | null = null
      if (pal.length > 1 && dataRaw && typeof dataRaw === 'object' && '__longArray' in dataRaw) {
        const words = (dataRaw as NbtLongArray).words
        const bits = bitsFor(pal.length, 4)
        const mask = (1 << bits) - 1
        const vpl = Math.floor(64 / bits)
        idx = new Uint16Array(4096)
        for (let k = 0; k < 4096; k++) {
          const bit = spanning ? k * bits : Math.floor(k / vpl) * 64 + (k % vpl) * bits
          if ((bit >>> 5) >= words.length) break
          idx[k] = getBits(words, bit, bits, mask)
        }
      }
      sections.push({ x: cx * 16, y: sy * 16, z: cz * 16, pal, idx })
    }
  }
  return { sections, maxDataVersion, lz4, bad, legacy, chunks }
}

/**
 * Une secciones en un único modelo recortado al contenido. Con `bounds` solo entran los bloques de ese
 * prisma (coordenadas de mundo, incluidas): así un área de un mundo no arrastra el resto de los chunks.
 */
export function assembleSections(sections: RegionSection[], bounds?: { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number }, onProgress?: (f: number) => void): VoxelModel {
  const inside = (x: number, y: number, z: number): boolean => !bounds || (x >= bounds.x0 && x <= bounds.x1 && y >= bounds.y0 && y <= bounds.y1 && z >= bounds.z0 && z <= bounds.z1)
  let minX = Infinity, minY = Infinity, minZ = Infinity, maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity
  for (const s of sections) {
    const air = s.pal.map(isAirState)
    for (let k = 0; k < 4096; k++) {
      if (air[s.idx ? s.idx[k] : 0] !== false) continue
      const x = s.x + (k & 15), z = s.z + ((k >> 4) & 15), y = s.y + (k >> 8)
      if (!inside(x, y, z)) continue
      if (x < minX) minX = x; if (x > maxX) maxX = x
      if (y < minY) minY = y; if (y > maxY) maxY = y
      if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
    }
  }
  if (maxX < minX) throw new FormatError('La zona elegida no contiene bloques sólidos')
  const SX = maxX - minX + 1, SY = maxY - minY + 1, SZ = maxZ - minZ + 1
  checkVolume(SX, SY, SZ)
  const palette: string[] = ['minecraft:air']
  const pIdx = new Map<string, number>([['minecraft:air', 0]])
  const data = new Uint16Array(SX * SY * SZ)
  sections.forEach((s, si) => {
    if (onProgress && si % 64 === 0) onProgress(si / sections.length)
    const map = s.pal.map((st) => {
      if (isAirState(st)) return 0
      let i = pIdx.get(st)
      if (i === undefined) { i = palette.length; palette.push(st); pIdx.set(st, i) }
      return i
    })
    for (let k = 0; k < 4096; k++) {
      const g = map[s.idx ? s.idx[k] : 0]
      if (!g) continue
      const wx = s.x + (k & 15), wz = s.z + ((k >> 4) & 15), wy = s.y + (k >> 8)
      if (!inside(wx, wy, wz)) continue
      data[((wy - minY) * SZ + (wz - minZ)) * SX + (wx - minX)] = g
    }
  })
  return { sx: SX, sy: SY, sz: SZ, data, palette }
}

async function parseRegion(bytes: Uint8Array, warnings: string[], onProgress?: (f: number) => void): Promise<{ model: VoxelModel; meta: Partial<ParseMeta> }> {
  const r = await readRegionSections(bytes, { onProgress: onProgress && ((f) => onProgress(f * 0.6)) })
  if (r.lz4) warnings.push(`${r.lz4} chunks usan compresión LZ4 (no compatible) y se omitieron.`)
  if (r.bad) warnings.push(`${r.bad} chunks no se pudieron leer y se omitieron.`)
  if (r.legacy) throw new FormatError('Este mundo es anterior a Minecraft 1.13 (IDs numéricos). Solo se admiten regiones 1.13+.')
  if (!r.sections.length) throw new FormatError(r.chunks ? 'La región no contiene bloques sólidos' : 'No se encontró ningún chunk en el archivo de región')
  const model = assembleSections(r.sections, undefined, onProgress && ((f) => onProgress(0.6 + f * 0.4)))
  return {
    model,
    meta: { format: 'region', formatLabel: 'Región de mundo Anvil (.mca)', version: null, dataVersion: r.maxDataVersion, regions: r.chunks }
  }
}

// ---------------------------------------------------------------- Entrada principal
export interface ParsedBuild {
  model: VoxelModel
  info: BuildInfo
}

export async function parseBuildFile(fileName: string, bytes: Uint8Array, onProgress?: (f: number) => void): Promise<ParsedBuild> {
  const warnings: string[] = []
  const ext = fileName.toLowerCase().split('.').pop() ?? ''
  if (bytes.length === 0) throw new FormatError('El archivo está vacío')
  let res: { model: VoxelModel; meta: Partial<ParseMeta> }
  if (ext === 'mca' || ext === 'mcr') {
    if (ext === 'mcr') throw new FormatError('Los archivos .mcr (formato McRegion, anterior a 1.2) no son compatibles')
    res = await parseRegion(bytes, warnings, onProgress)
  } else {
    let root: NbtCompound
    try {
      root = (await readNbt(bytes)).root
    } catch (e) {
      throw new FormatError(`No es un archivo NBT legible: ${(e as Error).message}`)
    }
    if (isCompound(root.Data) && 'LevelName' in root.Data)
      throw new FormatError('Esto es un level.dat. Para importar un mundo selecciona un archivo .mca de la carpeta "region" del mundo.')
    if (isCompound(root.Regions) && ('MinecraftDataVersion' in root || 'Metadata' in root)) res = parseLitematic(root, warnings)
    else if (isCompound(root.Schematic) || ('BlockData' in root && 'Palette' in root) || ('Version' in root && 'Width' in root && !('Materials' in root) && !(root.Blocks instanceof Int8Array)))
      res = parseSponge(root, warnings)
    else if (root.Blocks instanceof Int8Array && 'Width' in root) res = parseMcedit(root, warnings)
    else if ('size' in root && 'blocks' in root) res = parseStructure(root, warnings)
    else throw new FormatError(`Formato no reconocido. Claves encontradas: ${Object.keys(root).slice(0, 8).join(', ') || '(ninguna)'}`)
    const expected: Record<string, string[]> = { sponge: ['schem', 'schematic'], mcedit: ['schematic'], litematic: ['litematic'], structure: ['nbt'] }
    if (res.meta.format && expected[res.meta.format] && !expected[res.meta.format].includes(ext))
      warnings.push(`La extensión .${ext} no coincide con el contenido (${res.meta.formatLabel}); se usó el contenido.`)
  }
  onProgress?.(1)
  const { model } = res
  // Estadísticas reales
  const counts = new Float64Array(model.palette.length)
  const d = model.data
  for (let i = 0; i < d.length; i++) counts[d[i]]++
  let blockCount = 0
  const byName = new Map<string, number>()
  model.palette.forEach((s, i) => {
    if (!counts[i] || isAirState(s)) return
    blockCount += counts[i]
    const base = s.split('[')[0]
    byName.set(base, (byName.get(base) ?? 0) + counts[i])
  })
  const topBlocks = [...byName.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)
  const dv = res.meta.dataVersion ?? null
  const info: BuildInfo = {
    format: res.meta.format ?? 'unknown',
    formatLabel: res.meta.formatLabel ?? 'Desconocido',
    version: res.meta.version ?? null,
    dataVersion: dv,
    minecraftVersion: minecraftVersionFor(dv),
    width: model.sx,
    height: model.sy,
    length: model.sz,
    blockCount,
    paletteSize: byName.size,
    topBlocks,
    regions: res.meta.regions ?? null,
    author: res.meta.author ?? null,
    name: res.meta.name ?? null,
    warnings,
    unknownBlocks: 0
  }
  return { model, info }
}
