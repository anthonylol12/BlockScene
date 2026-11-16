import { useEffect, useMemo, useState, type JSX } from 'react'
import type { PageQuality } from '@shared/types'
import { activeComposition, useStore } from '../state/store'
import { SUPPORTED_FORMATS, MAX_VOLUME } from '../core/formats'
import { Engine, getEngine } from '../engine/Engine'
import { downloadRender, renderToGallery } from '../state/actions'
import { renderCompositionBlob } from '../compositor/compActions'
import { PAGE_PRESETS, QUALITY_INFO, checkCapacity } from '../compositor/pageFormats'
import { BuildInfoView } from './studio/RightPanel'
import { PrefsModal } from './PrefsModal'
import { Field, Modal, NumInput, Seg, Select, Toggle, fmtBytes } from './controls'

export function Modals(): JSX.Element | null {
  const modal = useStore((s) => s.modal)
  const close = (): void => useStore.getState().setModal(null)
  if (!modal) return null
  switch (modal.type) {
    case 'importReport': return <ImportReport ids={modal.assetIds} onClose={close} />
    case 'formats': return <Formats onClose={close} />
    case 'render': return <RenderDialog onClose={close} />
    case 'export': return <ExportDialog onClose={close} />
    case 'pageSetup': return <PageSetup onClose={close} />
    case 'shortcuts': return <Shortcuts onClose={close} />
    case 'renderView': return <RenderView id={modal.renderId} onClose={close} />
    case 'prefs': return <PrefsModal onClose={close} />
    default: return null
  }
}

function ImportReport({ ids, onClose }: { ids: string[]; onClose: () => void }): JSX.Element {
  const assets = useStore((s) => s.project.assets)
  const list = ids.map((id) => assets[id]).filter(Boolean)
  return (
    <Modal title={`Importación completada · ${list.length} archivo(s)`} onClose={onClose} footer={<button className="btn primary" onClick={onClose}>Aceptar</button>}>
      <div className="hint">Datos leídos del propio archivo. Si un dato no aparece es porque el archivo no lo incluye.</div>
      {list.map((a) => (
        <div key={a.id} className="callout" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <b style={{ color: 'var(--text)' }}>{a.fileName}</b>
          <BuildInfoView info={a.info} demo={a.isDemo} />
        </div>
      ))}
    </Modal>
  )
}

