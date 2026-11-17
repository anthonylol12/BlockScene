import { useEffect, useRef, useState, type JSX } from 'react'
import { useStore } from '../state/store'
import { importBuildsAction, loadDemoAction, newProjectAction, openProjectAction, saveProjectAction } from '../state/projectIO'
import { addSceneObject, deleteSelected, duplicateSelected, renderSelectedIsolated, saveCurrentView, setView, toggleHideSelected } from '../state/actions'
import { getEngine } from '../engine/Engine'
import { addTextElement, applyTemplateToNew, importImagesToGallery, newComposition } from '../compositor/compActions'

interface Item {
  label: string
  kbd?: string
  run?: () => void
  disabled?: boolean
  sep?: boolean
}

function useMenus(): Record<string, Item[]> {
  const s = useStore()
  const inStudio = s.workspace === 'studio'
  const hasSel = inStudio ? !!s.selectedId : !!s.compSelectedId
  const comp = s.project.compositions.find((c) => c.id === s.project.activeCompositionId)
  return {
    Archivo: [
      { label: 'Nueva escena paso a paso…', kbd: 'Ctrl+Mayús+N', run: () => s.setModal({ type: 'wizard' }) },
      { label: 'Nuevo proyecto', kbd: 'Ctrl+N', run: newProjectAction },
      { label: 'Abrir proyecto…', kbd: 'Ctrl+O', run: openProjectAction },
      { label: 'Guardar', kbd: 'Ctrl+S', run: () => saveProjectAction(false) },
      { label: 'Guardar como…', kbd: 'Ctrl+Mayús+S', run: () => saveProjectAction(true) },
      { sep: true, label: '' },
      { label: 'Importar construcciones…', kbd: 'Ctrl+I', run: importBuildsAction },
      { label: 'Añadir imágenes a la galería…', run: importImagesToGallery },
      { label: 'Formatos compatibles', run: () => s.setModal({ type: 'formats' }) },
      { sep: true, label: '' },
      { label: 'Cargar escena de demostración (ejemplo)', run: loadDemoAction },
      { sep: true, label: '' },
      { label: 'Salir', run: () => window.close() }
    ],
    Editar: [
      { label: 'Deshacer', kbd: 'Ctrl+Z', run: s.undo, disabled: !s.undoStack.length },
      { label: 'Rehacer', kbd: 'Ctrl+Y', run: s.redo, disabled: !s.redoStack.length },
      { sep: true, label: '' },
      { label: 'Duplicar', kbd: 'Ctrl+D', run: duplicateSelected, disabled: !hasSel },
      { label: 'Eliminar', kbd: 'Supr', run: deleteSelected, disabled: !hasSel },
      { label: 'Ocultar / mostrar', kbd: 'H', run: toggleHideSelected, disabled: !inStudio || !hasSel },
      { label: 'Deseleccionar', kbd: 'Esc', run: () => (inStudio ? s.select(null) : s.selectElement(null)) },
      { sep: true, label: '' },
      { label: 'Mover', kbd: 'G', run: () => s.setTransformMode('translate'), disabled: !inStudio },
      { label: 'Girar', kbd: 'R', run: () => s.setTransformMode('rotate'), disabled: !inStudio },
      { label: 'Escalar', kbd: 'S', run: () => s.setTransformMode('scale'), disabled: !inStudio },
      { sep: true, label: '' },
      { label: 'Preferencias…', kbd: 'Ctrl+,', run: () => s.setModal({ type: 'prefs' }) },
      { label: 'Atajos de teclado', kbd: 'F1', run: () => s.setModal({ type: 'shortcuts' }) }
    ],
    Escena: [
      { label: 'Base de exhibición', run: () => addSceneObject('base'), disabled: !inStudio },
      { label: 'Terreno', run: () => addSceneObject('terrain'), disabled: !inStudio },
      { label: 'Agua', run: () => addSceneObject('water'), disabled: !inStudio },
      { label: 'Camino', run: () => addSceneObject('path'), disabled: !inStudio },
      { label: 'Roca', run: () => addSceneObject('rock'), disabled: !inStudio },
      { label: 'Árbol', run: () => addSceneObject('tree'), disabled: !inStudio },
      { label: 'Vegetación', run: () => addSceneObject('vegetation'), disabled: !inStudio },
      { label: 'Luz', run: () => addSceneObject('light'), disabled: !inStudio },
      { label: 'Decoración', run: () => addSceneObject('decor'), disabled: !inStudio },
      { sep: true, label: '' },
      { label: 'Encuadrar selección', kbd: 'F', run: () => getEngine()?.frameSelection(), disabled: !inStudio },
      { label: 'Vista frontal', kbd: '1', run: () => setView('front'), disabled: !inStudio },
      { label: 'Vista lateral', kbd: '3', run: () => setView('side'), disabled: !inStudio },
      { label: 'Vista superior', kbd: '7', run: () => setView('top'), disabled: !inStudio },
      { label: 'Vista isométrica', kbd: '9', run: () => setView('iso'), disabled: !inStudio },
      { label: 'Perspectiva ¾', kbd: '4', run: () => setView('threeQuarter'), disabled: !inStudio },
      { label: 'Alternar perspectiva / ortográfica', kbd: '5', run: () => getEngine()?.toggleProjection(), disabled: !inStudio },
      { label: 'Guardar vista actual', kbd: 'Ctrl+K', run: saveCurrentView, disabled: !inStudio }
    ],
    Render: [
      { label: 'Render final…', kbd: 'F12', run: () => s.setModal({ type: 'render' }), disabled: !inStudio },
      { label: 'Render aislado de la construcción (PNG transparente)', run: renderSelectedIsolated, disabled: !inStudio },
      { sep: true, label: '' },
      { label: 'Calidad del visor: baja', run: () => s.setEnvSub('quality', { preset: 'low' }) },
      { label: 'Calidad del visor: media', run: () => s.setEnvSub('quality', { preset: 'medium' }) },
      { label: 'Calidad del visor: alta', run: () => s.setEnvSub('quality', { preset: 'high' }) }
    ],
    Composición: [
      { label: 'Ir al Compositor', kbd: 'Ctrl+2', run: () => s.setWorkspace('compositor') },
      { label: 'Nueva lámina en blanco', run: newComposition },
      { label: 'Nueva desde plantilla: Catálogo limpio', run: () => applyTemplateToNew('catalog') },
      { label: 'Nueva desde plantilla: Póster de colección', run: () => applyTemplateToNew('poster') },
      { label: 'Nueva desde plantilla: Ficha individual', run: () => applyTemplateToNew('sheet') },
      { sep: true, label: '' },
      { label: 'Añadir título', run: () => addTextElement('title'), disabled: !comp },
      { label: 'Añadir subtítulo', run: () => addTextElement('subtitle'), disabled: !comp },
      { label: 'Añadir etiqueta', run: () => addTextElement('label'), disabled: !comp },
      { label: 'Añadir créditos', run: () => addTextElement('credits'), disabled: !comp },
      { label: 'Añadir marca de agua', run: () => addTextElement('watermark'), disabled: !comp },
      { sep: true, label: '' },
      { label: 'Formato de la lámina…', run: () => s.setModal({ type: 'pageSetup' }), disabled: !comp },
      { label: 'Exportar lámina (PNG/JPG)…', kbd: 'Ctrl+E', run: () => s.setModal({ type: 'export' }), disabled: !comp }
    ]
  }
}

export function MenuBar(): JSX.Element {
  const menus = useMenus()
  const [open, setOpen] = useState<string | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent): void => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null)
    }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [])
  return (
    <div className="menus" ref={ref}>
      {Object.entries(menus).map(([name, items]) => (
        <div key={name} style={{ position: 'relative' }}>
          <button
            className={`menu-btn ${open === name ? 'open' : ''}`}
            aria-haspopup="menu"
            aria-expanded={open === name}
            onClick={() => setOpen(open === name ? null : name)}
            onMouseEnter={() => open && setOpen(name)}
          >
            {name}
          </button>
          {open === name && (
            <div className="menu-pop" role="menu">
              {items.map((it, i) =>
                it.sep ? (
                  <div key={i} className="menu-sep" />
                ) : (
                  <button
                    key={i}
                    role="menuitem"
                    className="menu-item"
                    disabled={it.disabled}
                    onClick={() => {
                      setOpen(null)
                      it.run?.()
                    }}
                  >
                    <span>{it.label}</span>
                    {it.kbd && <kbd>{it.kbd}</kbd>}
                  </button>
                )
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
