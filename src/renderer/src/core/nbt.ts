// Lector/escritor NBT (Named Binary Tag) de Minecraft, big-endian, sin dependencias.
// Funciona en navegador, Web Worker y Node (usa DecompressionStream para gzip/zlib).

export const enum Tag {
  End = 0,
  Byte = 1,
  Short = 2,
  Int = 3,
  Long = 4,
  Float = 5,
  Double = 6,
  ByteArray = 7,
  String = 8,
  List = 9,
  Compound = 10,
  IntArray = 11,
  LongArray = 12
}

/** Un long de 64 bits representado como dos palabras de 32 bits. */
export interface NbtLong {
  __long: true
  hi: number
  lo: number
}
/** Long array: palabras de 32 bits en orden LSB-first: words[2k] = lo(k), words[2k+1] = hi(k) */
export interface NbtLongArray {
  __longArray: true
  words: Uint32Array
  length: number
}

export type NbtValue =
  | number
  | string
  | NbtLong
  | Int8Array
  | Int32Array
  | NbtLongArray
  | NbtValue[]
  | NbtCompound
export interface NbtCompound {
  [k: string]: NbtValue
}

export class NbtError extends Error {}

const MAX_DEPTH = 512

class Reader {
  private view: DataView
  pos = 0
  private dec = new TextDecoder('utf-8')
  constructor(private bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  }
  private need(n: number): void {
    if (this.pos + n > this.bytes.byteLength) throw new NbtError('Datos NBT truncados (fin de archivo inesperado)')
  }
  u8(): number {
    this.need(1)
    return this.view.getUint8(this.pos++)
  }
  i8(): number {
    this.need(1)
    return this.view.getInt8(this.pos++)
  }
  i16(): number {
    this.need(2)
    const v = this.view.getInt16(this.pos)
    this.pos += 2
    return v
  }
  u16(): number {
    this.need(2)
    const v = this.view.getUint16(this.pos)
    this.pos += 2
    return v
  }
  i32(): number {
    this.need(4)
    const v = this.view.getInt32(this.pos)
    this.pos += 4
    return v
  }
  f32(): number {
    this.need(4)
    const v = this.view.getFloat32(this.pos)
    this.pos += 4
    return v
  }
  f64(): number {
    this.need(8)
    const v = this.view.getFloat64(this.pos)
    this.pos += 8
    return v
  }
  str(): string {
    const len = this.u16()
    this.need(len)
    const s = this.dec.decode(this.bytes.subarray(this.pos, this.pos + len))
    this.pos += len
    return s
  }
  count(): number {
    const n = this.i32()
    if (n < 0) return 0
    return n
  }
  payload(type: number, depth: number): NbtValue {
    if (depth > MAX_DEPTH) throw new NbtError('NBT demasiado anidado')
    switch (type) {
      case Tag.Byte:
        return this.i8()
      case Tag.Short:
        return this.i16()
      case Tag.Int:
        return this.i32()
      case Tag.Long: {
        const hi = this.i32() >>> 0
        const lo = this.i32() >>> 0
        return { __long: true, hi, lo }
      }
      case Tag.Float:
        return this.f32()
      case Tag.Double:
        return this.f64()
      case Tag.ByteArray: {
        const n = this.count()
        this.need(n)
        const arr = new Int8Array(n)
        arr.set(new Int8Array(this.bytes.buffer, this.bytes.byteOffset + this.pos, n))
        this.pos += n
        return arr
      }
      case Tag.String:
        return this.str()
      case Tag.List: {
        const et = this.u8()
        const n = this.count()
        if (et === Tag.End && n > 0) throw new NbtError('Lista NBT con tipo inválido')
        const list: NbtValue[] = new Array(n)
        for (let i = 0; i < n; i++) list[i] = this.payload(et, depth + 1)
        return list
      }
      case Tag.Compound: {
        const obj: NbtCompound = {}
        for (;;) {
          const t = this.u8()
          if (t === Tag.End) break
          const name = this.str()
          obj[name] = this.payload(t, depth + 1)
        }
        return obj
      }
      case Tag.IntArray: {
        const n = this.count()
        this.need(n * 4)
        const arr = new Int32Array(n)
        for (let i = 0; i < n; i++) arr[i] = this.view.getInt32(this.pos + i * 4)
        this.pos += n * 4
        return arr
      }
      case Tag.LongArray: {
        const n = this.count()
        this.need(n * 8)
        const words = new Uint32Array(n * 2)
        for (let i = 0; i < n; i++) {
          words[i * 2 + 1] = this.view.getUint32(this.pos + i * 8) // hi
          words[i * 2] = this.view.getUint32(this.pos + i * 8 + 4) // lo
        }
        this.pos += n * 8
        return { __longArray: true, words, length: n }
      }
      default:
        throw new NbtError(`Tipo de etiqueta NBT desconocido: ${type}`)
    }
  }
}

export type Compression = 'gzip' | 'zlib' | 'none'

export function detectCompression(bytes: Uint8Array): Compression {
  if (bytes.length >= 2 && bytes[0] === 0x1f && bytes[1] === 0x8b) return 'gzip'
  if (bytes.length >= 2 && bytes[0] === 0x78 && (bytes[0] * 256 + bytes[1]) % 31 === 0) return 'zlib'
  return 'none'
}