function Formats({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <Modal title="Formatos compatibles" onClose={onClose} wide footer={<button className="btn" onClick={onClose}>Cerrar</button>}>
      <table className="info">
        <thead><tr><th>Extensión</th><th>Formato</th><th>Qué se lee</th><th>Estado</th></tr></thead>
        <tbody>
          {SUPPORTED_FORMATS.map((f) => (
            <tr key={f.ext}>
              <td style={{ fontFamily: 'var(--mono)', width: 90 }}>{f.ext}</td>
              <td style={{ width: 190, color: 'var(--text)' }}>{f.label}</td>
              <td>{f.detail}</td>
              <td><span className={`tag ${f.status === 'completo' ? 'ok' : 'warn'}`}>{f.status.toUpperCase()}</span></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="callout">
        <b>Detección por contenido:</b> el formato se identifica leyendo el archivo, no solo por la extensión. Los archivos comprimidos con gzip o zlib se descomprimen automáticamente.<br />
        <b>Límites:</b> hasta {MAX_VOLUME / 1e6} millones de vóxeles por construcción y 16 millones de caras visibles; archivos de hasta 512 MB.<br />
        <b>No compatible:</b> mundos completos (carpetas), Bedrock Edition (.mcstructure, LevelDB), .mcr (pre-1.2), chunks con compresión LZ4, entidades y datos de bloques (cofres, carteles…), biomas y colores de bioma.
      </div>
    </Modal>
  )
}

const RENDER_PRESETS = [
  { id: 'hd', label: 'HD · 1280×720', w: 1280, h: 720 },
  { id: 'fhd', label: 'Full HD · 1920×1080', w: 1920, h: 1080 },
  { id: 'qhd', label: '2K · 2560×1440', w: 2560, h: 1440 },
  { id: '4k', label: '4K · 3840×2160', w: 3840, h: 2160 },
  { id: 'sq', label: 'Cuadrado · 2048×2048', w: 2048, h: 2048 },
  { id: 'port', label: 'Vertical · 1440×1920', w: 1440, h: 1920 },
  { id: 'custom', label: 'Personalizado', w: 0, h: 0 }
]

function RenderDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const cameras = useStore((s) => s.project.cameras)
  const mainId = useStore((s) => s.project.mainCameraId)
  const env = useStore((s) => s.project.environment)
  const selected = useStore((s) => s.project.objects.find((o) => o.id === s.selectedId))
  const [preset, setPreset] = useState('fhd')
  const [w, setW] = useState(1920)
  const [h, setH] = useState(1080)
  const [samples, setSamples] = useState(16)
  const [cam, setCam] = useState<string>(mainId ?? 'current')
  const [transparent, setTransparent] = useState(false)
  const [isolate, setIsolate] = useState(false)
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<string | null>(null)
  const lim = useMemo(() => Engine.gpuLimits(), [])
  const maxSide = Math.min(lim.maxSize, lim.maxViewport[0], lim.maxViewport[1], 8192)
  const tooBig = w > maxSide || h > maxSide
  const memMB = Math.round((w * h * (4 + 8)) / 1048576)

  const go = async (quick: boolean): Promise<void> => {
    setBusy(true)
    setResult(null)
    const e = getEngine()
    const qw = quick ? Math.min(960, w) : w
    const qh = quick ? Math.round(qw * (h / w)) : h
    const r = await renderToGallery({
      width: qw, height: qh, samples: quick ? 1 : samples,
      cameraId: cam, transparent, isolateId: isolate && selected?.kind === 'build' ? selected.id : undefined,
      name: quick ? `Vista previa ${new Date().toLocaleTimeString('es-ES')}` : undefined
    })
    setBusy(false)
    if (r) setResult(r.id)
    void e
  }
  const r = useStore((s) => s.project.renders.find((x) => x.id === result))
  return (
    <Modal title="Render" onClose={() => !busy && onClose()} wide footer={
      <>
        <span className="grow hint">Las imágenes generadas se añaden a la galería del Compositor y se guardan con el proyecto.</span>
        <button className="btn" disabled={busy} onClick={onClose}>Cerrar</button>
        <button className="btn" disabled={busy || tooBig} onClick={() => go(true)} title="1 muestra, máx. 960 px de ancho">Vista previa rápida</button>
        <button className="btn primary" disabled={busy || tooBig} onClick={() => go(false)}>{busy ? 'Renderizando…' : 'Render final'}</button>
      </>
    }>
      <div className="grid2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="Tamaño">
            <Select value={preset} options={RENDER_PRESETS.map((p) => ({ value: p.id, label: p.label }))} onChange={(v) => {
              setPreset(v)
              const p = RENDER_PRESETS.find((x) => x.id === v)!
              if (p.w) { setW(p.w); setH(p.h) }
            }} />
          </Field>
          <Field label="Ancho × alto">
            <div className="row">
              <NumInput value={w} min={16} max={16384} decimals={0} onChange={(v) => { setW(Math.round(v)); setPreset('custom') }} />
              <span className="muted">×</span>
              <NumInput value={h} min={16} max={16384} decimals={0} onChange={(v) => { setH(Math.round(v)); setPreset('custom') }} />
            </div>
          </Field>
          <Field label="Muestras" title="Imágenes acumuladas con desplazamiento subpíxel y del sol: suavizan bordes y sombras">
            <Seg value={String(samples)} onChange={(v) => setSamples(+v)} options={[{ value: '1', label: '1' }, { value: '4', label: '4' }, { value: '16', label: '16' }, { value: '32', label: '32' }, { value: '64', label: '64' }]} />
          </Field>
          <Field label="Cámara">
            <Select value={cam} onChange={setCam} options={[{ value: 'current', label: 'Vista actual del visor' }, ...cameras.map((c) => ({ value: c.id, label: `${c.name}${c.id === mainId ? ' (principal)' : ''}` }))]} />
          </Field>
          <Field label="Fondo transparente"><Toggle checked={transparent} onChange={setTransparent} /></Field>
          {env.background.mode === 'studio' && !transparent && <div className="hint">Para hojas de colección o paquetes (construcciones recortadas sobre el fondo de la lámina), activa «Fondo transparente»: se conserva la sombra del suelo.</div>}
          <Field label="Solo la selección" title="Oculta el resto de objetos y encuadra la construcción seleccionada">
            <Toggle checked={isolate} onChange={setIsolate} />
          </Field>
          {isolate && selected?.kind !== 'build' && <div className="hint warn">Selecciona una construcción para el render aislado.</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className={`capacity ${tooBig ? 'err' : memMB > 1500 ? 'warn' : 'ok'}`}>
            {tooBig ? `La GPU de este equipo admite como máximo ${maxSide} px por lado.` : `Memoria estimada: ${memMB} MB · máximo de la GPU: ${maxSide} px por lado.`}
          </div>
          <div className="kv">
            <span>Calidad visor</span><span>{env.quality.preset}</span>
            <span>Sombras</span><span>{env.shadows ? 'sí (mapa 4096 px en el render)' : 'no'}</span>
            <span>Oclusión amb.</span><span>{env.quality.ao ? 'GTAO activado' : 'solo por vértice'}</span>
            <span>Reflejos</span><span>{env.quality.reflections ? 'mapa de entorno del cielo' : 'no'}</span>
          </div>
          <div className="callout">
            <b>Qué es este render:</b> rasterización WebGL de la escena actual, a la resolución pedida, promediando varias muestras (suavizado de bordes y sombras suaves). No es trazado de rayos: no hay reflejos de objetos, refracción ni iluminación global.
          </div>
        </div>
      </div>
      {r && (
        <div className="callout ok" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span>Render generado: {r.width}×{r.height} px. Ya está en la galería.</span>
          <img className="preview-img" src={r.dataUrl} alt="Resultado del render" style={{ maxHeight: '36vh' }} />
          <div className="row"><button className="btn small" onClick={() => downloadRender(r)}>Guardar PNG…</button></div>
        </div>
      )}
    </Modal>
  )
}

function PageSetup({ onClose }: { onClose: () => void }): JSX.Element {
  const comp = useStore(activeComposition)
  const [preset, setPreset] = useState(comp?.page.preset ?? 'fhd')
  const [w, setW] = useState(comp?.page.width ?? 1920)
  const [h, setH] = useState(comp?.page.height ?? 1080)
  const [q, setQ] = useState<PageQuality>(comp?.page.quality ?? 'high')
  const [rescale, setRescale] = useState(true)
  if (!comp) return <Modal title="Formato" onClose={onClose}>Sin lámina activa.</Modal>
  const cap = checkCapacity(w, h, q)
  const ar = w / h
  const apply = (): void => {
    const st = useStore.getState()
    const sx = w / comp.page.width, sy = h / comp.page.height
    const s = Math.min(sx, sy)
    st.updateComposition(comp.id, {
      page: { width: w, height: h, preset, quality: q },
      margin: rescale ? Math.round(comp.margin * s) : comp.margin,
      safeZone: rescale ? Math.round(comp.safeZone * s) : comp.safeZone,
      elements: rescale
        ? comp.elements.map((e) => ({ ...e, x: Math.round(e.x * sx), y: Math.round(e.y * sy), w: Math.round(e.w * sx), h: Math.round(e.h * sy), style: e.style ? { ...e.style, size: Math.round(e.style.size * s) } : e.style }))
        : comp.elements
    })
    onClose()
  }
  return (
    <Modal title="Formato de la lámina" onClose={onClose} footer={<><button className="btn" onClick={onClose}>Cancelar</button><button className="btn primary" disabled={cap.level === 'err'} onClick={apply}>Aplicar</button></>}>
      <div className="grid2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="Formato">
            <Select value={preset} onChange={(v) => {
              setPreset(v)
              const p = PAGE_PRESETS.find((x) => x.id === v)
              if (p) { setW(p.w); setH(p.h) }
            }} options={[...PAGE_PRESETS.map((p) => ({ value: p.id, label: p.label })), { value: 'custom', label: 'Personalizado…' }]} />
          </Field>
          <Field label="Ancho (px)"><NumInput value={w} min={64} max={40000} decimals={0} onChange={(v) => { setW(Math.round(v)); setPreset('custom') }} /></Field>
          <Field label="Alto (px)"><NumInput value={h} min={64} max={40000} decimals={0} onChange={(v) => { setH(Math.round(v)); setPreset('custom') }} /></Field>
          <Field label="Definición">
            <Seg value={q} onChange={setQ} options={(['fast', 'high', 'max'] as const).map((k) => ({ value: k, label: QUALITY_INFO[k].label }))} />
          </Field>
          <div className="hint">{QUALITY_INFO[q].detail}</div>
          <Field label="Reescalar"><Toggle checked={rescale} onChange={setRescale} label="Adaptar los elementos" /></Field>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
          <div style={{ width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div aria-label="Proporción de la página" style={{ width: ar >= 1 ? 190 : 190 * ar, height: ar >= 1 ? 190 / ar : 190, background: 'var(--bg4)', border: '1px solid var(--line2)', borderRadius: 3, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text3)', fontSize: 12 }}>
              {w}×{h}
            </div>
          </div>
          <span className="muted small">Proporción {(ar >= 1 ? ar : 1 / ar).toFixed(3)}:1 {ar >= 1 ? '(horizontal)' : '(vertical)'} · {(w * h / 1e6).toFixed(1)} Mpx</span>
          <div className={`capacity ${cap.level}`} style={{ width: '100%' }}>{cap.message}</div>
        </div>
      </div>
    </Modal>
  )
}

function ExportDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const comp = useStore(activeComposition)
  const [format, setFormat] = useState<'png' | 'jpg'>('png')
  const [state, setState] = useState<{ phase: 'idle' | 'working' | 'ready' | 'saved' | 'error'; msg?: string; progress?: number; blob?: Blob; url?: string; path?: string; size?: number; ss?: number }>({ phase: 'idle' })
  useEffect(() => () => { if (state.url) URL.revokeObjectURL(state.url) }, [state.url])
  if (!comp) return <Modal title="Exportar" onClose={onClose}>Sin lámina activa.</Modal>
  const cap = checkCapacity(comp.page.width, comp.page.height, comp.page.quality)
  const generate = async (): Promise<void> => {
    setState({ phase: 'working', progress: 0, msg: 'Preparando' })
    const st = useStore.getState()
    const job = st.startJob(`Exportando lámina ${comp.page.width}×${comp.page.height}`)
    try {
      const { blob, ss } = await renderCompositionBlob(comp, format, (f, label) => {
        setState((s) => ({ ...s, progress: f, msg: label }))
        useStore.getState().updateJob(job, f, label)
      })
      setState({ phase: 'ready', blob, url: URL.createObjectURL(blob), ss })
    } catch (e) {
      setState({ phase: 'error', msg: (e as Error).message })
    } finally {
      useStore.getState().endJob(job)
    }
  }
  const save = async (): Promise<void> => {
    if (!state.blob) return
    try {
      const data = new Uint8Array(await state.blob.arrayBuffer())
      const res = await window.api.saveBinary({
        suggestedName: `${comp.name.replace(/[\\/:*?"<>|]/g, '_')}.${format}`,
        filterName: format === 'png' ? 'Imagen PNG' : 'Imagen JPG',
        extensions: format === 'png' ? ['png'] : ['jpg', 'jpeg'],
        data
      })
      if (!res) return // cancelado: no se afirma nada
      setState((s) => ({ ...s, phase: 'saved', path: res.path, size: res.size }))
      useStore.getState().toast({ kind: 'success', title: 'Lámina exportada', detail: `${res.path} · ${fmtBytes(res.size)}`, action: { label: 'Mostrar en carpeta', run: () => window.api.showItem(res.path) } })
    } catch (e) {
      setState((s) => ({ ...s, phase: 'error', msg: `No se pudo escribir el archivo: ${(e as Error).message}` }))
    }
  }
  return (
    <Modal title="Exportar lámina" onClose={() => state.phase !== 'working' && onClose()} wide footer={
      <>
        <span className="grow hint">{comp.page.width}×{comp.page.height} px · definición {QUALITY_INFO[comp.page.quality].label.toLowerCase()}</span>
        <button className="btn" disabled={state.phase === 'working'} onClick={onClose}>Cerrar</button>
        <button className="btn" disabled={state.phase === 'working' || cap.level === 'err'} onClick={generate}>{state.phase === 'idle' || state.phase === 'error' ? 'Generar vista previa' : 'Regenerar'}</button>
        <button className="btn primary" disabled={!state.blob || state.phase === 'working'} onClick={save}>Guardar {format.toUpperCase()}…</button>
      </>
    }>
      <div className="row">
        <Seg value={format} onChange={(v) => { setFormat(v); setState({ phase: 'idle' }) }} options={[{ value: 'png', label: 'PNG (sin pérdida)' }, { value: 'jpg', label: `JPG (calidad ${Math.round(QUALITY_INFO[comp.page.quality].jpg * 100)} %)` }]} />
      </div>
      <div className={`capacity ${cap.level}`}>{cap.message}</div>
      {state.phase === 'idle' && <div className="hint">Pulsa «Generar vista previa» para crear la imagen final a tamaño completo. Podrás revisarla antes de guardarla.</div>}
      {state.phase === 'working' && (
        <div className="row"><span className="spinner" /> {state.msg} <span className="progress"><div style={{ width: `${(state.progress ?? 0) * 100}%` }} /></span></div>
      )}
      {state.phase === 'error' && <div className="callout err"><b>No se pudo exportar.</b> {state.msg}</div>}
      {state.url && (
        <>
          <img className="preview-img" src={state.url} alt="Vista previa de la exportación" />
          <div className="kv">
            <span>Tamaño</span><span>{comp.page.width}×{comp.page.height} px (generado a {state.ss}× y reducido)</span>
            <span>Archivo</span><span>{format.toUpperCase()} · {fmtBytes(state.blob?.size ?? 0)}</span>
          </div>
        </>
      )}
      {state.phase === 'saved' && (
        <div className="callout ok">
          Archivo guardado y comprobado en disco: <b>{state.path}</b> ({fmtBytes(state.size ?? 0)}).{' '}
          <button className="btn small" onClick={() => state.path && window.api.showItem(state.path)}>Mostrar en carpeta</button>
        </div>
      )}
    </Modal>
  )
}

function RenderView({ id, onClose }: { id: string; onClose: () => void }): JSX.Element {
  const r = useStore((s) => s.project.renders.find((x) => x.id === id))
  if (!r) return <Modal title="Render" onClose={onClose}>El render ya no existe.</Modal>
  return (
    <Modal title={r.name} onClose={onClose} wide footer={<><button className="btn" onClick={() => downloadRender(r)}>Guardar PNG…</button><button className="btn primary" onClick={() => { useStore.getState().setWorkspace('compositor'); onClose() }}>Ir al Compositor</button></>}>
      <img className="preview-img" src={r.dataUrl} alt={r.name} />
      <div className="kv"><span>Tamaño</span><span>{r.width}×{r.height} px</span><span>Muestras</span><span>{r.samples ?? '—'}</span><span>Creado</span><span>{new Date(r.createdAt).toLocaleString('es-ES')}</span></div>
    </Modal>
  )
}

export const SHORTCUTS: [string, string][] = [
  ['Ctrl+N / Ctrl+O', 'Nuevo / abrir proyecto'],
  ['Ctrl+S / Ctrl+Mayús+S', 'Guardar / guardar como'],
  ['Ctrl+I', 'Importar construcciones'],
  ['Ctrl+Z / Ctrl+Y', 'Deshacer / rehacer'],
  ['Ctrl+D', 'Duplicar selección'],
  ['Supr', 'Eliminar selección'],
  ['H', 'Ocultar / mostrar objeto'],
  ['G / R / S', 'Mover / girar / escalar'],
  ['F', 'Encuadrar selección'],
  ['1 / 3 / 7 / 9 / 4', 'Vista frontal / lateral / superior / isométrica / ¾'],
  ['5', 'Alternar perspectiva y ortográfica'],
  ['Ctrl+K', 'Guardar vista de cámara'],
  ['Espacio', 'Giro 360° de la cámara'],
  ['F12', 'Render final'],
  ['Ctrl+1 / Ctrl+2', 'Estudio 3D / Compositor'],
  ['Ctrl+E', 'Exportar lámina'],
  ['Flechas (+Mayús)', 'Mover elemento de la lámina 1 px (10 px)'],
  ['Esc', 'Deseleccionar / cerrar diálogo'],
  ['Ctrl+,', 'Preferencias (controles y herramientas)'],
  ['Ratón', 'Izq.: orbitar · Der.: desplazar · Rueda: zoom']
]

function Shortcuts({ onClose }: { onClose: () => void }): JSX.Element {
  return (
    <Modal title="Atajos de teclado" onClose={onClose} footer={<button className="btn" onClick={onClose}>Cerrar</button>}>
      <table className="info"><tbody>{SHORTCUTS.map(([k, v]) => <tr key={k}><td style={{ fontFamily: 'var(--mono)' }}>{k}</td><td>{v}</td></tr>)}</tbody></table>
      <div className="hint">Los atajos no actúan mientras escribes en un campo de texto.</div>
    </Modal>
  )
}
