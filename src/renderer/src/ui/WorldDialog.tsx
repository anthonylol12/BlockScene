// Importar un mundo de Minecraft: se elige el mundo, la dimensión y la zona (centro, tamaño y alturas).
import { useEffect, useState, type JSX } from 'react'
import { DIMENSION_LABEL, parseLevelDat, regionsForArea, type Dimension, type LevelInfo } from '../core/world'
import { importWorldArea } from '../state/worldImport'
import { Field, Modal, NumInput, Seg } from './controls'

interface Loaded { path: string; level: LevelInfo; dims: Record<string, { dir: string; count: number }>; folder: string }
const SIZES = [32, 64, 128, 192, 256]

export function WorldDialog({ onClose }: { onClose: () => void }): JSX.Element {
  const [worlds, setWorlds] = useState<{ path: string; folder: string; modified: number }[] | null>(null)
  const [w, setW] = useState<Loaded | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [dim, setDim] = useState<Dimension>('overworld')
  const [center, setCenter] = useState<'spawn' | 'custom'>('spawn')
  const [cx, setCx] = useState(0)
  const [cz, setCz] = useState(0)
  const [radius, setRadius] = useState(64)
  const [y0, setY0] = useState(40)
  const [y1, setY1] = useState(160)
  const [busy, setBusy] = useState<{ f: number; label: string } | null>(null)

  useEffect(() => { void window.api.worldList().then(setWorlds) }, [])

  const load = async (path: string): Promise<void> => {
    setError(null)
    const info = await window.api.worldInfo(path)
    if ('error' in info) { setError(info.error); return }
    try {
      const level = await parseLevelDat(info.level)
      setW({ path, level, dims: info.dims, folder: info.folder })
      setDim(info.dims.overworld ? 'overworld' : info.dims.nether ? 'nether' : 'end')
      setCx(level.spawn.x)
      setCz(level.spawn.z)
      setCenter('spawn')
      // alturas por defecto: algo por debajo del punto de aparición hasta bastante por encima
      setY0(Math.max(-64, level.spawn.y - 24))
      setY1(Math.min(320, level.spawn.y + 96))
    } catch (e) {
      setError(`No se pudo leer level.dat: ${(e as Error).message}`)
    }
  }
  const pick = async (): Promise<void> => {
    const r = await window.api.worldPick()
    if (!r) return
    if (typeof r !== 'string') { setError(r.error); return }
    await load(r)
  }
  const setDimension = (d: Dimension): void => {
    setDim(d)
    if (d === 'nether') { setY0(0); setY1(128) }
    if (d === 'end') { setY0(0); setY1(128) }
    if (d === 'overworld' && w) { setY0(Math.max(-64, w.level.spawn.y - 24)); setY1(Math.min(320, w.level.spawn.y + 96)) }
  }
  const area = { cx: center === 'spawn' && w ? w.level.spawn.x : cx, cz: center === 'spawn' && w ? w.level.spawn.z : cz, radius, yMin: y0, yMax: y1 }
  const vol = (radius * 2) ** 2 * (Math.abs(y1 - y0) + 1)
  const regions = regionsForArea(area).length
  const go = async (): Promise<void> => {
    if (!w) return
    setBusy({ f: 0, label: 'Empezando' })
    const ids = await importWorldArea(w.path, w.level, w.dims[dim].dir, area, (f, label) => setBusy({ f, label }))
    setBusy(null)
    if (ids.length) onClose()
  }

  return (
    <Modal title="Importar un mundo de Minecraft" onClose={() => !busy && onClose()} wide footer={
      <>
        <span className="grow hint">Se importa la zona elegida como una construcción más. El mundo original no se modifica.</span>
        <button className="btn" disabled={!!busy} onClick={onClose}>Cerrar</button>
        <button className="btn primary" disabled={!w || !!busy || !w.dims[dim]} onClick={go}>{busy ? 'Importando…' : 'Importar zona'}</button>
      </>
    }>
      <div className="grid2">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <b>Mundo</b>
          <div className="world-list">
            {worlds === null && <span className="hint">Buscando mundos…</span>}
            {worlds?.length === 0 && <span className="hint">No hay mundos en la carpeta saves de Minecraft. Usa «Otra carpeta…».</span>}
            {worlds?.map((x) => (
              <button key={x.path} className={`tpl-card ${w?.path === x.path ? 'sel' : ''}`} onClick={() => load(x.path)}>
                <b>{x.folder}</b>
                <span className="hint">Jugado {new Date(x.modified).toLocaleDateString('es-ES')}</span>
              </button>
            ))}
          </div>
          <button className="btn small" onClick={pick}>Otra carpeta…</button>
          {error && <div className="callout err">{error}</div>}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {!w && <div className="callout">Elige un mundo de la lista (carpeta <code>.minecraft/saves</code>) u otra carpeta que contenga <code>level.dat</code>. Se admiten mundos de Java 1.13 o posterior.</div>}
          {w && (
            <>
              <div className="kv">
                <span>Nombre</span><span>{w.level.name}</span>
                <span>Versión</span><span>{w.level.version ?? 'no indicada'}</span>
                <span>Aparición</span><span>{w.level.spawn.x}, {w.level.spawn.y}, {w.level.spawn.z}</span>
              </div>
              <Field label="Dimensión">
                <Seg value={dim} onChange={(v) => setDimension(v as Dimension)} options={(Object.keys(DIMENSION_LABEL) as Dimension[]).filter((d) => w.dims[d]).map((d) => ({ value: d, label: DIMENSION_LABEL[d] }))} />
              </Field>
              <Field label="Centro">
                <Seg value={center} onChange={(v) => setCenter(v as 'spawn' | 'custom')} options={[{ value: 'spawn', label: 'Punto de aparición' }, { value: 'custom', label: 'Coordenadas' }]} />
              </Field>
              {center === 'custom' && (
                <Field label="X · Z" title="Coordenadas de bloque (las que muestra F3 en el juego)">
                  <div className="row">
                    <NumInput value={cx} decimals={0} onChange={(v) => setCx(Math.round(v))} />
                    <NumInput value={cz} decimals={0} onChange={(v) => setCz(Math.round(v))} />
                  </div>
                </Field>
              )}
              <Field label="Tamaño de la zona">
                <Seg value={String(radius)} onChange={(v) => setRadius(+v)} options={SIZES.map((s) => ({ value: String(s), label: `${s * 2}×${s * 2}` }))} />
              </Field>
              <Field label="Altura (Y)" title="Bloques entre estas alturas. Subir el mínimo deja fuera cuevas y piedra subterránea, y la escena va más rápida.">
                <div className="row">
                  <NumInput value={y0} min={-64} max={320} decimals={0} onChange={(v) => setY0(Math.round(v))} />
                  <span className="muted">a</span>
                  <NumInput value={y1} min={-64} max={320} decimals={0} onChange={(v) => setY1(Math.round(v))} />
                </div>
              </Field>
              <div className={`capacity ${vol > 60_000_000 ? 'err' : vol > 20_000_000 ? 'warn' : 'ok'}`}>
                {(vol / 1e6).toFixed(1)} millones de bloques como máximo · {regions} archivo(s) de región
                {vol > 20_000_000 ? ' · zona grande: puede tardar y usar mucha memoria' : ''}
              </div>
              {busy && <div className="row hint"><span className="spinner" /> {busy.label} <span className="progress"><div style={{ width: `${busy.f * 100}%` }} /></span></div>}
            </>
          )}
        </div>
      </div>
    </Modal>
  )
}
