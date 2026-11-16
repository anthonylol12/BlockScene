// Plantillas iniciales de lámina. Los textos son marcadores editables; los datos técnicos
// solo se rellenan a partir de información REAL de las construcciones (renders aislados).
import type { CompElement, Composition, RenderItem, TextStyle } from '@shared/types'
import { blankComposition, uid } from '../state/defaults'
import { fmtInt } from '../ui/controls'
import { wrapText } from './drawPage'
import { MC_FONT, mcFontReady, mcWrap } from './mcFont'

let measureCtx: CanvasRenderingContext2D | null = null
/** Líneas reales que ocupará el texto con el ajuste de línea del lienzo. */
function lineCount(text: string, st: TextStyle, w: number): number {
  if (st.font === MC_FONT && mcFontReady()) return Math.max(1, mcWrap(st.uppercase ? text.toUpperCase() : text, st.size, w).length)
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (!measureCtx) return Math.max(1, text.split('\n').length)
  measureCtx.font = `${st.italic ? 'italic ' : ''}${st.weight} ${st.size}px "${st.font}", "Segoe UI", sans-serif`
  ;(measureCtx as CanvasRenderingContext2D & { letterSpacing: string }).letterSpacing = `${st.letterSpacing}px`
  return Math.max(1, wrapText(measureCtx, st.uppercase ? text.toUpperCase() : text, w).length)
}

export type TemplateId = 'showcase' | 'collection' | 'bundle' | 'catalog' | 'poster' | 'sheet'
export const TEMPLATES: { id: TemplateId; name: string; desc: string }[] = [
  { id: 'collection', name: 'Colección con etiquetas', desc: 'Título en fuente pixelada, cuadrícula con el nombre de cada construcción y una pieza destacada. Usa renders con «Fondo transparente».' },
  { id: 'bundle', name: 'Paquete de construcciones', desc: 'Gran título blanco con sombra y cuadrícula limpia de construcciones, con marca de agua. Usa renders con «Fondo transparente».' },
  { id: 'showcase', name: 'Exhibición', desc: 'Render a pantalla completa con título arriba a la izquierda y créditos abajo a la derecha (fuente de Minecraft).' },
  { id: 'catalog', name: 'Catálogo limpio', desc: 'Cuadrícula de construcciones con nombre y datos.' },
  { id: 'poster', name: 'Póster de colección', desc: 'Imagen principal grande, miniaturas y título destacado.' },
  { id: 'sheet', name: 'Ficha individual', desc: 'Una construcción con su ficha técnica.' }
]

export const ROLE_STYLE: Record<TextStyle['role'], Omit<TextStyle, 'size' | 'font'> & { rel: number; heading: boolean }> = {
  title: { role: 'title', weight: 700, italic: false, color: '#ffffff', align: 'left', letterSpacing: 0, lineHeight: 1.1, uppercase: false, rel: 0.055, heading: true },
  subtitle: { role: 'subtitle', weight: 400, italic: false, color: '#b9c3d6', align: 'left', letterSpacing: 0, lineHeight: 1.3, uppercase: false, rel: 0.026, heading: true },
  label: { role: 'label', weight: 600, italic: false, color: '#e9eef7', align: 'left', letterSpacing: 0.5, lineHeight: 1.3, uppercase: false, rel: 0.017, heading: false },
  body: { role: 'body', weight: 400, italic: false, color: '#c9d1df', align: 'left', letterSpacing: 0, lineHeight: 1.5, uppercase: false, rel: 0.015, heading: false },
  credits: { role: 'credits', weight: 400, italic: false, color: '#8792a6', align: 'left', letterSpacing: 0.5, lineHeight: 1.3, uppercase: false, rel: 0.012, heading: false },
  watermark: { role: 'watermark', weight: 700, italic: false, color: '#ffffff', align: 'right', letterSpacing: 3, lineHeight: 1.2, uppercase: true, rel: 0.014, heading: false }
}

export function textEl(comp: Composition, role: TextStyle['role'], text: string, x: number, y: number, w: number, extra: Partial<TextStyle> = {}): CompElement {
  const base = Math.min(comp.page.width, comp.page.height * 1.6)
  const r = ROLE_STYLE[role]
  const { rel, heading, ...rest } = r
  const size = Math.round(base * rel)
  const style: TextStyle = { ...rest, size, font: heading ? comp.fonts.heading : comp.fonts.body, ...extra }
  const lines = lineCount(text, style, w)
  return {
    id: uid('el'), type: 'text', name: { title: 'Título', subtitle: 'Subtítulo', label: 'Etiqueta', body: 'Texto', credits: 'Créditos', watermark: 'Marca de agua' }[role],
    x, y, w, h: Math.round(style.size * style.lineHeight * lines + 4), rotation: 0, opacity: role === 'watermark' ? 0.45 : 1, locked: false, visible: true,
    text, style
  }
}

