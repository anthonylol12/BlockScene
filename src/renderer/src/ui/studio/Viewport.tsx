import { useEffect, useRef, useState, type JSX } from 'react'
import { Engine, setEngine, getEngine } from '../../engine/Engine'
import { useStore } from '../../state/store'
import { handleDroppedFiles } from '../../state/dropInstall'
import { importBuildsAction, loadDemoAction } from '../../state/projectIO'
import { Icon } from '../icons'

export function Viewport(): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [drag, setDrag] = useState(false)
  const [, force] = useState(0)
  const mode = useStore((s) => s.transformMode)
  const hasObjects = useStore((s) => s.project.objects.length > 0)
  const busy = useStore((s) => s.jobs.length > 0)
  const quality = useStore((s) => s.project.environment.quality.preset)
  const setMode = useStore((s) => s.setTransformMode)

  useEffect(() => {
    if (!ref.current) return
    let engine: Engine | null = null
    try {
      engine = new Engine(ref.current)
      setEngine(engine)
    } catch (e) {
      setError(`No se pudo iniciar WebGL: ${(e as Error).message}. Comprueba que la aceleración por hardware está activada y los controladores de la GPU están actualizados.`)
    }
    const t = setInterval(() => force((x) => x + 1), 1000)
    return () => {
      clearInterval(t)
      engine?.dispose()
      setEngine(null)
    }
  }, [])

  const onDrop = async (e: React.DragEvent): Promise<void> => {
    e.preventDefault()
    e.stopPropagation()
    setDrag(false)
    const files = [...e.dataTransfer.files]
    if (files.length) await handleDroppedFiles(files)
  }

  const eng = getEngine()
  return (
    <div
      className="viewport"
      ref={ref}
      onDragOver={(e) => {
        e.preventDefault()
        setDrag(true)
      }}
      onDragLeave={() => setDrag(false)}
      onDrop={onDrop}
    >
      {error && (
        <div className="vp-empty">
          <div className="card callout err">{error}</div>
        </div>
      )}
      <div className="vp-toolbar" role="toolbar" aria-label="Herramientas de transformación">
        <button className={`icon-btn ${mode === 'translate' ? 'on' : ''}`} title="Mover (G)" aria-label="Mover" onClick={() => setMode('translate')}><Icon name="move" /></button>
        <button className={`icon-btn ${mode === 'rotate' ? 'on' : ''}`} title="Girar (R)" aria-label="Girar" onClick={() => setMode('rotate')}><Icon name="rotate" /></button>
        <button className={`icon-btn ${mode === 'scale' ? 'on' : ''}`} title="Escalar (S)" aria-label="Escalar" onClick={() => setMode('scale')}><Icon name="scale" /></button>
        <div style={{ height: 1, background: 'var(--line2)', margin: '2px 4px' }} />
        <button className="icon-btn" title="Encuadrar selección (F)" aria-label="Encuadrar selección" onClick={() => eng?.frameSelection()}><Icon name="frame" /></button>
      </div>
      <div className="vp-top">
        <span className="vp-chip" title="Proyección de la cámara (5)">{eng?.isOrtho ? 'Ortográfica' : 'Perspectiva'}</span>
        <span className="vp-chip" title="Calidad del visor en tiempo real (vista previa rápida)">Vista previa · {quality === 'low' ? 'baja' : quality === 'medium' ? 'media' : 'alta'}</span>
        <span className="vp-chip">{eng?.stats.fps ?? 0} fps · {((eng?.stats.triangles ?? 0) / 1000).toFixed(0)} k triángulos</span>
      </div>
      {!hasObjects && !busy && !error && (
        <div className="vp-empty">
          <div className="card">
            <h2>Empieza importando una construcción</h2>
            <p>
              Arrastra aquí archivos <b>.schem</b>, <b>.schematic</b>, <b>.litematic</b>, <b>.nbt</b> o una región de mundo <b>.mca</b>, o usa el botón Importar. Cada archivo se analiza y se muestra como un objeto independiente.
            </p>
            <div className="row" style={{ justifyContent: 'center' }}>
              <button className="btn primary" onClick={() => useStore.getState().setModal({ type: 'wizard' })} title="Te guía para importar, elegir texturas, base, estilo y crear tu primera lámina (Ctrl+Mayús+N)">
                <Icon name="star" /> Crear escena paso a paso
              </button>
              <button className="btn" onClick={importBuildsAction}>
                <Icon name="import" /> Importar construcciones…
              </button>
              <button className="btn" onClick={loadDemoAction} title="Carga una casa GENERADA de ejemplo, marcada como tal">
                Escena de ejemplo
              </button>
            </div>
          </div>
        </div>
      )}
      {drag && <div className="drop-overlay">Suelta para importar</div>}
    </div>
  )
}
