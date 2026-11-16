// Atlas de texturas de bloques.
// - Tile 0: textura procedural pixelada (siempre disponible; la usan los bloques sin textura).
// - Resto: texturas leídas de la copia de Minecraft del usuario o de un paquete de recursos.
import type { AtlasInfo } from '../core/mesher'

/** tamaño de cada textura en el atlas: 16 px (vanilla) hasta 64 px (paquetes HD) */
const BASE_TILE = 16
const MAX_TILE = 64
const COLS = 64

export type AtlasSource = { kind: 'procedural' } | { kind: 'minecraft'; path: string | null; label: string; count: number; packs: string[] }

interface AtlasState {
  canvas: HTMLCanvasElement
  info: AtlasInfo
  source: AtlasSource
  version: number
}

function proceduralTile(ctx: CanvasRenderingContext2D, x0: number, y0: number, tile: number): void {
  const k = tile / BASE_TILE
  let s = 1337
  const rnd = (): number => ((s = (s * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  for (let y = 0; y < BASE_TILE; y++)
    for (let x = 0; x < BASE_TILE; x++) {
      let v = 214 + rnd() * 41
      if (rnd() < 0.12) v -= 38
      if (x === 0 || y === 0) v -= 10
      ctx.fillStyle = `rgb(${v | 0},${v | 0},${v | 0})`
      ctx.fillRect(x0 + x * k, y0 + y * k, k, k)
    }
}

function makeCanvas(n: number, tile = BASE_TILE): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; rows: number } {
  const rows = Math.max(1, Math.ceil(n / COLS))
  const canvas = document.createElement('canvas')
  canvas.width = COLS * tile
  canvas.height = rows * tile
  const ctx = canvas.getContext('2d', { willReadFrequently: false })!
  ctx.imageSmoothingEnabled = false
  proceduralTile(ctx, 0, 0, tile)
  return { canvas, ctx, rows }
}

let state: AtlasState = (() => {
  const { canvas, rows } = makeCanvas(1)
  return { canvas, info: { names: ['__procedural'], cols: COLS, rows }, source: { kind: 'procedural' }, version: 0 }
})()
const listeners = new Set<() => void>()

export const atlas = {
  get: (): AtlasState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }
}
function publish(next: Omit<AtlasState, 'version'>): void {
  state = { ...next, version: state.version + 1 }
  listeners.forEach((l) => l())
}

/** Construye el atlas a partir de los PNG de textures/block. */
export async function buildAtlas(textures: { name: string; data: Uint8Array }[], source: AtlasSource, faces?: Record<string, [string, string, string]>): Promise<number> {
  const decoded: { name: string; bmp: ImageBitmap }[] = []
  await Promise.all(
    textures.map(async (t) => {
      try {
        const bmp = await createImageBitmap(new Blob([t.data as BlobPart], { type: 'image/png' }))
        decoded.push({ name: t.name, bmp })
      } catch {
        /* PNG ilegible: se ignora */
      }
    })
  )
  decoded.sort((a, b) => a.name.localeCompare(b.name))
  // resolución del atlas: la mayor de las texturas cargadas (potencia de 2, 16–64 px)
  const maxSide = decoded.reduce((m, d) => Math.max(m, Math.min(d.bmp.width, d.bmp.height)), BASE_TILE)
  const TILE = Math.min(MAX_TILE, 2 ** Math.ceil(Math.log2(maxSide)))
  const { canvas, ctx, rows } = makeCanvas(decoded.length + 1, TILE)
  const names = ['__procedural']
  decoded.forEach(({ name, bmp }, i) => {
    const idx = i + 1
    const x = (idx % COLS) * TILE, y = Math.floor(idx / COLS) * TILE
    const side = Math.min(bmp.width, bmp.height) // texturas animadas: primer fotograma
    if (name.endsWith('_leaves')) {
      // hojas en modo "rápido": los huecos transparentes se rellenan con un tono oscuro
      ctx.fillStyle = '#505050'
      ctx.fillRect(x, y, TILE, TILE)
    }
    ctx.drawImage(bmp, 0, 0, side, side, x, y, TILE, TILE)
    bmp.close()
    names.push(name)
  })
  publish({ canvas, info: { names, cols: COLS, rows, faces }, source })
  return decoded.length
}

export function resetAtlas(): void {
  const { canvas, rows } = makeCanvas(1)
  publish({ canvas, info: { names: ['__procedural'], cols: COLS, rows }, source: { kind: 'procedural' } })
}
