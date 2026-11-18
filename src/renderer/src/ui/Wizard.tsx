// Asistente de primera escena: construcción → texturas → base → estilo → render y lámina.
// Es un panel flotante (no bloquea el visor) para ver cada cambio en directo.
import { useEffect, useState, type JSX } from 'react'
import { useStore } from '../state/store'
import { importFiles } from '../state/importer'
import { makeObject } from '../state/defaults'
import { newProject } from '../state/defaults'
import { meshCache } from '../state/importer'
import { saveProjectAction } from '../state/projectIO'
import { renderToGallery } from '../state/actions'
import { BUILTIN_LOOKS, applyLook } from '../state/looks'
import { BASE_OPTIONS, TEMPLATE_OPTIONS, baseForBuild, lookSummary, recommendedTemplate, type BaseOption } from '../state/wizard'
import { addRenderToSheet } from '../compositor/compActions'
import type { TemplateId } from '../compositor/templates'
import { generateDemoSchem } from '../core/demo'
import { SUPPORTED_FORMATS } from '../core/formats'
import { getEngine, type StandardView } from '../engine/Engine'
import { atlas } from '../state/atlas'
import { BuildInfoView, TexturesSection } from './studio/RightPanel'
import { Seg } from './controls'
import { Icon } from './icons'

const STEPS = ['Construcción', 'Texturas', 'Base', 'Estilo', 'Render y lámina']
const LOOK_CHOICES = ['exhibicion', 'pastel', 'pergamino', 'hora-dorada', 'natural', 'invierno', 'noche-cine', 'estudio-claro']

