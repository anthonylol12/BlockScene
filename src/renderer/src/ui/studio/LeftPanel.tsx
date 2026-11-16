import { useState, type JSX } from 'react'
import type { ObjectKind } from '@shared/types'
import { useStore } from '../../state/store'
import { importBuildsAction } from '../../state/projectIO'
import { addSceneObject } from '../../state/actions'
import { KIND_LABEL } from '../../state/defaults'
import { Icon, KIND_ICON } from '../icons'
import { Section, fmtInt } from '../controls'
import { getEngine } from '../../engine/Engine'

export function LeftPanel(): JSX.Element {
  const project = useStore((s) => s.project)
  const selectedId = useStore((s) => s.selectedId)
  const assetStatus = useStore((s) => s.assetStatus)
  const st = useStore.getState()
  const [editing, setEditing] = useState<string | null>(null)
  const builds = project.objects.filter((o) => o.kind === 'build')
  const totalBlocks = builds.reduce((n, o) => n + (o.assetId ? (project.assets[o.assetId]?.info.blockCount ?? 0) : 0), 0)
  const isDemo = Object.values(project.assets).some((a) => a.isDemo)

  return (
    <div className="panel left">
      <div className="panel-head">
        <Icon name="folder" size={13} /> <span className="grow">Proyecto</span>
        {isDemo && <span className="demo-badge" title="Contiene una construcción generada de ejemplo">EJEMPLO</span>}
      </div>
      <div className="panel-body">
        <Section title="Proyecto">
          <input className="input" aria-label="Nombre del proyecto" value={project.name} onChange={(e) => st.setProjectName(e.target.value)} />
          <div className="kv">
            <span>Construcciones</span>
            <span>{builds.length}</span>
            <span>Bloques (reales)</span>
            <span>{fmtInt(totalBlocks)}</span>
            <span>Objetos</span>
            <span>{project.objects.length}</span>
            <span>Renders</span>
            <span>{project.renders.length}</span>
          </div>
          <div className="row">
            <button className="btn primary small" style={{ flex: 1 }} onClick={importBuildsAction} title="Ctrl+I">
              <Icon name="import" size={13} /> Importar
            </button>
            <select
              className="select"
              style={{ flex: 1, height: 24 }}
              aria-label="Añadir elemento de escena"
              value=""
              onChange={(e) => e.target.value && addSceneObject(e.target.value as Exclude<ObjectKind, 'build'>)}
            >
              <option value="">＋ Añadir…</option>
              {(['base', 'terrain', 'water', 'path', 'rock', 'tree', 'vegetation', 'light', 'decor'] as const).map((k) => (
                <option key={k} value={k}>
                  {KIND_LABEL[k]}
                </option>
              ))}
            </select>
          </div>
        </Section>

        <Section title="Colecciones y objetos" extra={<button className="icon-btn" title="Nueva colección" aria-label="Nueva colección" onClick={(e) => { e.preventDefault(); st.addLayer() }}><Icon name="plus" size={13} /></button>}>
          <div style={{ margin: '0 -10px' }}>
            {project.layers.map((l) => {
              const objs = project.objects.filter((o) => o.layerId === l.id)
              return (
                <div className="tree-layer" key={l.id}>
                  <div className="tree-row layer" onDoubleClick={() => setEditing(l.id)}>
                    <span className="dot" style={{ background: l.color }} />
                    {editing === l.id ? (
                      <input
                        className="input"
                        autoFocus
                        defaultValue={l.name}
                        onBlur={(e) => {
                          st.updateLayer(l.id, { name: e.target.value || l.name })
                          setEditing(null)
                        }}
                        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
                      />
                    ) : (
                      <span className={`name ${l.visible ? '' : 'dim'}`}>{l.name}</span>
                    )}
                    <span className="muted small">{objs.length}</span>
                    <span className="acts">
                      {project.layers.length > 1 && (
                        <button className="icon-btn" title="Eliminar colección (los objetos pasan a la primera)" aria-label="Eliminar colección" onClick={() => st.removeLayer(l.id)}>
                          <Icon name="trash" size={13} />
                        </button>
                      )}
                    </span>
                    <button className="icon-btn" aria-label={l.visible ? 'Ocultar colección' : 'Mostrar colección'} title={l.visible ? 'Ocultar colección' : 'Mostrar colección'} onClick={() => st.updateLayer(l.id, { visible: !l.visible })}>
                      <Icon name={l.visible ? 'eye' : 'eyeOff'} size={13} />
                    </button>
                  </div>
                  {objs.map((o) => {
                    const status = o.assetId ? assetStatus[o.assetId] : undefined
                    const demo = o.assetId ? project.assets[o.assetId]?.isDemo : false
                    return (
                      <div
                        key={o.id}
                        className={`tree-row obj ${selectedId === o.id ? 'sel' : ''}`}
                        onClick={() => st.select(o.id)}
                        onDoubleClick={() => {
                          st.select(o.id)
                          setTimeout(() => getEngine()?.frameSelection(), 0)
                        }}
                        title={KIND_LABEL[o.kind]}
                      >
                        <span className="kind"><Icon name={KIND_ICON[o.kind]} size={13} /></span>
                        <span className={`name ${o.visible && l.visible ? '' : 'dim'}`}>{o.name}</span>
                        {demo && <span className="tag demo">DEMO</span>}
                        {status?.state === 'loading' && <span className="spinner" title="Generando malla…" />}
                        {status?.state === 'error' && <span className="tag err" title={status.message}>ERROR</span>}
                        <span className="acts">
                          <button className="icon-btn" aria-label="Quitar de la escena" title="Quitar de la escena (Supr)" onClick={(e) => { e.stopPropagation(); st.removeObjects([o.id]) }}>
                            <Icon name="trash" size={13} />
                          </button>
                        </span>
                        <button className="icon-btn" aria-label={o.visible ? 'Ocultar' : 'Mostrar'} title={o.visible ? 'Ocultar (H)' : 'Mostrar (H)'} onClick={(e) => { e.stopPropagation(); st.updateObject(o.id, { visible: !o.visible }) }}>
                          <Icon name={o.visible ? 'eye' : 'eyeOff'} size={13} />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )
            })}
          </div>
          {!project.objects.length && <div className="empty">La escena está vacía.<br />Importa archivos .schem, .schematic, .litematic, .nbt o .mca.</div>}
        </Section>
      </div>
    </div>
  )
}
