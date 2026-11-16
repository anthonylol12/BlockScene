// Acciones de la aplicación (las usan los menús, los atajos y los botones)
import type { ObjectKind, RenderItem } from '@shared/types'
import { useStore } from './store'
import { makeObject, uid, KIND_LABEL } from './defaults'
import { getEngine, type StandardView } from '../engine/Engine'

const st = (): ReturnType<typeof useStore.getState> => useStore.getState()

export function addSceneObject(kind: Exclude<ObjectKind, 'build'>): void {
  const s = st()
  const layer = kind === 'light' || kind === 'decor' ? 'layer_lights' : 'layer_env'
  const layerId = s.project.layers.find((l) => l.id === layer)?.id ?? s.project.layers[0].id
  const o = makeObject(kind, layerId)
  const e = getEngine()
  // colocar cerca del centro de la vista, a ras de suelo
  if (e && kind !== 'terrain' && kind !== 'vegetation' && kind !== 'base') {
    const t = e.controls.target
    o.transform.position = [Math.round(t.x + 6), 0, Math.round(t.z + 6)]
  }
  if (kind === 'light') o.transform.position[1] = 8
  if (kind === 'base') o.transform.position[1] = -2
  if (kind === 'terrain') o.transform.position[1] = -2
  if (kind === 'water') o.transform.position[1] = -3
  const n = s.project.objects.filter((x) => x.kind === kind).length
  o.name = `${KIND_LABEL[kind]} ${n + 1}`
  s.addObject(o)
}

export function deleteSelected(): void {
  const s = st()
  if (s.workspace === 'compositor') {
    const c = s.project.compositions.find((x) => x.id === s.project.activeCompositionId)
    if (c && s.compSelectedId) s.removeElement(c.id, s.compSelectedId)
    return
  }
  if (s.selectedId) s.removeObjects([s.selectedId])
}

export function duplicateSelected(): void {
  const s = st()
  if (s.workspace === 'compositor') {
    const c = s.project.compositions.find((x) => x.id === s.project.activeCompositionId)
    const el = c?.elements.find((e) => e.id === s.compSelectedId)
    if (c && el) s.addElement(c.id, { ...structuredClone(el), id: uid('el'), x: el.x + 30, y: el.y + 30, name: `${el.name} (copia)` })
    return
  }
  if (s.selectedId) s.duplicateObject(s.selectedId)
}

export function toggleHideSelected(): void {
  const s = st()
  const o = s.project.objects.find((x) => x.id === s.selectedId)
  if (o) s.updateObject(o.id, { visible: !o.visible })
}

export function setView(v: StandardView): void {
  getEngine()?.setStandardView(v)
}

export function saveCurrentView(): void {
  const e = getEngine()
  if (!e) return
  const s = st()
  const name = `Vista ${s.project.cameras.length + 1}`
  s.addCamera(e.currentView(name, uid('cam')))
  s.toast({ kind: 'success', title: `${name} guardada`, detail: s.project.cameras.length === 0 ? 'Se ha marcado como cámara principal.' : undefined }, 2500)
}

export async function canvasToDataUrl(c: HTMLCanvasElement): Promise<string> {
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, 'image/png'))
  if (!blob) throw new Error('No se pudo codificar la imagen PNG')
  return await new Promise((res, rej) => {
    const fr = new FileReader()
    fr.onload = () => res(fr.result as string)
    fr.onerror = () => rej(fr.error)
    fr.readAsDataURL(blob)
  })
}

let cancelFlag = false
export const cancelRender = (): void => {
  cancelFlag = true
}

/** Render real: genera una imagen y la añade a la galería del proyecto. */
export async function renderToGallery(opts: {
  width: number
  height: number
  samples: number
  cameraId: string | 'current'
  isolateId?: string
  transparent: boolean
  name?: string
}): Promise<RenderItem | null> {
  const e = getEngine()
  const s = st()
  if (!e) {
    s.toast({ kind: 'error', title: 'El visor 3D no está activo', detail: 'Vuelve al Estudio 3D para renderizar.' })
    return null
  }
  const view = opts.cameraId === 'current' ? null : (s.project.cameras.find((c) => c.id === opts.cameraId) ?? null)
  const job = s.startJob(`Render ${opts.width}×${opts.height}`)
  cancelFlag = false
  const t0 = performance.now()
  try {
    const canvas = await e.renderStill({
      width: opts.width,
      height: opts.height,
      samples: opts.samples,
      view,
      isolateId: opts.isolateId,
      transparent: opts.transparent,
      cancelled: () => cancelFlag,
      onProgress: (f, label) => st().updateJob(job, f, label)
    })
    const dataUrl = await canvasToDataUrl(canvas)
    const obj = opts.isolateId ? s.project.objects.find((o) => o.id === opts.isolateId) : undefined
    const info = obj?.assetId ? s.project.assets[obj.assetId]?.info : undefined
    const item: RenderItem = {
      id: uid('render'),
      name: opts.name ?? (obj ? obj.name : (() => { const b = s.project.objects.filter((o) => o.kind === 'build' && o.visible); return b.length === 1 ? b[0].name.replace(/^EJEMPLO · /, '') : `Render ${new Date().toLocaleTimeString('es-ES')}` })()),
      width: canvas.width,
      height: canvas.height,
      createdAt: new Date().toISOString(),
      dataUrl,
      source: opts.isolateId ? 'isolated' : 'scene',
      objectId: opts.isolateId,
      buildInfo: info,
      samples: opts.samples
    }
    st().addRender(item)
    st().toast({
      kind: 'success',
      title: 'Render completado',
      detail: `${opts.width}×${opts.height} px · ${opts.samples} muestras · ${((performance.now() - t0) / 1000).toFixed(1)} s. Añadido a la galería del Compositor.`,
      action: { label: 'Ver', run: () => st().setModal({ type: 'renderView', renderId: item.id }) }
    })
    return item
  } catch (err) {
    st().toast({ kind: 'error', title: 'El render no se completó', detail: (err as Error).message })
    return null
  } finally {
    st().endJob(job)
  }
}

export async function renderSelectedIsolated(): Promise<void> {
  const s = st()
  const o = s.project.objects.find((x) => x.id === s.selectedId)
  if (!o || o.kind !== 'build') {
    s.toast({ kind: 'info', title: 'Selecciona una construcción', detail: 'El render aislado genera una imagen con fondo transparente de la construcción seleccionada.' })
    return
  }
  await renderToGallery({ width: 1600, height: 1200, samples: 8, cameraId: 'current', isolateId: o.id, transparent: true })
}

export async function downloadRender(r: RenderItem): Promise<void> {
  const bytes = Uint8Array.from(atob(r.dataUrl.split(',')[1]), (c) => c.charCodeAt(0))
  const res = await window.api.saveBinary({ suggestedName: `${r.name.replace(/[\\/:*?"<>|]/g, '_')}.png`, filterName: 'Imagen PNG', extensions: ['png'], data: bytes })
  if (res) st().toast({ kind: 'success', title: 'PNG guardado', detail: res.path, action: { label: 'Mostrar en carpeta', run: () => window.api.showItem(res.path) } })
}
