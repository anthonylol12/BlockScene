import { useEffect, useState, type JSX } from 'react'
import { useStore } from '../../state/store'
import { BUILTIN_LOOKS, applyLook, currentAsLook, installedLooks, parseLook, saveUserLooks, type Look } from '../../state/looks'
import { lookSummary } from '../../state/wizard'
import { installPack, reloadWithPacks } from '../../state/textureActions'
import { ColorInput, Field, Section, Seg, Slider, Toggle } from '../controls'
import { Icon } from '../icons'

// ---------------------------------------------------------------- estilos visuales
export function LooksSection(): JSX.Element {
  const [, force] = useState(0)
  const [msg, setMsg] = useState<{ kind: 'warn' | 'err'; text: string } | null>(null)
  useEffect(() => installedLooks.subscribe(() => force((x) => x + 1)), [])
  const user = installedLooks.get()
  const save = (list: Look[]): Promise<void> => saveUserLooks(list)
  const install = async (): Promise<void> => {
    setMsg(null)
    const r = await window.api.looksPick()
    if (!r) return
    if (r.kind === 'shaderpack') {
      setMsg({
        kind: 'warn',
        text: `«${r.name}» es un shaderpack de OptiFine/Iris. No se puede usar en BlockScene: son programas GLSL escritos para el motor de Minecraft (sus búferes y pasadas), que esta app no tiene. Usa un estilo de BlockScene (.bslook) o ajusta el postprocesado.`
      })
      return
    }
    if (r.kind === 'zip' || !r.text) {
      setMsg({ kind: 'err', text: `«${r.name}» no es un estilo de BlockScene. Si es un paquete de texturas, instálalo en «Paquetes de texturas».` })
      return
    }
    try {
      const look = parseLook(r.text, r.name)
      await save([...user.filter((u) => u.name !== look.name), look])
      applyLook(look)
    } catch (e) {
      setMsg({ kind: 'err', text: `No se pudo instalar: ${(e as Error).message}` })
    }
  }
  const exportCurrent = async (): Promise<void> => {
    const name = window.prompt('Nombre del estilo', 'Mi estilo')
    if (!name) return
    const look = currentAsLook(name)
    const data = new TextEncoder().encode(JSON.stringify({ ...look, builtIn: undefined }, null, 2))
    const res = await window.api.saveBinary({ suggestedName: `${name.replace(/[\\/:*?"<>|]/g, '_')}.bslook`, filterName: 'Estilo de BlockScene', extensions: ['bslook'], data })
    if (res) {
      await save([...user.filter((u) => u.name !== name), look])
      useStore.getState().toast({ kind: 'success', title: `Estilo «${name}» exportado e instalado`, detail: res.path, action: { label: 'Mostrar en carpeta', run: () => window.api.showItem(res.path) } })
    }
  }
  const all = [...BUILTIN_LOOKS, ...user]
  return (
    <Section title="Estilo visual (shaders)">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
        {all.map((l) => (
          <div key={l.id} className="tpl-card" role="button" tabIndex={0} title={`${l.description}
Cambia: ${lookSummary(l).join(', ') || 'ajustes propios'}`} onClick={() => applyLook(l)} onKeyDown={(e) => e.key === 'Enter' && applyLook(l)} style={{ padding: 7, position: 'relative' }}>
            <b style={{ fontSize: 12 }}>{l.name}</b>
            <span className="hint" style={{ fontSize: 10.5 }}>{l.builtIn ? 'Incluido' : 'Instalado'}</span>
            {!l.builtIn && (
              <button className="icon-btn" style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18 }} aria-label={`Desinstalar ${l.name}`} title="Desinstalar"
                onClick={(e) => { e.stopPropagation(); save(user.filter((u) => u.id !== l.id)) }}><Icon name="close" size={10} /></button>
            )}
          </div>
        ))}
      </div>
      <div className="row">
        <button className="btn small" style={{ flex: 1 }} onClick={install}>Instalar estilo…</button>
        <button className="btn small" style={{ flex: 1 }} onClick={exportCurrent}>Exportar actual…</button>
      </div>
      {msg && <div className={`callout ${msg.kind}`}>{msg.text}</div>}
      <div className="hint">Un estilo aplica luz, fondo y postprocesado en un clic. Se comparten como archivos .bslook. Los shaderpacks de OptiFine/Iris no son compatibles.</div>
    </Section>
  )
}

// ---------------------------------------------------------------- postprocesado
export function PostSection(): JSX.Element {
  const post = useStore((s) => s.project.environment.post)
  const set = (p: Partial<typeof post>): void => useStore.getState().setEnvSub('post', p)
  return (
    <Section title="Postprocesado">
      <Field label="Brillo (bloom)" title="Halo alrededor de luces y zonas muy brillantes"><Slider value={post.bloom} min={0} max={2} onChange={(v) => set({ bloom: v })} /></Field>
      <Field label="Umbral bloom"><Slider value={post.bloomThreshold} min={0} max={1} onChange={(v) => set({ bloomThreshold: v })} /></Field>
      <Field label="Viñeta"><Slider value={post.vignette} min={0} max={1} onChange={(v) => set({ vignette: v })} /></Field>
      <Field label="Saturación"><Slider value={post.saturation} min={0} max={2} onChange={(v) => set({ saturation: v })} /></Field>
      <Field label="Contraste"><Slider value={post.contrast} min={0.5} max={1.6} onChange={(v) => set({ contrast: v })} /></Field>
      <Field label="Calidez"><Slider value={post.warmth} min={-1} max={1} onChange={(v) => set({ warmth: v })} /></Field>
      <Field label="Grano"><Slider value={post.grain} min={0} max={1} onChange={(v) => set({ grain: v })} /></Field>
      <div className="hint">Se aplica igual en el visor y en el render final.</div>
    </Section>
  )
}

