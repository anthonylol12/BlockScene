import { useState, type JSX } from 'react'
import { useStore } from '../../state/store'
import { saveCurrentView, setView } from '../../state/actions'
import { getEngine } from '../../engine/Engine'
import { Icon } from '../icons'

export function BottomBar(): JSX.Element {
  const cameras = useStore((s) => s.project.cameras)
  const mainId = useStore((s) => s.project.mainCameraId)
  const tt = useStore((s) => s.turntable)
  const sunCycle = useStore((s) => s.sunCycle)
  const st = useStore.getState()
  const [fov, setFov] = useState(45)
  const [renaming, setRenaming] = useState<string | null>(null)

  return (
    <div className="bottombar" role="toolbar" aria-label="Cámaras y animación">
      <div className="bb-group">
        <span className="bb-label">Vista</span>
        <button className="btn small" title="Frontal (1)" onClick={() => setView('front')}>Frontal</button>
        <button className="btn small" title="Lateral (3)" onClick={() => setView('side')}>Lateral</button>
        <button className="btn small" title="Superior (7)" onClick={() => setView('top')}>Superior</button>
        <button className="btn small" title="Isométrica ortográfica (9)" onClick={() => setView('iso')}>Isométrica</button>
        <button className="btn small" title="Perspectiva ¾ (4)" onClick={() => setView('threeQuarter')}>¾</button>
        <button className="btn small" title="Alternar perspectiva/ortográfica (5)" onClick={() => getEngine()?.toggleProjection()}>Persp/Orto</button>
      </div>
      <div className="bb-group" title="Campo de visión de la cámara en perspectiva">
        <span className="bb-label">FOV</span>
        <input type="range" aria-label="Campo de visión" min={15} max={90} value={fov} style={{ width: 70 }} onChange={(e) => { const v = +e.target.value; setFov(v); getEngine()?.setFov(v) }} />
        <span className="small muted" style={{ width: 26 }}>{fov}°</span>
      </div>
      <div className="bb-group" style={{ flexWrap: 'wrap' }}>
        <span className="bb-label">Cámaras</span>
        {cameras.map((c) => (
          <span key={c.id} className={`view-chip ${c.id === mainId ? 'main' : ''}`} title={c.id === mainId ? 'Cámara principal (se usa por defecto en el render final)' : 'Vista guardada'}>
            {renaming === c.id ? (
              <input className="input" style={{ height: 20, width: 90 }} autoFocus defaultValue={c.name}
                onBlur={(e) => { st.updateCamera(c.id, { name: e.target.value || c.name }); setRenaming(null) }}
                onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()} />
            ) : (
              <button className="lbl" onClick={() => getEngine()?.applyView(c)} onDoubleClick={() => setRenaming(c.id)}>{c.name}</button>
            )}
            <button className={`icon-btn ${c.id === mainId ? 'on' : ''}`} style={{ width: 20, height: 20 }} aria-label="Usar como cámara principal" title="Usar como cámara principal" onClick={() => st.setMainCamera(c.id)}><Icon name="star" size={12} /></button>
            <button className="icon-btn" style={{ width: 20, height: 20 }} aria-label="Actualizar con la vista actual" title="Sobrescribir con la vista actual" onClick={() => { const e = getEngine(); if (e) { const v = e.currentView(c.name, c.id); st.updateCamera(c.id, v) } }}><Icon name="save" size={12} /></button>
            <button className="icon-btn" style={{ width: 20, height: 20 }} aria-label="Eliminar vista" title="Eliminar vista" onClick={() => st.removeCamera(c.id)}><Icon name="close" size={11} /></button>
          </span>
        ))}
        <button className="btn small" onClick={saveCurrentView} title="Guardar la vista actual (Ctrl+K)"><Icon name="plus" size={12} /> Guardar vista</button>
      </div>
      <div className="bb-group">
        <span className="bb-label">Animación</span>
        <button className={`btn small ${tt.playing ? 'primary' : ''}`} title="Giro de cámara alrededor del objetivo (Espacio)" onClick={() => st.setTurntable({ playing: !tt.playing })}>
          <Icon name={tt.playing ? 'pause' : 'play'} size={12} /> Giro 360°
        </button>
        <input type="range" aria-label="Velocidad de giro" min={0.05} max={1.5} step={0.05} value={tt.speed} style={{ width: 60 }} onChange={(e) => st.setTurntable({ speed: +e.target.value })} title="Velocidad de giro" />
        <button className={`btn small ${sunCycle ? 'primary' : ''}`} title="Anima la hora del día (≈1,2 h por segundo)" onClick={() => st.setSunCycle(!sunCycle)}>
          <Icon name={sunCycle ? 'pause' : 'sun'} size={12} /> Ciclo solar
        </button>
        <button className="btn small" title="Guarda el giro 360° o el ciclo solar como vídeo MP4/WebM o GIF (Ctrl+Mayús+F12)" onClick={() => st.setModal({ type: 'animation' })}>
          <Icon name="camera" size={12} /> Vídeo / GIF…
        </button>
      </div>
    </div>
  )
}
