import type { CompElement, Composition, RenderItem, TextStyle } from '@shared/types'
import { activeComposition, useStore } from '../state/store'
import { blankComposition, uid } from '../state/defaults'
import { buildTemplate, compositionAsTemplate, imageEl, instantiateTemplate, textEl, type TemplateId } from './templates'
import { drawComposition, loadImage } from './drawPage'
import { checkCapacity, QUALITY_INFO } from './pageFormats'

const st = (): ReturnType<typeof useStore.getState> => useStore.getState()

function ensureComposition(): Composition {
  const c = activeComposition(st())
  if (c) return c
  const n = blankComposition(`Lámina ${st().project.compositions.length + 1}`)
  st().addComposition(n, true)
  return n
}

export function newComposition(): void {
  st().addComposition(blankComposition(`Lámina ${st().project.compositions.length + 1}`), true)
  st().setWorkspace('compositor')
}

export function applyTemplateToNew(id: TemplateId): void {
  const cur = activeComposition(st())
  const page = cur?.page ?? blankComposition().page
  const renders = st().project.renders
  const c = buildTemplate(id, page, renders)
  st().addComposition(c, true)
  st().setWorkspace('compositor')
}

/**
 * «Añadir a lámina»: crea una lámina con la plantilla elegida usando este render como pieza principal
 * y abre el Compositor. Las plantillas de una sola imagen usan solo este render.
 */
export function addRenderToSheet(renderId: string, template: TemplateId): boolean {
  const all = st().project.renders
  const r = all.find((x) => x.id === renderId)
  if (!r) return false
  const single = template === 'showcase' || template === 'sheet'
  const renders = single ? [r] : [r, ...all.filter((x) => x.id !== renderId)]
  const page = activeComposition(st())?.page ?? blankComposition().page
  st().addComposition(buildTemplate(template, page, renders), true)
  st().setWorkspace('compositor')
  return true
}

export function applyCustomTemplate(t: Composition): void {
  st().addComposition(instantiateTemplate(t), true)
}

export async function saveAsTemplate(name: string): Promise<void> {
  const c = activeComposition(st())
  if (!c) return
  const t = compositionAsTemplate(c, name)
  st().setCustomTemplates([...st().project.customTemplates, t])
  // también disponible en otros proyectos (carpeta de datos de usuario)
  try {
    const list = (await window.api.loadTemplates()) as Composition[]
    await window.api.saveTemplates([...list.filter((x) => x.name !== name), t])
    st().toast({ kind: 'success', title: `Plantilla "${name}" guardada`, detail: 'Disponible en este proyecto y en los demás.' })
  } catch (e) {
    st().toast({ kind: 'warning', title: 'Plantilla guardada solo en este proyecto', detail: (e as Error).message })
  }
}

export function addTextElement(role: TextStyle['role']): void {
  const c = ensureComposition()
  const W = c.page.width, H = c.page.height, m = c.margin
  const texts: Record<TextStyle['role'], string> = {
    title: 'Título', subtitle: 'Subtítulo', label: 'Etiqueta', body: 'Texto', credits: 'Créditos · autor', watermark: 'Marca de agua'
  }
  const el = textEl(c, role, texts[role], m, m, role === 'watermark' ? W * 0.3 : W * 0.5)
  if (role === 'credits') el.y = H - m - el.h
  if (role === 'watermark') {
    el.x = W - m - el.w
    el.y = H - m - el.h
  }
  st().addElement(c.id, el)
  st().setWorkspace('compositor')
}

export function addRectElement(): void {
  const c = ensureComposition()
  const W = c.page.width, H = c.page.height
  st().addElement(c.id, { id: uid('el'), type: 'rect', name: 'Marco', x: W * 0.3, y: H * 0.3, w: W * 0.4, h: H * 0.4, rotation: 0, opacity: 1, locked: false, visible: true, fill: '#2a3140', radius: 16, stroke: '#ffffff', strokeWidth: 0 })
}

export function addImageSlot(): void {
  const c = ensureComposition()
  const W = c.page.width, H = c.page.height
  st().addElement(c.id, imageEl(W * 0.25, H * 0.25, W * 0.5, H * 0.5, null, { name: 'Hueco de imagen' }))
}

export function placeRender(r: RenderItem, at?: { x: number; y: number }, targetSlot?: CompElement): void {
  const c = ensureComposition()
  if (targetSlot && targetSlot.type === 'image') {
    st().updateElement(c.id, targetSlot.id, { imageId: r.id, name: r.name })
    st().selectElement(targetSlot.id)
    return
  }
  const W = c.page.width
  const w = W * 0.4
  const h = w * (r.height / r.width)
  const x = at ? at.x - w / 2 : (W - w) / 2
  const y = at ? at.y - h / 2 : (c.page.height - h) / 2
  st().addElement(c.id, imageEl(x, y, w, h, r.id, { name: r.name, shadow: r.source !== 'imported' }))
}

