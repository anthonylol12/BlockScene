// Importación de mundos de Minecraft (Java 1.13+): se lee level.dat, se eligen los archivos de región que
// cubren el área pedida y se extraen solo esos bloques. El resultado se guarda como un .schem (Sponge v2)
// real, de modo que el proyecto lo conserva y se puede volver a abrir sin el mundo original.
import { compress, isCompound, num, readNbt, str, type NbtCompound } from './nbt'
import { assembleSections, readRegionSections, type RegionSection, type VoxelModel } from './formats'

export type Dimension = 'overworld' | 'nether' | 'end'
export const DIMENSION_LABEL: Record<Dimension, string> = { overworld: 'Mundo normal', nether: 'Nether', end: 'El End' }

export interface LevelInfo {
  name: string
  version: string | null
  dataVersion: number | null
  spawn: { x: number; y: number; z: number }
}

/** Lee el nombre, la versión y el punto de aparición de level.dat (formatos antiguos y 1.21.9+). */
export async function parseLevelDat(bytes: Uint8Array): Promise<LevelInfo> {
  const { root } = await readNbt(bytes)
  const data = (isCompound(root.Data) ? root.Data : root) as NbtCompound
  const ver = isCompound(data.Version) ? data.Version : null
  let spawn = { x: num(data.SpawnX) ?? 0, y: num(data.SpawnY) ?? 64, z: num(data.SpawnZ) ?? 0 }
  const sp = data.spawn
  if (isCompound(sp)) {
    const pos = sp.pos as unknown
    const arr = pos instanceof Int32Array ? Array.from(pos) : Array.isArray(pos) ? (pos as unknown[]).map((v) => num(v) ?? 0) : null
    if (arr && arr.length >= 3) spawn = { x: arr[0], y: arr[1], z: arr[2] }
  }
  return {
    name: str(data.LevelName) ?? 'Mundo',
    version: ver ? str(ver.Name) : null,
    dataVersion: num(data.DataVersion),
    spawn
  }
}

export interface WorldArea {
  /** centro en coordenadas de bloque */
  cx: number
  cz: number
  /** radio horizontal en bloques (zona cuadrada de 2r × 2r) */
  radius: number
  yMin: number
  yMax: number
}

export const areaBounds = (a: WorldArea): { x0: number; x1: number; y0: number; y1: number; z0: number; z1: number } => ({
  x0: Math.floor(a.cx - a.radius), x1: Math.floor(a.cx + a.radius) - 1,
  z0: Math.floor(a.cz - a.radius), z1: Math.floor(a.cz + a.radius) - 1,
  y0: Math.min(a.yMin, a.yMax), y1: Math.max(a.yMin, a.yMax)
})

/** Archivos r.X.Z.mca que cubren el área. */
export function regionsForArea(a: WorldArea): { rx: number; rz: number; file: string }[] {
  const b = areaBounds(a)
  const out: { rx: number; rz: number; file: string }[] = []
  for (let rx = Math.floor(b.x0 / 512); rx <= Math.floor(b.x1 / 512); rx++)
    for (let rz = Math.floor(b.z0 / 512); rz <= Math.floor(b.z1 / 512); rz++) out.push({ rx, rz, file: `r.${rx}.${rz}.mca` })
  return out
}