export async function decompress(bytes: Uint8Array, kind: 'gzip' | 'zlib'): Promise<Uint8Array> {
  const ds = new DecompressionStream(kind === 'gzip' ? 'gzip' : 'deflate')
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ds)
  const buf = await new Response(stream).arrayBuffer()
  return new Uint8Array(buf)
}

export async function compress(bytes: Uint8Array): Promise<Uint8Array> {
  const cs = new CompressionStream('gzip')
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(cs)
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

/** Lee un NBT sin comprimir. Devuelve el nombre y el compound raíz. */
export function readNbtRaw(bytes: Uint8Array): { name: string; root: NbtCompound } {
  const r = new Reader(bytes)
  const t = r.u8()
  if (t !== Tag.Compound) throw new NbtError('El archivo no empieza con un compound NBT (no parece un archivo NBT válido)')
  const name = r.str()
  const root = r.payload(Tag.Compound, 0) as NbtCompound
  return { name, root }
}

export async function readNbt(bytes: Uint8Array): Promise<{ name: string; root: NbtCompound; compression: Compression }> {
  const compression = detectCompression(bytes)
  let raw = bytes
  if (compression !== 'none') {
    try {
      raw = await decompress(bytes, compression)
    } catch {
      throw new NbtError(`No se pudo descomprimir el archivo (${compression}); puede estar dañado`)
    }
  }
  return { ...readNbtRaw(raw), compression }
}

// --- utilidades de acceso tipado ---
export function isCompound(v: unknown): v is NbtCompound {
  return typeof v === 'object' && v !== null && !Array.isArray(v) && !ArrayBuffer.isView(v) && !('__long' in v) && !('__longArray' in v)
}
export function num(v: unknown): number | null {
  if (typeof v === 'number') return v
  if (v && typeof v === 'object' && '__long' in v) {
    const l = v as NbtLong
    return l.hi * 4294967296 + l.lo
  }
  return null
}
export function str(v: unknown): string | null {
  return typeof v === 'string' ? v : null
}

// --- escritor (usado por los tests y la escena de demostración) ---
export type WTag =
  | { t: 'byte' | 'short' | 'int' | 'float' | 'double'; v: number }
  | { t: 'string'; v: string }
  | { t: 'byteArray'; v: Int8Array | Uint8Array }
  | { t: 'intArray'; v: Int32Array | number[] }
  | { t: 'longArray'; v: bigint[] }
  | { t: 'long'; v: bigint }
  | { t: 'list'; et: WTag['t'] | 'end'; v: WTag[] }
  | { t: 'compound'; v: Record<string, WTag> }

const TYPE_ID: Record<string, number> = {
  end: 0, byte: 1, short: 2, int: 3, long: 4, float: 5, double: 6,
  byteArray: 7, string: 8, list: 9, compound: 10, intArray: 11, longArray: 12
}

export function writeNbt(name: string, root: Record<string, WTag>): Uint8Array {
  const chunks: number[] = []
  const enc = new TextEncoder()
  const dv = new DataView(new ArrayBuffer(8))
  const push = (n: number, bytes: number, fn: (o: number, v: number) => void): void => {
    fn.call(dv, 0, n)
    for (let i = 0; i < bytes; i++) chunks.push(dv.getUint8(i))
  }
  const i8 = (n: number): void => push(n, 1, dv.setInt8)
  const i16 = (n: number): void => push(n, 2, dv.setInt16)
  const i32 = (n: number): void => push(n, 4, dv.setInt32)
  const i64 = (n: bigint): void => {
    dv.setBigInt64(0, BigInt.asIntN(64, n))
    for (let i = 0; i < 8; i++) chunks.push(dv.getUint8(i))
  }
  const s = (v: string): void => {
    const b = enc.encode(v)
    i16(b.length)
    for (const x of b) chunks.push(x)
  }
  const payload = (tag: WTag): void => {
    switch (tag.t) {
      case 'byte': return i8(tag.v)
      case 'short': return i16(tag.v)
      case 'int': return i32(tag.v)
      case 'float': return push(tag.v, 4, dv.setFloat32)
      case 'double': return push(tag.v, 8, dv.setFloat64)
      case 'long': return i64(tag.v)
      case 'string': return s(tag.v)
      case 'byteArray':
        i32(tag.v.length)
        for (const x of tag.v) chunks.push(x & 0xff)
        return
      case 'intArray':
        i32(tag.v.length)
        for (const x of tag.v) i32(x)
        return
      case 'longArray':
        i32(tag.v.length)
        for (const x of tag.v) i64(x)
        return
      case 'list':
        chunks.push(TYPE_ID[tag.et])
        i32(tag.v.length)
        for (const x of tag.v) payload(x)
        return
      case 'compound':
        for (const [k, v] of Object.entries(tag.v)) {
          chunks.push(TYPE_ID[v.t])
          s(k)
          payload(v)
        }
        chunks.push(0)
    }
  }
  chunks.push(10)
  s(name)
  payload({ t: 'compound', v: root })
  return Uint8Array.from(chunks)
}