export async function importImagesToGallery(): Promise<void> {
  const files = await window.api.openImages()
  for (const f of files) {
    const blob = new Blob([f.data as BlobPart], { type: f.mime })
    const dataUrl = await new Promise<string>((res, rej) => {
      const fr = new FileReader()
      fr.onload = () => res(fr.result as string)
      fr.onerror = () => rej(fr.error)
      fr.readAsDataURL(blob)
    })
    try {
      const img = await loadImage(`imp_${f.name}_${dataUrl.length}`, dataUrl)
      st().addRender({ id: uid('render'), name: f.name.replace(/\.[^.]+$/, ''), width: img.naturalWidth, height: img.naturalHeight, createdAt: new Date().toISOString(), dataUrl, source: 'imported' })
    } catch {
      st().toast({ kind: 'error', title: `No se pudo leer ${f.name}`, detail: 'El archivo no es una imagen válida.' })
    }
  }
  if (files.length) st().toast({ kind: 'success', title: `${files.length} imagen(es) añadidas a la galería` }, 3000)
}

export function alignElement(compId: string, el: CompElement, how: 'l' | 'ch' | 'r' | 't' | 'cv' | 'b', toMargins: boolean): void {
  const c = st().project.compositions.find((x) => x.id === compId)
  if (!c) return
  const m = toMargins ? c.margin : 0
  const W = c.page.width, H = c.page.height
  const p: Partial<CompElement> = {}
  if (how === 'l') p.x = m
  if (how === 'ch') p.x = (W - el.w) / 2
  if (how === 'r') p.x = W - m - el.w
  if (how === 't') p.y = m
  if (how === 'cv') p.y = (H - el.h) / 2
  if (how === 'b') p.y = H - m - el.h
  st().updateElement(compId, el.id, p)
}

/** Genera la lámina a tamaño completo. Devuelve el blob REAL que se guardará. */
export async function renderCompositionBlob(c: Composition, format: 'png' | 'jpg', onProgress?: (f: number, label: string) => void): Promise<{ blob: Blob; ss: number }> {
  const cap = checkCapacity(c.page.width, c.page.height, c.page.quality)
  if (cap.level === 'err') throw new Error(cap.message)
  const renders = st().project.renders
  onProgress?.(0.05, 'Cargando imágenes')
  const imgs = new Map<string, HTMLImageElement>()
  for (const el of c.elements) {
    if (el.type !== 'image' || !el.imageId || imgs.has(el.imageId)) continue
    const r = renders.find((x) => x.id === el.imageId)
    if (r) imgs.set(r.id, await loadImage(r.id, r.dataUrl))
  }
  const missing = c.elements.filter((e) => e.type === 'image' && e.visible && e.imageId && !imgs.has(e.imageId)).length
  if (missing) throw new Error(`${missing} imagen(es) de la lámina ya no existen en la galería. Sustitúyelas o elimínalas antes de exportar.`)
  await new Promise((r) => setTimeout(r, 0))
  onProgress?.(0.25, `Dibujando a ${cap.ss}× (${c.page.width * cap.ss}×${c.page.height * cap.ss} px)`)
  const big = document.createElement('canvas')
  big.width = c.page.width * cap.ss
  big.height = c.page.height * cap.ss
  const bctx = big.getContext('2d')
  if (!bctx) throw new Error('No se pudo crear el lienzo de dibujo (memoria insuficiente).')
  drawComposition(bctx, c, cap.ss, { editor: false, resolve: (id) => imgs.get(id) ?? null })
  let out = big
  if (cap.ss > 1) {
    await new Promise((r) => setTimeout(r, 0))
    onProgress?.(0.6, 'Reduciendo al tamaño final')
    out = document.createElement('canvas')
    out.width = c.page.width
    out.height = c.page.height
    const octx = out.getContext('2d')!
    octx.imageSmoothingEnabled = true
    octx.imageSmoothingQuality = 'high'
    octx.drawImage(big, 0, 0, out.width, out.height)
    big.width = big.height = 0 // liberar memoria
  }
  if (format === 'jpg') {
    // JPG no admite transparencia: fondo blanco bajo lo transparente
    const ctx = out.getContext('2d')!
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, out.width, out.height)
  }
  onProgress?.(0.8, `Codificando ${format.toUpperCase()}`)
  const blob = await new Promise<Blob | null>((r) => out.toBlob(r, format === 'png' ? 'image/png' : 'image/jpeg', QUALITY_INFO[c.page.quality].jpg))
  if (!blob) throw new Error('El navegador no pudo codificar la imagen (posible falta de memoria).')
  if (out.width !== c.page.width || out.height !== c.page.height) throw new Error('El tamaño generado no coincide con el solicitado.')
  onProgress?.(1, 'Listo')
  return { blob, ss: cap.ss }
}