/** Extrae los bloques del área a partir de los archivos de región (los que falten se ignoran). */
export async function extractArea(regions: { file: string; data: Uint8Array | null }[], a: WorldArea, onProgress?: (f: number, label: string) => void): Promise<{ model: VoxelModel; chunks: number; warnings: string[]; dataVersion: number | null }> {
  const b = areaBounds(a)
  const cx0 = Math.floor(b.x0 / 16), cx1 = Math.floor(b.x1 / 16), cz0 = Math.floor(b.z0 / 16), cz1 = Math.floor(b.z1 / 16)
  const sections: RegionSection[] = []
  const warnings: string[] = []
  let chunks = 0, lz4 = 0, bad = 0, legacy = 0, dv: number | null = null
  const present = regions.filter((r) => r.data)
  if (!present.length) throw new Error('No hay archivos de región en esa zona: probablemente nadie ha explorado esas coordenadas en el mundo.')
  for (let i = 0; i < present.length; i++) {
    const r = present[i]
    onProgress?.(i / present.length * 0.8, `Leyendo ${r.file} (${i + 1} de ${present.length})`)
    const res = await readRegionSections(r.data!, {
      chunkFilter: (x, z) => x >= cx0 && x <= cx1 && z >= cz0 && z <= cz1,
      yMin: b.y0, yMax: b.y1,
      onProgress: (f) => onProgress?.((i + f) / present.length * 0.8, `Leyendo ${r.file} (${i + 1} de ${present.length})`)
    })
    sections.push(...res.sections)
    chunks += res.chunks; lz4 += res.lz4; bad += res.bad; legacy += res.legacy
    if (res.maxDataVersion != null) dv = Math.max(dv ?? 0, res.maxDataVersion)
  }
  if (legacy) throw new Error('Este mundo es anterior a Minecraft 1.13: ábrelo una vez en una versión moderna para convertirlo y vuelve a intentarlo.')
  if (lz4) warnings.push(`${lz4} chunks usan compresión LZ4 (no compatible) y se omitieron.`)
  if (bad) warnings.push(`${bad} chunks no se pudieron leer y se omitieron.`)
  const missing = regions.length - present.length
  if (missing) warnings.push(`${missing} archivo(s) de región de la zona no existen (terreno sin generar).`)
  if (!sections.length) throw new Error(chunks ? 'La zona elegida no tiene bloques en ese rango de alturas.' : 'No hay chunks generados en esa zona del mundo.')
  onProgress?.(0.85, 'Uniendo chunks')
  const model = assembleSections(sections, b, (f) => onProgress?.(0.85 + f * 0.1, 'Uniendo chunks'))
  return { model, chunks, warnings, dataVersion: dv }
}

/** Escribe el modelo como Sponge Schematic v2 comprimido (.schem), sin pasar por arrays intermedios enormes. */
export async function writeSchem(model: VoxelModel, opts: { name: string; dataVersion: number | null; offset?: [number, number, number] }): Promise<Uint8Array> {
  if (model.sx > 65535 || model.sy > 65535 || model.sz > 65535) throw new Error('La zona es demasiado grande para un .schem')
  let buf = new Uint8Array(1 << 20)
  let p = 0
  const ensure = (n: number): void => {
    if (p + n <= buf.length) return
    let cap = buf.length * 2
    while (cap < p + n) cap *= 2
    const nb = new Uint8Array(cap)
    nb.set(buf.subarray(0, p))
    buf = nb
  }
  const u8 = (v: number): void => { ensure(1); buf[p++] = v & 255 }
  const i16 = (v: number): void => { ensure(2); buf[p++] = (v >> 8) & 255; buf[p++] = v & 255 }
  const i32 = (v: number): void => { ensure(4); buf[p++] = (v >>> 24) & 255; buf[p++] = (v >> 16) & 255; buf[p++] = (v >> 8) & 255; buf[p++] = v & 255 }
  const enc = new TextEncoder()
  const s = (v: string): void => { const b = enc.encode(v); i16(b.length); ensure(b.length); buf.set(b, p); p += b.length }
  const tag = (type: number, name: string): void => { u8(type); s(name) }
  // TAG_Compound "Schematic"
  tag(10, 'Schematic')
  tag(3, 'Version'); i32(2)
  tag(3, 'DataVersion'); i32(opts.dataVersion ?? 3953)
  tag(2, 'Width'); i16(model.sx)
  tag(2, 'Height'); i16(model.sy)
  tag(2, 'Length'); i16(model.sz)
  tag(11, 'Offset'); i32(3); for (const v of opts.offset ?? [0, 0, 0]) i32(v)
  tag(10, 'Metadata'); tag(8, 'Name'); s(opts.name); tag(8, 'Author'); s('BlockScene'); u8(0)
  tag(3, 'PaletteMax'); i32(model.palette.length)
  tag(10, 'Palette')
  model.palette.forEach((st, i) => { tag(3, st); i32(i) })
  u8(0)
  // BlockData: varints; el orden de Sponge (y, z, x) coincide con el del modelo
  let len = 0
  for (const v of model.data) len += v < 128 ? 1 : v < 16384 ? 2 : 3
  tag(7, 'BlockData'); i32(len)
  ensure(len)
  for (const v0 of model.data) {
    let v = v0
    while (v & ~0x7f) { buf[p++] = (v & 0x7f) | 0x80; v >>>= 7 }
    buf[p++] = v
  }
  u8(0) // fin de Schematic
  return compress(buf.subarray(0, p))
}