// ---------------------------------------------------------------- fondo
export function BackgroundSection(): JSX.Element {
  const bg = useStore((s) => s.project.environment.background)
  const set = (p: Partial<typeof bg>): void => useStore.getState().setEnvSub('background', p)
  return (
    <Section title="Fondo">
      <Seg value={bg.mode} onChange={(v) => set({ mode: v })} options={[{ value: 'sky', label: 'Cielo y mundo' }, { value: 'studio', label: 'Estudio de exhibición' }]} />
      {bg.mode === 'studio' && (
        <>
          <Field label="Color centro"><ColorInput value={bg.color1} onChange={(v) => set({ color1: v })} /></Field>
          <Field label="Color bordes"><ColorInput value={bg.color2} onChange={(v) => set({ color2: v })} /></Field>
          <Field label="Motas de polvo"><Slider value={bg.specks} min={0} max={1} onChange={(v) => set({ specks: v })} /></Field>
          <Field label="Sombra en suelo" title="Suelo invisible que solo muestra la sombra"><Toggle checked={bg.floorShadow} onChange={(v) => set({ floorShadow: v })} /></Field>
          <Field label="Opacidad sombra"><Slider value={bg.shadowOpacity} min={0} max={1} onChange={(v) => set({ shadowOpacity: v })} /></Field>
          <Field label="Ocultar entorno" title="Oculta terreno, agua, caminos y vegetación mientras el estudio está activo"><Toggle checked={bg.hideEnvironment} onChange={(v) => set({ hideEnvironment: v })} /></Field>
          <div className="hint">En modo estudio no se dibujan el cielo, las nubes, la niebla ni el clima.</div>
        </>
      )}
    </Section>
  )
}

// ---------------------------------------------------------------- paquetes de texturas
export function PacksPanel(): JSX.Element {
  const [installed, setInstalled] = useState<{ file: string; enabled: boolean }[]>([])
  const [available, setAvailable] = useState<{ name: string; path: string }[]>([])
  const [pick, setPick] = useState('')
  const refresh = async (): Promise<void> => {
    const r = await window.api.packsList()
    setInstalled(r.installed)
    setAvailable(r.available)
  }
  useEffect(() => {
    refresh()
    const on = (): void => void refresh()
    window.addEventListener('bs-packs-changed', on)
    return () => window.removeEventListener('bs-packs-changed', on)
  }, [])
  const update = async (list: typeof installed): Promise<void> => {
    setInstalled(list)
    await window.api.packsUpdate(list)
    await reloadWithPacks()
  }
  const move = (i: number, d: number): void => {
    const l = [...installed]
    const j = i + d
    if (j < 0 || j >= l.length) return
    ;[l[i], l[j]] = [l[j], l[i]]
    update(l)
  }
  const notInstalled = available.filter((a) => !installed.some((i) => i.file === a.name))
  return (
    <>
      <div className="lbl small muted" style={{ marginTop: 4 }}>Paquetes de texturas (el de arriba tiene prioridad)</div>
      {installed.length === 0 && <div className="hint">Ningún paquete instalado.</div>}
      <div className="layers-list" style={{ margin: '0 -10px' }}>
        {installed.map((p, i) => (
          <div key={p.file} className="tree-row">
            <Toggle checked={p.enabled} onChange={(v) => update(installed.map((x) => (x.file === p.file ? { ...x, enabled: v } : x)))} />
            <span className={`name ${p.enabled ? '' : 'dim'}`} title={p.file}>{p.file.replace(/\.zip$/i, '')}</span>
            <button className="icon-btn" aria-label="Subir prioridad" onClick={() => move(i, -1)}><Icon name="up" size={12} /></button>
            <button className="icon-btn" aria-label="Bajar prioridad" onClick={() => move(i, 1)}><Icon name="down" size={12} /></button>
            <button className="icon-btn" aria-label="Desinstalar paquete" onClick={() => window.confirm(`¿Desinstalar «${p.file}»?`) && update(installed.filter((x) => x.file !== p.file))}><Icon name="trash" size={12} /></button>
          </div>
        ))}
      </div>
      {notInstalled.length > 0 && (
        <div className="row">
          <select className="select" style={{ flex: 1, height: 24 }} aria-label="Paquetes encontrados en Minecraft" value={pick} onChange={(e) => setPick(e.target.value)}>
            <option value="">De tu carpeta resourcepacks…</option>
            {notInstalled.map((a) => <option key={a.path} value={a.path}>{a.name}</option>)}
          </select>
          <button className="btn small" disabled={!pick} onClick={async () => { await installPack(pick); setPick(''); refresh() }}>Instalar</button>
        </div>
      )}
      <button className="btn small block" onClick={async () => { await installPack(null); refresh() }}>Instalar paquete de texturas (.zip)…</button>
    </>
  )
}
