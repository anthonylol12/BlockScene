// Fuente de mapa de bits de Minecraft leída de la copia del usuario (textures/font/*.png + font/default.json).
// Admite varios proveedores (ascii, acentos, latín extendido) con su altura y línea base,
// y se dibuja píxel a píxel con la sombra característica del juego.

export const MC_FONT = '__minecraft'

interface Glyph {
  sheet: number
  sx: number
  sy: number
  sw: number
  ch: number
  height: number
  ascent: number
}
let sheets: HTMLCanvasElement[] = []
let glyphs = new Map<string, Glyph>()
const tinted = new Map<string, HTMLCanvasElement>()
const listeners = new Set<() => void>()

export const mcFontReady = (): boolean => glyphs.size > 0
export function onMcFont(fn: () => void): () => void {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

const ASCII_ROWS = Array.from({ length: 16 }, (_, r) => Array.from({ length: 16 }, (_, c) => String.fromCharCode(r * 16 + c)).join(''))

export async function loadMcFont(basePath: string | null): Promise<boolean> {
  const list = await window.api.mcFont(basePath)
  if (!list?.length) return false
  const nextSheets: HTMLCanvasElement[] = []
  const next = new Map<string, Glyph>()
  for (const p of list) {
    const bmp = await createImageBitmap(new Blob([p.png as BlobPart], { type: 'image/png' }))
    const c = document.createElement('canvas')
    c.width = bmp.width
    c.height = bmp.height
    const ctx = c.getContext('2d', { willReadFrequently: true })!
    ctx.drawImage(bmp, 0, 0)
    bmp.close()
    const rows = p.chars ?? ASCII_ROWS
    const cols = Math.max(...rows.map((r) => [...r].length))
    const cw = c.width / cols, ch = c.height / rows.length
    const px = ctx.getImageData(0, 0, c.width, c.height).data
    const si = nextSheets.length
    nextSheets.push(c)
    rows.forEach((row, ri) => {
      ;[...row].forEach((chr, ci) => {
        if (chr === '\u0000' || next.has(chr)) return
        let w = 0
        for (let x = Math.floor(cw) - 1; x >= 0 && !w; x--)
          for (let y = 0; y < ch; y++)
            if (px[((Math.floor(ri * ch) + y) * c.width + Math.floor(ci * cw) + x) * 4 + 3] > 0) {
              w = x + 1
              break
            }
        if (!w && chr !== ' ') return
        next.set(chr, { sheet: si, sx: Math.floor(ci * cw), sy: Math.floor(ri * ch), sw: w, ch, height: p.height, ascent: p.ascent })
      })
    })
  }
  sheets = nextSheets
  glyphs = next
  tinted.clear()
  listeners.forEach((l) => l())
  return true
}

function tint(sheet: number, color: string): HTMLCanvasElement {
  const key = `${sheet}|${color}`
  let c = tinted.get(key)
  if (c) return c
  const src = sheets[sheet]
  c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const x = c.getContext('2d')!
  x.drawImage(src, 0, 0)
  x.globalCompositeOperation = 'source-in'
  x.fillStyle = color
  x.fillRect(0, 0, c.width, c.height)
  tinted.set(key, c)
  return c
}

const glyph = (chr: string): Glyph | undefined =>
  glyphs.get(chr) ?? glyphs.get(chr.normalize('NFD').replace(/[̀-ͯ]/g, '')) ?? glyphs.get('?')

/** Avance horizontal de un carácter, en píxeles de la lámina, para una altura de letra `size` (8 px de diseño). */
function advance(chr: string, size: number): number {
  const u = size / 8
  if (chr === ' ') return 4 * u
  const g = glyph(chr)
  if (!g) return 0
  return g.sw * ((g.height * u) / g.ch) + u
}

export function mcMeasure(text: string, size: number): number {
  let w = 0
  for (const chr of text) w += advance(chr, size)
  return w
}

export function mcWrap(text: string, size: number, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/)) {
      const test = line ? `${line} ${word}` : word
      if (mcMeasure(test, size) > maxW && line) {
        out.push(line)
        line = word
      } else line = test
    }
    out.push(line)
  }
  return out
}

/** Dibuja una línea con la sombra del juego (desplazada 1 píxel de fuente, al 25 % de brillo). */
export function mcDrawLine(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, shadow: boolean): void {
  if (!glyphs.size) return
  const u = size / 8
  const prev = ctx.imageSmoothingEnabled
  ctx.imageSmoothingEnabled = false
  const draw = (col: string, ox: number, oy: number): void => {
    let cx = x + ox
    for (const chr of text) {
      const g = chr === ' ' ? undefined : glyph(chr)
      if (g && g.sw > 0) {
        const k = (g.height * u) / g.ch
        ctx.drawImage(tint(g.sheet, col), g.sx, g.sy, g.sw, g.ch, cx, y + oy + (7 - g.ascent) * u, g.sw * k, g.height * u)
      }
      cx += advance(chr, size)
    }
  }
  if (shadow) {
    const c = color.replace('#', '')
    const n = parseInt(c.length === 3 ? c.split('').map((v) => v + v).join('') : c, 16)
    draw(`rgb(${((n >> 16) & 255) >> 2},${((n >> 8) & 255) >> 2},${(n & 255) >> 2})`, u, u)
  }
  draw(color, 0, 0)
  ctx.imageSmoothingEnabled = prev
}