export function Wizard({ onClose }: { onClose: () => void }): JSX.Element {
  const [step, setStep] = useState(0)
  const [objectId, setObjectId] = useState<string | null>(null)
  const [baseId, setBaseId] = useState<string | null>(null)
  const [baseOpt, setBaseOpt] = useState<string | null>(null)
  const [lookId, setLookId] = useState<string | null>(null)
  const [template, setTemplate] = useState<TemplateId>('showcase')
  const [templateTouched, setTemplateTouched] = useState(false)
  const [samples, setSamples] = useState('16')
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const [, force] = useState(0)
  useEffect(() => atlas.subscribe(() => force((x) => x + 1)), [])

  const obj = useStore((s) => s.project.objects.find((o) => o.id === objectId))
  const asset = useStore((s) => (obj?.assetId ? s.project.assets[obj.assetId] : undefined))
  const status = useStore((s) => (obj?.assetId ? s.assetStatus[obj.assetId] : undefined))
  const ready = status?.state === 'ready'

  // el estilo recomendado cambia la plantilla sugerida (si el usuario no eligió otra)
  useEffect(() => {
    if (!templateTouched) setTemplate(recommendedTemplate(lookId))
  }, [lookId, templateTouched])

  // encuadrar la construcción en cuanto su malla está lista
  useEffect(() => {
    if (ready) setTimeout(() => getEngine()?.setStandardView('threeQuarter'), 50)
  }, [ready])

  /** El asistente empieza en un proyecto nuevo (pidiendo confirmación si hay trabajo sin guardar). */
  const freshProject = (): boolean => {
    const st = useStore.getState()
    if (!objectId && st.project.objects.length) {
      if (st.dirty && !window.confirm('El asistente empieza un proyecto nuevo. Hay cambios sin guardar: ¿descartarlos?')) return false
      meshCache.clear()
      st.loadProject(newProject(), null)
      useStore.getState().setModal({ type: 'wizard' })
    }
    return true
  }

  const load = async (files: { name: string; data: Uint8Array | null; error?: string }[], isDemo = false): Promise<void> => {
    if (!files.length || !freshProject()) return
    setError(null)
    setBusy(`Analizando ${files[0].name}…`)
    // cambiar de archivo: se quita el anterior (y su base)
    const st = useStore.getState()
    const prev = [objectId, baseId].filter(Boolean) as string[]
    if (prev.length) st.removeObjects(prev)
    setBaseId(null)
    setBaseOpt(null)
    const errors: string[] = []
    const ids = await importFiles(files.slice(0, 1), { quiet: true, isDemo, onError: (f, m) => errors.push(`${f}: ${m}`) })
    setBusy(null)
    if (!ids.length) {
      setObjectId(null)
      setError(errors.join('\n') || 'No se pudo importar el archivo.')
      return
    }
    const o = useStore.getState().project.objects.find((x) => x.assetId === ids[0])
    setObjectId(o?.id ?? null)
  }

  const pickFile = async (): Promise<void> => load(await window.api.openBuilds())

  const chooseBase = (opt: BaseOption): void => {
    const st = useStore.getState()
    if (!obj || !asset) return
    setBaseOpt(opt.id)
    const placed = baseForBuild(asset.info, obj.transform.position, opt)
    const existing = baseId ? st.project.objects.find((o) => o.id === baseId) : undefined
    if (!placed) {
      if (existing) st.removeObjects([existing.id])
      setBaseId(null)
    } else if (existing) {
      st.updateObject(existing.id, { name: opt.label, params: placed.params, transform: { ...existing.transform, position: placed.position } })
    } else {
      const b = makeObject('base', st.project.layers.find((l) => l.id === 'layer_env')?.id ?? st.project.layers[0].id)
      b.params = placed.params
      b.transform.position = placed.position
      b.name = opt.label
      st.addObject(b, false)
      setBaseId(b.id)
    }
    st.select(objectId)
  }

  const chooseLook = (id: string): void => {
    const look = BUILTIN_LOOKS.find((l) => l.id === id)
    if (!look) return
    setLookId(id)
    applyLook(look)
  }

  const frame = (v: StandardView): void => getEngine()?.setStandardView(v)

  const renderAndSheet = async (): Promise<void> => {
    setError(null)
    setBusy('Renderizando…')
    useStore.getState().select(null) // sin caja de selección ni gizmo en el render
    const opt = TEMPLATE_OPTIONS.find((t) => t.id === template)!
    const r = await renderToGallery({ width: 1920, height: 1080, samples: +samples, scale: +samples >= 16 ? 2 : 1, cameraId: 'current', transparent: opt.transparent })
    setBusy(null)
    if (!r) {
      setError('El render no se completó. Revisa el aviso de error e inténtalo de nuevo.')
      return
    }
    addRenderToSheet(r.id, template)
    setDone(true)
  }

  const recommendedLook = BASE_OPTIONS.find((b) => b.id === baseOpt)?.look
  const canNext = step === 0 ? ready : true

  return (
    <div className="wizard" role="dialog" aria-label="Asistente de nueva escena">
      <div className="wizard-head">
        <b>Nueva escena paso a paso</b>
        <button className="icon-btn" aria-label="Cerrar el asistente" title="Cerrar (se conserva lo hecho)" onClick={onClose}><Icon name="close" size={12} /></button>
      </div>
      <ol className="wizard-steps">
        {STEPS.map((s, i) => (
          <li key={s} className={i === step ? 'on' : i < step ? 'done' : ''}>
            <button disabled={i > 0 && !ready} onClick={() => setStep(i)}>{i + 1}. {s}</button>
          </li>
        ))}
      </ol>
      <div className="wizard-body">
        {done ? (
          <>
            <div className="callout ok">¡Listo! El render está en la galería y la lámina se abrió en el <b>Compositor</b>. Edita el título y los créditos y pulsa <b>Exportar</b>.</div>
            <div className="row wrap">
              <button className="btn primary small" onClick={() => useStore.getState().setModal({ type: 'export' })}>Exportar lámina…</button>
              <button className="btn small" onClick={() => saveProjectAction(false)}>Guardar proyecto…</button>
              <button className="btn small" onClick={onClose}>Cerrar</button>
            </div>
          </>
        ) : step === 0 ? (
          <>
            <p className="hint">Elige el archivo de tu construcción. Se analiza antes de continuar y verás sus datos reales.</p>
            <div className="row">
              <button className="btn primary small" disabled={!!busy} onClick={pickFile}><Icon name="import" size={12} /> {obj ? 'Cambiar archivo…' : 'Elegir archivo…'}</button>
              <button className="btn small" disabled={!!busy} onClick={() => load([{ name: 'casa-de-ejemplo.schem', data: generateDemoSchem() }], true)}>Usar la casa de ejemplo</button>
            </div>
            <div className="hint small">Formatos: {SUPPORTED_FORMATS.map((f) => f.ext).join(', ')}</div>
            {busy && <div className="row hint"><span className="spinner" /> {busy}</div>}
            {status?.state === 'loading' && <div className="row hint"><span className="spinner" /> Generando la malla 3D…</div>}
            {error && <pre className="callout err wizard-pre">{error}</pre>}
            {asset && <div className="callout" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><BuildInfoView info={asset.info} fileName={asset.fileName} demo={asset.isDemo} /></div>}
          </>
        ) : step === 1 ? (
          <>
            <p className="hint">Con las texturas de tu Minecraft los bloques se ven como en el juego. Puedes seguir sin ellas.</p>
            <div className="wizard-embed"><TexturesSection /></div>
          </>
        ) : step === 2 ? (
          <>
            <p className="hint">La base se ajusta al tamaño de tu construcción ({asset?.info.width}×{asset?.info.length} bloques).</p>
            <div className="wizard-grid">
              {BASE_OPTIONS.map((b) => (
                <button key={b.id} className={`tpl-card ${baseOpt === b.id ? 'sel' : ''}`} onClick={() => chooseBase(b)}>
                  <b>{b.label}</b><span className="hint">{b.detail}</span>
                </button>
              ))}
            </div>
          </>
        ) : step === 3 ? (
          <>
            <p className="hint">Un estilo cambia luz, fondo y postprocesado. Debajo de cada uno verás qué modifica.</p>
            <div className="wizard-grid">
              {LOOK_CHOICES.map((id) => BUILTIN_LOOKS.find((l) => l.id === id)).filter(Boolean).map((l) => (
                <button key={l!.id} className={`tpl-card ${lookId === l!.id ? 'sel' : ''}`} onClick={() => chooseLook(l!.id)} title={l!.description}>
                  <b>{l!.name} {recommendedLook === l!.id && <span className="tag ok">RECOMENDADO</span>}</b>
                  <span className="hint">{lookSummary(l!).slice(0, 4).join(' · ')}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <>
            <p className="hint">Elige la presentación y el encuadre. Al renderizar se crea la lámina automáticamente.</p>
            <div className="wizard-grid">
              {TEMPLATE_OPTIONS.map((t) => (
                <button key={t.id} className={`tpl-card ${template === t.id ? 'sel' : ''}`} onClick={() => { setTemplate(t.id); setTemplateTouched(true) }}>
                  <b>{t.label} {recommendedTemplate(lookId) === t.id && <span className="tag ok">RECOMENDADA</span>}</b>
                  <span className="hint">{t.detail}{t.transparent ? ' · fondo transparente' : ''}</span>
                </button>
              ))}
            </div>
            <div className="row wrap">
              <span className="hint">Encuadre:</span>
              <button className="btn small" onClick={() => frame('threeQuarter')}>¾</button>
              <button className="btn small" onClick={() => frame('iso')}>Isométrica</button>
              <button className="btn small" onClick={() => frame('front')}>Frontal</button>
              <span className="hint">o mueve la cámara en el visor</span>
            </div>
            <div className="row">
              <span className="hint">Calidad:</span>
              <Seg value={samples} onChange={setSamples} options={[{ value: '4', label: 'Rápida' }, { value: '16', label: 'Alta' }, { value: '32', label: 'Máxima' }]} />
            </div>
            {busy && <div className="row hint"><span className="spinner" /> {busy} (progreso en la barra inferior)</div>}
            {error && <div className="callout err">{error}</div>}
            <div className="row wrap">
              <button className="btn primary" disabled={!!busy} onClick={renderAndSheet}><Icon name="camera" size={13} /> Renderizar y crear lámina</button>
              <button className="btn small" disabled={!!busy} onClick={() => saveProjectAction(false)}>Solo guardar el proyecto…</button>
            </div>
          </>
        )}
      </div>
      {!done && (
        <div className="wizard-foot">
          <button className="btn small" disabled={step === 0} onClick={() => setStep(step - 1)}>Atrás</button>
          <span className="grow" />
          {step < STEPS.length - 1 && (
            <button className="btn primary small" disabled={!canNext || !!busy} onClick={() => setStep(step + 1)} title={canNext ? '' : 'Primero elige una construcción'}>
              {step === 2 && !baseOpt ? 'Seguir sin base' : step === 3 && !lookId ? 'Mantener el aspecto actual' : 'Siguiente'}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
