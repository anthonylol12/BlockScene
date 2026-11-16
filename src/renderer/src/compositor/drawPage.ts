// Dibujo de una lámina en Canvas 2D. Se usa tanto para la vista previa del editor como para la exportación,
// de modo que lo que se ve es exactamente lo que se exporta (salvo guías y huecos vacíos, que solo ve el editor).
import type { CompElement, Composition } from '@shared/types'
import { MC_FONT, mcDrawLine, mcFontReady, mcMeasure, mcWrap } from './mcFont'

const cache = new Map<string, HTMLImageElement>()
const waiters = new Set<() => void>()

/** Imagen desde data URL con caché; avisa a los suscriptores cuando termina de cargar. */
export function getImage(key: string, src: string | undefined): HTMLImageElement | null {
  if (!src) return null
  let img = cache.get(key)
  if (!img) {
    img = new Image()
    img.onload = () => waiters.forEach((w) => w())
    img.src = src
    cache.set(key, img)
  }
  return img.complete && img.naturalWidth ? img : null
}
export function onImagesLoaded(fn: () => void): () => void {
  waiters.add(fn)
  return () => waiters.delete(fn)
}
export async function loadImage(key: string, src: string): Promise<HTMLImageElement> {
  const img = getImage(key, src)
  if (img) return img
  const el = cache.get(key)!
  await el.decode().catch(() => {
    throw new Error('No se pudo decodificar una de las imágenes de la lámina')
  })
  return el
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number): void {
  const rr = Math.max(0, Math.min(r, w / 2, h / 2))
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, rr)
}

export function wrapText(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  for (const para of text.split('\n')) {
    const words = para.split(/\s+/)
    let line = ''
    for (const w of words) {
      const test = line ? `${line} ${w}` : w
      if (ctx.measureText(test).width > maxW && line) {
        out.push(line)
        line = w
      } else line = test
    }
    out.push(line)
  }
  return out
}

export interface DrawOptions {
  editor: boolean
  resolve: (imageId: string) => HTMLImageElement | null
}

