// Lectura de recursos de Minecraft desde la copia del propio usuario (.jar de la versión)
// y de paquetes de recursos (.zip). Nada de esto se copia al proyecto ni se redistribuye.
import { promises as fs } from 'node:fs'
import { join } from 'node:path'
import { inflateRawSync } from 'node:zlib'

const BLOCK_PREFIX = 'assets/minecraft/textures/block/'
export const FONT_PATH = 'assets/minecraft/textures/font/ascii.png'

export interface BlockTexture {
  name: string
  data: Uint8Array
}

interface ZipEntry {
  name: string
  method: number
  csize: number
  local: number
}

async function zipIndex(path: string): Promise<{ buf: Buffer; entries: ZipEntry[] }> {
  const buf = await fs.readFile(path)
  let eocd = -1
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) throw new Error('El archivo no es un .jar o .zip válido')
  const count = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const entries: ZipEntry[] = []
  for (let k = 0; k < count; k++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Directorio del ZIP dañado')
    const nlen = buf.readUInt16LE(p + 28)
    entries.push({
      method: buf.readUInt16LE(p + 10),
      csize: buf.readUInt32LE(p + 20),
      local: buf.readUInt32LE(p + 42),
      name: buf.toString('utf8', p + 46, p + 46 + nlen)
    })
    p += 46 + nlen + buf.readUInt16LE(p + 30) + buf.readUInt16LE(p + 32)
  }
  return { buf, entries }
}

function extract(buf: Buffer, e: ZipEntry): Uint8Array | null {
  const start = e.local + 30 + buf.readUInt16LE(e.local + 26) + buf.readUInt16LE(e.local + 28)
  const raw = buf.subarray(start, start + e.csize)
  const data = e.method === 0 ? Buffer.from(raw) : e.method === 8 ? inflateRawSync(raw) : null
  return data ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength) : null
}

export async function listZipNames(path: string): Promise<string[]> {
  return (await zipIndex(path)).entries.map((e) => e.name)
}

/** Texturas de bloques de un .jar o paquete de recursos (los paquetes pueden tener solo algunas). */
export async function readBlockTextures(path: string): Promise<BlockTexture[]> {
  const { buf, entries } = await zipIndex(path)
  const out: BlockTexture[] = []
  for (const e of entries) {
    if (!e.name.startsWith(BLOCK_PREFIX) || !e.name.endsWith('.png') || e.name.slice(BLOCK_PREFIX.length).includes('/')) continue
    const data = extract(buf, e)
    if (data) out.push({ name: e.name.slice(BLOCK_PREFIX.length, -4), data })
  }
  return out
}

/** JSON de blockstates y modelos de bloque (para saber qué textura lleva cada cara). */
export async function readBlockModels(path: string): Promise<{ states: Record<string, unknown>; models: Record<string, unknown> }> {
  const { buf, entries } = await zipIndex(path)
  const states: Record<string, unknown> = {}
  const models: Record<string, unknown> = {}
  for (const e of entries) {
    const st = /^assets\/minecraft\/blockstates\/([^/]+)\.json$/.exec(e.name)
    const mo = /^assets\/minecraft\/models\/block\/([^/]+)\.json$/.exec(e.name)
    if (!st && !mo) continue
    const data = extract(buf, e)
    if (!data) continue
    try {
      const json = JSON.parse(Buffer.from(data).toString('utf8'))
      if (st) states[st[1]] = json
      else if (mo) models[mo[1]] = json
    } catch {
      /* JSON con comentarios o dañado: se ignora */
    }
  }
  return { states, models }
}

export async function readZipFile(path: string, name: string): Promise<Uint8Array | null> {
  const { buf, entries } = await zipIndex(path)
  const e = entries.find((x) => x.name === name)
  return e ? extract(buf, e) : null
}

/** Busca las versiones instaladas en %APPDATA%/.minecraft/versions (las más recientes primero). */
export async function findInstallations(appData: string): Promise<{ version: string; path: string }[]> {
  const dir = join(appData, '.minecraft', 'versions')
  let names: string[] = []
  try {
    names = await fs.readdir(dir)
  } catch {
    return []
  }
  const found: { version: string; path: string; mtime: number }[] = []
  for (const n of names) {
    const jar = join(dir, n, `${n}.jar`)
    try {
      const st = await fs.stat(jar)
      if (st.size > 1_000_000) found.push({ version: n, path: jar, mtime: st.mtimeMs })
    } catch {
      /* sin jar */
    }
  }
  const ver = (v: string): number[] => (v.match(/\d+/g) ?? []).map(Number)
  const isRelease = (v: string): boolean => /^\d+\.\d+(\.\d+)?$/.test(v)
  found.sort((a, b) => {
    if (isRelease(a.version) !== isRelease(b.version)) return isRelease(a.version) ? -1 : 1
    const va = ver(a.version), vb = ver(b.version)
    for (let i = 0; i < 3; i++) if ((va[i] ?? 0) !== (vb[i] ?? 0)) return (vb[i] ?? 0) - (va[i] ?? 0)
    return b.mtime - a.mtime
  })
  return found.map(({ version, path }) => ({ version, path }))
}

/** Paquetes de recursos .zip presentes en la carpeta resourcepacks de Minecraft. */
export async function findMinecraftPacks(appData: string): Promise<{ name: string; path: string }[]> {
  const dir = join(appData, '.minecraft', 'resourcepacks')
  try {
    return (await fs.readdir(dir)).filter((n) => n.toLowerCase().endsWith('.zip')).map((n) => ({ name: n, path: join(dir, n) }))
  } catch {
    return []
  }
}
