import { useEffect, useRef, type JSX } from 'react'
import { activeComposition, useStore } from './state/store'
import { MenuBar } from './ui/MenuBar'
import { LeftPanel } from './ui/studio/LeftPanel'
import { Viewport } from './ui/studio/Viewport'
import { RightPanel } from './ui/studio/RightPanel'
import { BottomBar } from './ui/studio/BottomBar'
import { StatusBar } from './ui/StatusBar'
import { Modals } from './ui/Modals'
import { CompositorView } from './ui/compositor/CompositorView'
import { Icon } from './ui/icons'
import { importBuildsAction, newProjectAction, openProjectAction, openProjectFromSystem, saveProjectAction } from './state/projectIO'
import { deleteSelected, duplicateSelected, saveCurrentView, setView, toggleHideSelected } from './state/actions'
import { getEngine } from './engine/Engine'
import { initTextures } from './state/textureActions'
import { handleDroppedFiles } from './state/dropInstall'
import { loadShaders } from './state/shaders'
import { loadUserLooks } from './state/looks'
import { loadPrefs } from './state/prefs'

function Toasts(): JSX.Element {
  const toasts = useStore((s) => s.toasts)
  const dismiss = useStore((s) => s.dismissToast)
  return (
    <div className="toasts" aria-live="assertive">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
          <div className="t">
            <span>{t.title}</span>
            <button className="icon-btn" style={{ width: 18, height: 18 }} aria-label="Cerrar aviso" onClick={() => dismiss(t.id)}><Icon name="close" size={10} /></button>
          </div>
          {t.detail && <div className="d">{t.detail}</div>}
          {t.action && (
            <button className="btn small" style={{ marginTop: 6 }} onClick={() => { t.action!.run(); dismiss(t.id) }}>{t.action.label}</button>
          )}
        </div>
      ))}
    </div>
  )
}

function useShortcuts(): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent): void => {
      const s = useStore.getState()
      const tgt = e.target as HTMLElement
      const typing = tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.tagName === 'SELECT' || tgt.isContentEditable)
      const ctrl = e.ctrlKey || e.metaKey
      const k = e.key.toLowerCase()
      if (ctrl) {
        const map: Record<string, () => void> = {
          n: newProjectAction,
          o: openProjectAction,
          s: () => saveProjectAction(e.shiftKey),
          i: importBuildsAction,
          k: saveCurrentView,
          e: () => activeComposition(s) && s.setModal({ type: 'export' }),
          '1': () => s.setWorkspace('studio'),
          '2': () => s.setWorkspace('compositor'),
          ',': () => s.setModal({ type: 'prefs' })
        }
        if (!typing) {
          map.z = () => (e.shiftKey ? s.redo() : s.undo())
          map.y = s.redo
          map.d = duplicateSelected
        }
        const fn = map[k]
        if (fn) {
          e.preventDefault()
          fn()
        }
        return
      }
      if (e.key === 'F12') {
        e.preventDefault()
        if (s.workspace === 'studio') s.setModal({ type: 'render' })
        return
      }
      if (e.key === 'F1') {
        e.preventDefault()
        s.setModal({ type: 'shortcuts' })
        return
      }
      if (typing || s.modal) return
      if (e.key === 'Delete' || e.key === 'Backspace') return deleteSelected()
      if (e.key === 'Escape') return s.workspace === 'studio' ? s.select(null) : s.selectElement(null)
      if (s.workspace === 'compositor') {
        const c = activeComposition(s)
        const el = c?.elements.find((x) => x.id === s.compSelectedId)
        if (c && el && e.key.startsWith('Arrow') && !el.locked) {
          e.preventDefault()
          const d = e.shiftKey ? 10 : 1
          const dx = e.key === 'ArrowLeft' ? -d : e.key === 'ArrowRight' ? d : 0
          const dy = e.key === 'ArrowUp' ? -d : e.key === 'ArrowDown' ? d : 0
          s.updateElement(c.id, el.id, { x: el.x + dx, y: el.y + dy }, !e.repeat)
        }
        return
      }
      const eng = getEngine()
      const keys: Record<string, () => void> = {
        g: () => s.setTransformMode('translate'),
        r: () => s.setTransformMode('rotate'),
        s: () => s.setTransformMode('scale'),
        h: toggleHideSelected,
        f: () => eng?.frameSelection(),
        '1': () => setView('front'),
        '3': () => setView('side'),
        '7': () => setView('top'),
        '9': () => setView('iso'),
        '4': () => setView('threeQuarter'),
        '5': () => eng?.toggleProjection(),
        ' ': () => s.setTurntable({ playing: !s.turntable.playing })
      }
      const fn = keys[k]
      if (fn) {
        e.preventDefault()
        fn()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}