function drawElement(ctx: CanvasRenderingContext2D, el: CompElement, o: DrawOptions): void {
  ctx.save()
  ctx.globalAlpha = el.opacity
  ctx.translate(el.x + el.w / 2, el.y + el.h / 2)
  if (el.rotation) ctx.rotate((el.rotation * Math.PI) / 180)
  const x = -el.w / 2, y = -el.h / 2
  if (el.type === 'rect') {
    roundRect(ctx, x, y, el.w, el.h, el.radius ?? 0)
    if (el.fill && el.fill !== 'none') {
      ctx.fillStyle = el.fill
      ctx.fill()
    }
    if (el.stroke && (el.strokeWidth ?? 0) > 0) {
      ctx.strokeStyle = el.stroke
      ctx.lineWidth = el.strokeWidth!
      ctx.stroke()
    }
  } else if (el.type === 'image') {
    const img = el.imageId ? o.resolve(el.imageId) : null
    if (img) {
      const ir = img.naturalWidth / img.naturalHeight, br = el.w / el.h
      let dw = el.w, dh = el.h
      if ((el.fit ?? 'contain') === 'contain') {
        if (ir > br) dh = el.w / ir
        else dw = el.h * ir
      } else {
        if (ir > br) dw = el.h * ir
        else dh = el.w / ir
      }
      if (el.shadow) {
        ctx.shadowColor = 'rgba(0,0,0,0.45)'
        ctx.shadowBlur = Math.max(el.w, el.h) * 0.04
        ctx.shadowOffsetY = Math.max(el.w, el.h) * 0.015
      }
      if (el.fit === 'cover') {
        roundRect(ctx, x, y, el.w, el.h, el.radius ?? 0)
        ctx.clip()
      }
      ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh)
    } else if (o.editor) {
      ctx.setLineDash([12, 8])
      ctx.lineWidth = Math.max(2, el.w / 300)
      ctx.strokeStyle = 'rgba(140,170,220,0.7)'
      ctx.fillStyle = 'rgba(76,157,255,0.06)'
      ctx.fillRect(x, y, el.w, el.h)
      ctx.strokeRect(x, y, el.w, el.h)
      ctx.setLineDash([])
      ctx.fillStyle = 'rgba(170,190,230,0.85)'
      ctx.font = `600 ${Math.max(14, Math.min(el.w, el.h) * 0.07)}px "Segoe UI"`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(el.imageId ? 'Imagen no disponible' : 'Arrastra un render aquí', 0, 0)
    }
  } else if (el.type === 'text' && el.style && el.style.font === MC_FONT && mcFontReady()) {
    // fuente de Minecraft (mapa de bits) con su sombra
    const s = el.style
    const text = s.uppercase ? (el.text ?? '').toUpperCase() : (el.text ?? '')
    const lh = s.size * s.lineHeight
    mcWrap(text, s.size, el.w).forEach((ln, i) => {
      const w = mcMeasure(ln, s.size)
      const tx = s.align === 'left' ? x : s.align === 'right' ? x + el.w - w : -w / 2
      mcDrawLine(ctx, ln, tx, y + i * lh + (lh - s.size) / 2, s.size, s.color, true)
    })
  } else if (el.type === 'text' && el.style) {
    const s = el.style
    ctx.font = `${s.italic ? 'italic ' : ''}${s.weight} ${s.size}px "${s.font}", "Segoe UI", sans-serif`
    ;(ctx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${s.letterSpacing}px`
    ctx.fillStyle = s.color
    ctx.textBaseline = 'top'
    ctx.textAlign = s.align
    const text = s.uppercase ? (el.text ?? '').toUpperCase() : (el.text ?? '')
    if (el.shadow) {
      ctx.shadowColor = 'rgba(0,0,0,0.35)'
      ctx.shadowBlur = s.size * 0.12
      ctx.shadowOffsetY = s.size * 0.05
    }
    const lines = wrapText(ctx, text, el.w)
    const lh = s.size * s.lineHeight
    const tx = s.align === 'left' ? x : s.align === 'right' ? x + el.w : 0
    lines.forEach((ln, i) => ctx.fillText(ln, tx, y + i * lh + (lh - s.size) / 2))
  }
  ctx.restore()
}

export function drawComposition(ctx: CanvasRenderingContext2D, comp: Composition, scale: number, o: DrawOptions): void {
  const { width: W, height: H } = comp.page
  ctx.save()
  ctx.scale(scale, scale)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  const bg = comp.background
  if (bg.type === 'solid') ctx.fillStyle = bg.color1
  else if (bg.type === 'linear') {
    const a = (bg.angle * Math.PI) / 180
    const r = Math.abs(W * Math.cos(a)) / 2 + Math.abs(H * Math.sin(a)) / 2
    const g = ctx.createLinearGradient(W / 2 - Math.cos(a) * r, H / 2 - Math.sin(a) * r, W / 2 + Math.cos(a) * r, H / 2 + Math.sin(a) * r)
    g.addColorStop(0, bg.color1)
    g.addColorStop(1, bg.color2)
    ctx.fillStyle = g
  } else {
    const g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.hypot(W, H) / 2)
    g.addColorStop(0, bg.color1)
    g.addColorStop(1, bg.color2)
    ctx.fillStyle = g
  }
  ctx.fillRect(0, 0, W, H)
  for (const el of comp.elements) if (el.visible) drawElement(ctx, el, o)
  if (o.editor && comp.showGuides) {
    const lw = 1.5 / scale
    ctx.lineWidth = lw
    ctx.setLineDash([8 / scale, 6 / scale])
    ctx.strokeStyle = 'rgba(80,200,255,0.75)'
    ctx.strokeRect(comp.margin, comp.margin, W - comp.margin * 2, H - comp.margin * 2)
    if (comp.safeZone > 0) {
      ctx.strokeStyle = 'rgba(255,170,60,0.65)'
      ctx.strokeRect(comp.safeZone, comp.safeZone, W - comp.safeZone * 2, H - comp.safeZone * 2)
    }
    ctx.setLineDash([])
    ctx.strokeStyle = 'rgba(80,200,255,0.25)'
    ctx.beginPath()
    ctx.moveTo(W / 2, 0)
    ctx.lineTo(W / 2, H)
    ctx.moveTo(0, H / 2)
    ctx.lineTo(W, H / 2)
    ctx.stroke()
  }
  ctx.restore()
}
