import type { JSX } from 'react'
import { useStore } from '../state/store'
import { cancelRender } from '../state/actions'

export function StatusBar(): JSX.Element {
  const jobs = useStore((s) => s.jobs)
  const path = useStore((s) => s.projectPath)
  const dirty = useStore((s) => s.dirty)
  const ws = useStore((s) => s.workspace)
  return (
    <div className="statusbar" role="status" aria-live="polite">
      {jobs.length === 0 && <span>Listo</span>}
      {jobs.slice(0, 3).map((j) => (
        <span className="job" key={j.id}>
          <span className="spinner" />
          {j.label}
          {j.stage && <span className="muted">· {j.stage}</span>}
          <span className={`progress ${j.progress < 0 ? 'indet' : ''}`}>
            <div style={{ width: `${Math.max(0, j.progress) * 100}%` }} />
          </span>
          {j.progress >= 0 && <span>{Math.round(j.progress * 100)}%</span>}
          {j.label.startsWith('Render') && (
            <button className="btn small" style={{ height: 18 }} onClick={cancelRender}>Cancelar</button>
          )}
        </span>
      ))}
      {jobs.length > 3 && <span>+{jobs.length - 3} tareas</span>}
      <span className="grow" />
      <span>{ws === 'studio' ? 'Estudio 3D' : 'Compositor'}</span>
      <span title={path ?? ''}>{path ? path.split(/[\\/]/).pop() : 'Sin guardar'}{dirty ? ' • modificado' : ''}</span>
    </div>
  )
}
