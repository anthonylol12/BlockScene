// Exportar animación: giro 360° y/o ciclo solar como vídeo MP4/WebM o GIF animado.
import { useState, type JSX } from 'react'
import { useStore } from '../state/store'
import { Engine } from '../engine/Engine'
import { cancelRender, exportAnimation } from '../state/actions'
import { ANIM_DEFAULTS, FORMAT_INFO, evenSize, frameCount, gifWarning, type AnimFormat, type AnimKind, type AnimOptions } from '../state/animation'
import { Field, Modal, Seg, Select } from './controls'

const SIZES = [
  { id: '480', label: '854×480', w: 854, h: 480 },
  { id: '720', label: 'HD · 1280×720', w: 1280, h: 720 },
  { id: '1080', label: 'Full HD · 1920×1080', w: 1920, h: 1080 },
  { id: 'sq', label: 'Cuadrado · 1080×1080', w: 1080, h: 1080 },
  { id: 'vert', label: 'Vertical (Reels/TikTok) · 1080×1920', w: 1080, h: 1920 },
  { id: '4k', label: '4K · 3840×2160', w: 3840, h: 2160 }
]

export function AnimationDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const cameras = useStore((s) => s.project.cameras)
  const mainId = useStore((s) => s.project.mainCameraId)
  const builds = useStore((s) => s.project.objects.filter((o) => o.kind === 'build').length)
  const [o, setO] = useState<AnimOptions>(ANIM_DEFAULTS)
  const [size, setSize] = useState('720')
  const [cam, setCam] = useState<string>(mainId ?? 'current')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ f: number; label: string } | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const set = (p: Partial<AnimOptions>): void => setO((x) => ({ ...x, ...p }))
  const n = frameCount(o)
  const maxSide = Engine.maxRenderSide()
  const tooBig = o.width > maxSide || o.height > maxSide
  const warnGif = o.format === 'gif' ? gifWarning(o) : null
  // estimación: ~0,05 s por muestra en 720p con una GPU integrada típica (orientativo)
  const estSec = Math.round(n * o.samples * o.scale * o.scale * (o.width * o.height) / (1280 * 720) * 0.05 + n * 0.02)

  const go = async (): Promise<void> => {
    setBusy(true)
    setSaved(null)
    const r = await exportAnimation(o, cam, (f, label) => setProgress({ f, label }))
    setBusy(false)
    setProgress(null)
    if (r) setSaved(r.path)
  }

  return (
    <Modal title="Exportar animación (vídeo o GIF)" onClose={() => !busy && onClose()} wide footer={
      <>
        <span className="grow hint">{n} fotogramas · cada uno es un render real de la escena{estSec > 0 ? ` · tiempo estimado ≈ ${estSec < 90 ? `${estSec} s` : `${Math.round(estSec / 60)} min`}` : ''}</span>
        {busy ? <button className="btn" onClick={cancelRender}>Cancelar</button> : <button className="btn" onClick={onClose}>Cerrar</button>}
        <button className="btn primary" disabled={busy || tooBig || !builds} onClick={go}>{busy ? 'Generando…' : `Exportar ${FORMAT_INFO[o.format].label}`}</button>
      </>
    }>
      <div className="grid2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="Animación">
            <Seg value={o.kind} onChange={(v) => set({ kind: v as AnimKind })} options={[{ value: 'turntable', label: 'Giro 360°' }, { value: 'sun', label: 'Ciclo solar' }, { value: 'both', label: 'Ambos' }]} />
          </Field>
          <Field label="Formato">
            <Seg value={o.format} onChange={(v) => {
              const f = v as AnimFormat
              // el GIF pesa mucho: tamaño y fps más contenidos por defecto
              if (f === 'gif' && o.width > 854) { setSize('480'); set({ format: f, width: 854, height: 480, fps: 20 }) } else set({ format: f })
            }} options={[{ value: 'mp4', label: 'MP4' }, { value: 'webm', label: 'WebM' }, { value: 'gif', label: 'GIF' }]} />
          </Field>
          <Field label="Tamaño">
            <Select value={size} options={SIZES.map((s) => ({ value: s.id, label: s.label }))} onChange={(v) => {
              setSize(v)
              const s = SIZES.find((x) => x.id === v)!
              set({ width: evenSize(s.w), height: evenSize(s.h) })
            }} />
          </Field>
          <Field label="Duración">
            <Seg value={String(o.seconds)} onChange={(v) => set({ seconds: +v })} options={[{ value: '3', label: '3 s' }, { value: '6', label: '6 s' }, { value: '10', label: '10 s' }, { value: '15', label: '15 s' }]} />
          </Field>
          <Field label="Fotogramas/s">
            <Seg value={String(o.fps)} onChange={(v) => set({ fps: +v })} options={[{ value: '15', label: '15' }, { value: '20', label: '20' }, { value: '24', label: '24' }, { value: '30', label: '30' }, { value: '60', label: '60' }]} />
          </Field>
          <Field label="Calidad" title="Muestras por fotograma: suavizan bordes y sombras">
            <Seg value={String(o.samples)} onChange={(v) => set({ samples: +v })} options={[{ value: '1', label: 'Borrador' }, { value: '4', label: 'Buena' }, { value: '8', label: 'Alta' }, { value: '16', label: 'Máxima' }]} />
          </Field>
          <Field label="Nitidez" title="Superresolución por fotograma (más lenta)">
            <Seg value={String(o.scale)} onChange={(v) => set({ scale: +v })} options={[{ value: '1', label: 'Normal' }, { value: '2', label: 'Alta 2×' }]} />
          </Field>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Field label="Cámara">
            <Select value={cam} onChange={setCam} options={[{ value: 'current', label: 'Vista actual del visor' }, ...cameras.map((c) => ({ value: c.id, label: `${c.name}${c.id === mainId ? ' (principal)' : ''}` }))]} />
          </Field>
          {o.kind !== 'sun' && (
            <>
              <Field label="Giro">
                <Seg value={String(o.degrees)} onChange={(v) => set({ degrees: +v })} options={[{ value: '360', label: '360° (bucle)' }, { value: '180', label: '180°' }, { value: '90', label: '90°' }]} />
              </Field>
              <Field label="Sentido">
                <Seg value={String(o.direction)} onChange={(v) => set({ direction: +v as 1 | -1 })} options={[{ value: '1', label: '↺ Antihorario' }, { value: '-1', label: '↻ Horario' }]} />
              </Field>
            </>
          )}
          {o.kind !== 'turntable' && (
            <Field label="Ciclo solar">
              <Seg value={`${o.sunFrom}-${o.sunTo}`} onChange={(v) => { const [a, b] = v.split('-').map(Number); set({ sunFrom: a, sunTo: b }) }}
                options={[{ value: '6-19', label: 'Amanecer → atardecer' }, { value: '16-21', label: 'Tarde → noche' }, { value: '0-24', label: 'Día completo' }]} />
            </Field>
          )}
          <div className="callout">
            El giro rodea el punto al que mira la cámara (encuadra antes con ¾ o una cámara guardada). Con 360° el último fotograma enlaza con el primero, así que el vídeo o el GIF se repite sin saltos.
          </div>
          {tooBig && <div className="hint warn">La GPU de este equipo admite como máximo {maxSide} px por lado.</div>}
          {!builds && <div className="hint warn">Importa una construcción antes de exportar la animación.</div>}
          {warnGif && <div className="hint warn">{warnGif}</div>}
          {progress && (
            <div className="row hint"><span className="spinner" /> {progress.label} <span className="progress"><div style={{ width: `${progress.f * 100}%` }} /></span></div>
          )}
          {saved && <div className="callout ok">Guardado en {saved} <button className="btn small" onClick={() => window.api.showItem(saved)}>Mostrar en carpeta</button></div>}
        </div>
      </div>
    </Modal>
  )
}