function Splitter({ side }: { side: 'left' | 'right' }): JSX.Element {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <div
      ref={ref}
      className={`splitter ${side}`}
      role="separator"
      aria-orientation="vertical"
      onPointerDown={(e) => {
        const grid = ref.current!.parentElement!
        const startX = e.clientX
        const cur = parseInt(getComputedStyle(grid).getPropertyValue(`--${side}`)) || (side === 'left' ? 260 : 310)
        const move = (ev: PointerEvent): void => {
          const d = ev.clientX - startX
          const v = Math.max(200, Math.min(520, side === 'left' ? cur + d : cur - d))
          grid.style.setProperty(`--${side}`, `${v}px`)
        }
        const up = (): void => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', up)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
      }}
    />
  )
}

export function App(): JSX.Element {
  const workspace = useStore((s) => s.workspace)
  const setWorkspace = useStore((s) => s.setWorkspace)
  const dirty = useStore((s) => s.dirty)
  const name = useStore((s) => s.project.name)
  const isDemo = useStore((s) => Object.values(s.project.assets).some((a) => a.isDemo))
  useShortcuts()
  useEffect(() => {
    initTextures().then(() => openProjectFromSystem())
    loadShaders()
    loadUserLooks()
    loadPrefs()
    window.api.onOpenRequested(() => openProjectFromSystem())
  }, [])
  useEffect(() => {
    window.api.setDirty(dirty)
    window.api.setTitle(`${dirty ? '● ' : ''}${name} — BlockScene`)
  }, [dirty, name])

  return (
    <div
      className="app"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault()
        if (e.dataTransfer.files.length) handleDroppedFiles([...e.dataTransfer.files])
      }}
    >
      <div className="topbar">
        <div className="brand"><span className="logo" /> BlockScene</div>
        <MenuBar />
        <div className="ws-tabs" role="tablist" aria-label="Espacio de trabajo">
          <button role="tab" aria-selected={workspace === 'studio'} className={`ws-tab ${workspace === 'studio' ? 'active' : ''}`} onClick={() => setWorkspace('studio')} title="Ctrl+1">
            <Icon name="cube" size={13} /> Estudio 3D
          </button>
          <button role="tab" aria-selected={workspace === 'compositor'} className={`ws-tab ${workspace === 'compositor' ? 'active' : ''}`} onClick={() => setWorkspace('compositor')} title="Ctrl+2">
            <Icon name="image" size={13} /> Compositor
          </button>
        </div>
        <div className="top-right">
          {isDemo && <span className="demo-badge" title="El proyecto contiene una construcción generada de ejemplo">ESCENA DE EJEMPLO</span>}
          <span>{name}{dirty ? ' •' : ''}</span>
          <button className="icon-btn" title="Preferencias (Ctrl+,)" aria-label="Preferencias" onClick={() => useStore.getState().setModal({ type: 'prefs' })}><Icon name="gear" size={15} /></button>
        </div>
      </div>
      {/* El Estudio se mantiene montado para no perder el contexto WebGL al cambiar de espacio */}
      <div className="workspace studio" style={{ display: workspace === 'studio' ? 'grid' : 'none' }}>
        <LeftPanel />
        <Splitter side="left" />
        <div className="center">
          <Viewport />
        </div>
        <Splitter side="right" />
        <RightPanel />
        <BottomBar />
      </div>
      {workspace === 'compositor' && <CompositorView />}
      <StatusBar />
      <Modals />
      <Toasts />
    </div>
  )
}