export function imageEl(x: number, y: number, w: number, h: number, imageId: string | null, extra: Partial<CompElement> = {}): CompElement {
  return { id: uid('el'), type: 'image', name: 'Imagen', x, y, w, h, rotation: 0, opacity: 1, locked: false, visible: true, imageId, fit: 'contain', shadow: true, radius: 0, ...extra }
}

export function rectEl(x: number, y: number, w: number, h: number, fill: string, extra: Partial<CompElement> = {}): CompElement {
  return { id: uid('el'), type: 'rect', name: 'Marco', x, y, w, h, rotation: 0, opacity: 1, locked: false, visible: true, fill, radius: 12, stroke: '#ffffff', strokeWidth: 0, ...extra }
}

const infoLine = (r: RenderItem | undefined): string => {
  const i = r?.buildInfo
  if (!i) return ''
  return `${i.width}×${i.height}×${i.length} · ${fmtInt(i.blockCount)} bloques`
}

export function buildTemplate(id: TemplateId, page: Composition['page'], renders: RenderItem[]): Composition {
  const c = blankComposition(TEMPLATES.find((t) => t.id === id)!.name)
  c.page = { ...page }
  const W = page.width, H = page.height
  const m = Math.round(Math.min(W, H) * 0.06)
  c.margin = m
  c.safeZone = Math.round(m * 0.5)
  const els: CompElement[] = []
  const date = new Date().toLocaleDateString('es-ES', { year: 'numeric', month: 'long' })

  if (id === 'showcase') {
    c.background = { type: 'solid', color1: '#141210', color2: '#141210', angle: 0 }
    const r = renders[0]
    els.push(imageEl(0, 0, W, H, r?.id ?? null, { name: 'Render', fit: 'cover', shadow: false }))
    const pad = Math.round(Math.min(W, H) * 0.045)
    els.push(textEl(c, 'title', r?.name ?? 'Nombre de la construcción', pad, pad, W * 0.6, { font: MC_FONT, color: '#ffffff', size: Math.round(H * 0.045), weight: 400 }))
    const cr = textEl(c, 'credits', 'Construcción original de · edita este texto', W - pad - W * 0.6, H - pad, W * 0.6, { font: MC_FONT, color: '#e8e8e8', size: Math.round(H * 0.021), align: 'right', letterSpacing: 0 })
    els.push(cr)
    c.margin = pad
    c.safeZone = Math.round(pad * 0.5)
  } else if (id === 'collection') {
    // hoja de colección: título en fuente pixelada, cuadrícula con etiquetas y una pieza destacada a la derecha
    c.background = { type: 'radial', color1: '#d3c5a4', color2: '#bcac8a', angle: 0 }
    const ink = '#3a3226'
    const title = textEl(c, 'title', 'Nombre de la colección', m, m * 0.6, W - m * 2, { font: MC_FONT, color: '#f3a33e', align: 'center', size: Math.round(Math.min(W, H) * 0.06), weight: 400 })
    els.push(title)
    els.push(rectEl(W * 0.35, title.y + title.h + m * 0.15, W * 0.3, Math.max(3, Math.round(m * 0.05)), ink, { name: 'Separador', radius: 2, opacity: 0.6 }))
    const sub = textEl(c, 'subtitle', 'Colección', m, title.y + title.h + m * 0.35, W - m * 2, { font: MC_FONT, color: '#f3a33e', align: 'center', size: Math.round(Math.min(W, H) * 0.045), weight: 400 })
    els.push(sub)
    const top = sub.y + sub.h + m * 0.5
    const heroW = (W - m * 2) * 0.42
    const gridW = W - m * 2 - heroW - m * 0.5
    const small = renders.slice(1, 7)
    const n = small.length || (renders.length ? 0 : 4)
    const cols = 2
    const rows = Math.max(1, Math.ceil(n / cols))
    const labelSize = Math.round(Math.min(W, H) * 0.022)
    const cellH = (H - top - m) / rows
    const cellW = gridW / cols
    for (let i = 0; i < n; i++) {
      const cx = m + (i % cols) * cellW, cy = top + Math.floor(i / cols) * cellH
      const r = small[i]
      els.push(imageEl(cx + cellW * 0.06, cy, cellW * 0.88, cellH - labelSize * 2.2, r?.id ?? null, { name: `Construcción ${i + 2}`, shadow: false }))
      els.push(textEl(c, 'label', r?.name ?? `Construcción ${i + 2}`, cx, cy + cellH - labelSize * 2, cellW, { font: MC_FONT, color: ink, align: 'center', size: labelSize, weight: 400 }))
    }
    const hx = W - m - heroW
    els.push(imageEl(hx, top, heroW, (H - top - m) * 0.82, renders[0]?.id ?? null, { name: 'Construcción destacada', shadow: false }))
    els.push(textEl(c, 'label', renders[0]?.name ?? 'Construcción destacada', hx, top + (H - top - m) * 0.84, heroW, { font: MC_FONT, color: ink, align: 'center', size: Math.round(labelSize * 1.15), weight: 400 }))
  } else if (id === 'bundle') {
    // paquete de construcciones: gran título blanco con sombra y cuadrícula limpia sin etiquetas
    c.background = { type: 'linear', color1: '#cfe3f0', color2: '#bcd5e7', angle: 90 }
    const title = textEl(c, 'title', 'NOMBRE DEL PAQUETE', m, m * 0.6, W - m * 2, { font: 'Segoe UI Black', color: '#ffffff', align: 'center', size: Math.round(Math.min(W, H) * 0.085), uppercase: true, weight: 700, letterSpacing: 2 })
    title.shadow = true
    els.push(title)
    els.push(rectEl(W * 0.2, title.y + title.h + m * 0.1, W * 0.6, Math.max(3, Math.round(m * 0.04)), '#ffffff', { name: 'Separador', radius: 2, opacity: 0.9 }))
    const sub = textEl(c, 'subtitle', 'Paquete de construcciones de Minecraft', m, title.y + title.h + m * 0.3, W - m * 2, { color: '#ffffff', align: 'center', weight: 600 })
    sub.shadow = true
    els.push(sub)
    const top = sub.y + sub.h + m * 0.5
    const n = Math.min(16, renders.length || 8)
    const cols = W >= H ? Math.min(n, 5) : 4
    const rows = Math.ceil(n / cols)
    const gap = m * 0.3
    const cw = (W - m * 2 - gap * (cols - 1)) / cols
    const ch = (H - top - m * 1.2 - gap * (rows - 1)) / rows
    for (let i = 0; i < n; i++) {
      const row = Math.floor(i / cols)
      const inRow = Math.min(cols, n - row * cols)
      const offset = ((cols - inRow) * (cw + gap)) / 2 // última fila centrada
      els.push(imageEl(m + offset + (i % cols) * (cw + gap), top + row * (ch + gap), cw, ch, renders[i]?.id ?? null, { name: `Construcción ${i + 1}`, shadow: false }))
    }
    els.push(textEl(c, 'watermark', '@tu_nombre', W - m - W * 0.3, H - m, W * 0.3, { color: '#ffffff' }))
  } else if (id === 'catalog') {
    c.background = { type: 'solid', color1: '#f4f2ee', color2: '#ffffff', angle: 90 }
    const dark = '#1b1e24'
    const title = textEl(c, 'title', 'Catálogo de construcciones', m, m, W - m * 2, { color: dark })
    const sub = textEl(c, 'subtitle', 'Colección · edita este texto', m, title.y + title.h + m * 0.15, W - m * 2, { color: '#5b6372' })
    els.push(title, sub)
    const n = Math.max(4, Math.min(9, renders.length || 4))
    const top = sub.y + sub.h + m * 0.6
    const areaH = H - top - m * 1.6
    const areaW = W - m * 2
    let cols = Math.ceil(Math.sqrt((n * areaW) / areaH))
    cols = Math.max(1, Math.min(n, cols))
    const rows = Math.ceil(n / cols)
    const gap = m * 0.4
    const cw = (areaW - gap * (cols - 1)) / cols, ch = (areaH - gap * (rows - 1)) / rows
    for (let i = 0; i < n; i++) {
      const cx = m + (i % cols) * (cw + gap), cy = top + Math.floor(i / cols) * (ch + gap)
      const r = renders[i]
      els.push(rectEl(cx, cy, cw, ch, '#ffffff', { name: `Tarjeta ${i + 1}`, radius: Math.round(m * 0.15), stroke: '#e0ddd6', strokeWidth: 2 }))
      const labelSize = Math.round(Math.min(W, H * 1.6) * 0.016)
      const imgH = ch - labelSize * 3.6
      els.push(imageEl(cx + gap * 0.5, cy + gap * 0.5, cw - gap, imgH - gap * 0.5, r?.id ?? null, { shadow: false }))
      const lbl = textEl(c, 'label', r?.name ?? `Construcción ${i + 1}`, cx + gap * 0.6, cy + imgH + labelSize * 0.3, cw - gap * 1.2, { color: dark })
      els.push(lbl)
      const inf = infoLine(r)
      if (inf) els.push(textEl(c, 'credits', inf, cx + gap * 0.6, lbl.y + lbl.h, cw - gap * 1.2, { color: '#7a8290' }))
    }
    els.push(textEl(c, 'credits', `Creado con BlockScene · ${date}`, m, H - m, W / 2, { color: '#8a8f99' }))
  } else if (id === 'poster') {
    c.background = { type: 'radial', color1: '#26324a', color2: '#0b0e14', angle: 0 }
    const title = textEl(c, 'title', 'NOMBRE DE LA COLECCIÓN', m, m, W - m * 2, { align: 'center', size: Math.round(Math.min(W, H) * 0.075), uppercase: true, letterSpacing: 4 })
    const sub = textEl(c, 'subtitle', 'Subtítulo o temporada', m, title.y + title.h + m * 0.1, W - m * 2, { align: 'center' })
    els.push(title, sub)
    const thumbs = renders.slice(1, 5)
    const thumbH = thumbs.length ? (H - m * 2) * 0.16 : 0
    const heroTop = sub.y + sub.h + m * 0.4
    const heroH = H - heroTop - m * 1.8 - thumbH - (thumbs.length ? m * 0.5 : 0)
    els.push(imageEl(m, heroTop, W - m * 2, heroH, renders[0]?.id ?? null, { name: 'Imagen principal' }))
    if (thumbs.length) {
      const gap = m * 0.4
      const tw = (W - m * 2 - gap * (thumbs.length - 1)) / thumbs.length
      thumbs.forEach((r, i) => els.push(imageEl(m + i * (tw + gap), heroTop + heroH + m * 0.5, tw, thumbH, r.id, { name: `Miniatura ${i + 1}` })))
    }
    els.push(textEl(c, 'credits', `Construcciones: autor · Render: BlockScene · ${date}`, m, H - m, W * 0.6))
    els.push(textEl(c, 'watermark', 'BlockScene', W - m - W * 0.3, H - m, W * 0.3))
  } else {
    c.background = { type: 'linear', color1: '#11141a', color2: '#1f2531', angle: 120 }
    const r = renders[0]
    const colW = (W - m * 3) * 0.36
    const imgW = W - m * 3 - colW
    els.push(imageEl(m, m, imgW, H - m * 2, r?.id ?? null, { name: 'Construcción' }))
    const x2 = m * 2 + imgW
    const title = textEl(c, 'title', r?.name ?? 'Nombre de la construcción', x2, m, colW)
    const sub = textEl(c, 'subtitle', 'Descripción breve · edita este texto', x2, title.y + title.h + m * 0.2, colW)
    els.push(title, sub)
    const i = r?.buildInfo
    const lines = i
      ? [
          `Formato: ${i.formatLabel}`,
          `Dimensiones: ${i.width} × ${i.height} × ${i.length}`,
          `Bloques: ${fmtInt(i.blockCount)}`,
          `Tipos de bloque: ${i.paletteSize}`,
          i.minecraftVersion ? `Versión de Minecraft: ${i.minecraftVersion}` : '',
          i.author ? `Autor: ${i.author}` : ''
        ].filter(Boolean).join('\n')
      : 'Ficha técnica: haz un "Render aislado" de una construcción en el Estudio 3D y úsalo en esta plantilla para rellenar estos datos con la información real del archivo.'
    const lineY = sub.y + sub.h + m * 0.5
    els.push(rectEl(x2, lineY, colW * 0.25, Math.max(4, m * 0.06), '#4c9dff', { name: 'Separador', radius: 2 }))
    els.push(textEl(c, 'body', lines, x2, lineY + m * 0.4, colW))
    els.push(textEl(c, 'credits', `BlockScene · ${date}`, x2, H - m, colW))
  }
  // los créditos y marcas al pie se anclan por su parte inferior
  for (const e of els) if (e.type === 'text' && (e.style?.role === 'credits' || e.style?.role === 'watermark') && e.y >= H - m - 1) e.y = H - m - e.h
  c.elements = els
  return c
}

/** Plantilla personalizada: copia de la composición sin imágenes asignadas. */
export function compositionAsTemplate(c: Composition, name: string): Composition {
  const t = structuredClone(c)
  t.id = uid('tpl')
  t.name = name
  t.elements = t.elements.map((e) => ({ ...e, id: uid('el'), imageId: e.type === 'image' ? null : e.imageId }))
  return t
}

export function instantiateTemplate(t: Composition): Composition {
  const c = structuredClone(t)
  c.id = uid('comp')
  c.elements = c.elements.map((e) => ({ ...e, id: uid('el') }))
  return c
}
