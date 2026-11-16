import { useEffect, useState, type JSX } from 'react'
import { useStore } from '../state/store'
import { defaultEnvironment } from '../state/defaults'
import { DEFAULT_PREFS, MOUSE_SCHEMES, prefsStore, resetPrefs, setPrefs } from '../state/prefs'
import { Field, Modal, NumInput, Seg, Slider, Toggle } from './controls'

function resetLayout(): void {
  const el = document.querySelector('.studio') as HTMLElement | null
  el?.style.removeProperty('--left')
  el?.style.removeProperty('--right')
}

export function PrefsModal({ onClose }: { onClose: () => void }): JSX.Element {
  const [, force] = useState(0)
  useEffect(() => prefsStore.subscribe(() => force((x) => x + 1)), [])
  const p = prefsStore.get()
  const st = useStore.getState()
  const scheme = MOUSE_SCHEMES.find((m) => m.value === p.mouse)
  const confirmDo = (msg: string, fn: () => void): void => {
    if (window.confirm(msg)) {
      fn()
      st.toast({ kind: 'success', title: 'Valores por defecto restablecidos' }, 2500)
    }
  }
  return (
    <Modal title="Preferencias" onClose={onClose} wide footer={<button className="btn primary" onClick={onClose}>Cerrar</button>}>
      <div className="grid2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <b>Controles de cámara</b>
          <Field label="Ratón"><Seg value={p.mouse} onChange={(v) => setPrefs({ mouse: v })} options={MOUSE_SCHEMES.map((m) => ({ value: m.value, label: m.label }))} /></Field>
          <div className="hint">{scheme?.detail}</div>
          <Field label="Vel. órbita"><Slider value={p.orbitSpeed} min={0.2} max={3} onChange={(v) => setPrefs({ orbitSpeed: v })} /></Field>
          <Field label="Vel. zoom"><Slider value={p.zoomSpeed} min={0.2} max={3} onChange={(v) => setPrefs({ zoomSpeed: v })} /></Field>
          <Field label="Vel. desplazar"><Slider value={p.panSpeed} min={0.2} max={3} onChange={(v) => setPrefs({ panSpeed: v })} /></Field>
          <Field label="Invertir zoom"><Toggle checked={p.invertZoom} onChange={(v) => setPrefs({ invertZoom: v })} /></Field>
          <Field label="Cámara suave" title="Inercia al soltar el ratón"><Toggle checked={p.smoothCamera} onChange={(v) => setPrefs({ smoothCamera: v })} /></Field>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <b>Herramientas</b>
          <Field label="Al empezar"><Seg value={p.defaultTool} onChange={(v) => { setPrefs({ defaultTool: v }); st.setTransformMode(v) }} options={[{ value: 'translate', label: 'Mover' }, { value: 'rotate', label: 'Girar' }, { value: 'scale', label: 'Escalar' }]} /></Field>
          <Field label="Ajuste mover" title="Paso al mover con el gizmo, en bloques (0 = libre)"><NumInput value={p.snapMove} min={0} step={0.5} decimals={2} onChange={(v) => setPrefs({ snapMove: v })} /></Field>
          <div className="hint">1 = mover de bloque en bloque (recomendado para alinear construcciones). 0 = libre.</div>
          <Field label="Ajuste girar"><Seg value={String(p.snapRotate)} onChange={(v) => setPrefs({ snapRotate: +v })} options={[{ value: '0', label: 'Libre' }, { value: '15', label: '15°' }, { value: '45', label: '45°' }, { value: '90', label: '90°' }]} /></Field>
          <Field label="Ajuste escalar" title="Paso al escalar (0 = libre)"><NumInput value={p.snapScale} min={0} step={0.05} decimals={2} onChange={(v) => setPrefs({ snapScale: v })} /></Field>
          <Field label="Tamaño gizmo"><Slider value={p.gizmoSize} min={0.5} max={2} onChange={(v) => setPrefs({ gizmoSize: v })} /></Field>
        </div>
      </div>
      <div className="callout" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <b style={{ color: 'var(--text)' }}>Restablecer valores por defecto</b>
        <div className="row wrap">
          <button className="btn small" onClick={() => confirmDo('¿Restablecer los controles de cámara y las herramientas?', resetPrefs)}>Controles y herramientas</button>
          <button className="btn small" onClick={() => confirmDo('¿Restablecer la luz, el cielo, el fondo, los materiales y el postprocesado de este proyecto?', () => st.setEnv(defaultEnvironment()))}>Escena y render del proyecto</button>
          <button className="btn small" onClick={() => confirmDo('¿Restablecer el tamaño de los paneles?', resetLayout)}>Diseño de paneles</button>
          <button className="btn small danger" onClick={() => confirmDo('¿Restablecer controles, herramientas, escena, render y paneles?', () => { resetPrefs(); st.setEnv(defaultEnvironment()); resetLayout() })}>Todo</button>
        </div>
        <div className="hint">No afecta a tus construcciones, renders ni láminas. Valores por defecto: ratón {MOUSE_SCHEMES.find((m) => m.value === DEFAULT_PREFS.mouse)?.label}, mover de {DEFAULT_PREFS.snapMove} en {DEFAULT_PREFS.snapMove} bloques, giro cada {DEFAULT_PREFS.snapRotate}°.</div>
      </div>
    </Modal>
  )
}
