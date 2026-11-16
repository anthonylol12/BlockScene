import { useEffect, useRef, useState, type JSX } from 'react'
import type { BuildInfo, SceneObject } from '@shared/types'
import { useStore } from '../../state/store'
import { KIND_LABEL } from '../../state/defaults'
import { remeshAll } from '../../state/importer'
import { duplicateSelected, renderSelectedIsolated } from '../../state/actions'
import { ColorInput, Field, NumInput, Section, Seg, Select, Slider, Toggle, Vec3Input, fmtInt } from '../controls'
import { Icon } from '../icons'
import { TREE_SPECIES } from '../../engine/procedural'
import { BackgroundSection, LooksSection, PacksPanel, PostSection } from './LookPanels'
import { ShadersSection } from './ShadersSection'
import { atlas } from '../../state/atlas'
import { clearTextures, pickTextureSource, useInstalledMinecraft } from '../../state/textureActions'

const BASE_BLOCKS = ['polished_andesite', 'stone_bricks', 'smooth_stone', 'quartz_block', 'polished_deepslate', 'deepslate_tiles', 'dark_oak_planks', 'spruce_planks', 'oak_planks', 'bricks', 'sandstone', 'cobblestone', 'black_concrete', 'white_concrete', 'gray_concrete', 'polished_blackstone']
const RIM_BLOCKS = ['gold_block', 'chiseled_stone_bricks', 'polished_blackstone_bricks', 'copper_block', 'iron_block', 'emerald_block', 'quartz_pillar', 'dark_oak_log', 'sea_lantern', 'glowstone']
const SURFACE_BLOCKS = ['grass_block', 'podzol', 'moss_block', 'sand', 'red_sand', 'snow_block', 'mycelium', 'gravel', 'stone', 'netherrack', 'end_stone']

type Tab = 'object' | 'scene' | 'render'

export function RightPanel(): JSX.Element {
  const [tab, setTab] = useState<Tab>('object')
  return (
    <div className="panel right">
      <div className="panel-head" style={{ padding: 6 }}>
        <Seg<Tab>
          value={tab}
          onChange={setTab}
          options={[
            { value: 'object', label: 'Objeto' },
            { value: 'scene', label: 'Escena' },
            { value: 'render', label: 'Render' }
          ]}
        />
      </div>
      <div className="panel-body">
        {tab === 'object' && <ObjectProps />}
        {tab === 'scene' && <SceneProps />}
        {tab === 'render' && <RenderProps />}
      </div>
    </div>
  )
}

export function BuildInfoView({ info, fileName, demo }: { info: BuildInfo; fileName?: string; demo?: boolean }): JSX.Element {
  return (
    <>
      {demo && <div className="callout warn">Construcción <b>de ejemplo generada</b> por BlockScene. No procede de un archivo tuyo.</div>}
      <div className="kv">
        {fileName && (<><span>Archivo</span><span>{fileName}</span></>)}
        <span>Formato</span>
        <span>{info.formatLabel}</span>
        <span>Versión MC</span>
        <span>{info.minecraftVersion ?? <i className="muted">no indicada en el archivo</i>}{info.dataVersion != null && <span className="muted"> (DataVersion {info.dataVersion})</span>}</span>
        <span>Dimensiones</span>
        <span>{info.width} × {info.height} × {info.length} <span className="muted">(an × al × la)</span></span>
        <span>Bloques</span>
        <span>{fmtInt(info.blockCount)}</span>
        <span>Tipos de bloque</span>
        <span>{info.paletteSize}</span>
        {info.regions != null && (<><span>{info.format === 'region' ? 'Chunks' : 'Regiones'}</span><span>{info.regions}</span></>)}
        {info.name && (<><span>Nombre</span><span>{info.name}</span></>)}
        {info.author && (<><span>Autor</span><span>{info.author}</span></>)}
        {info.unknownBlocks > 0 && (<><span>Sin color</span><span className="hint warn">{fmtInt(info.unknownBlocks)} bloques con color genérico</span></>)}
      </div>
      {info.topBlocks.length > 0 && (
        <details>
          <summary className="muted small" style={{ cursor: 'pointer' }}>Bloques más usados</summary>
          <table className="info" style={{ marginTop: 4 }}>
            <tbody>
              {info.topBlocks.map(([n, c]) => (
                <tr key={n}><td style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{n.replace('minecraft:', '')}</td><td>{fmtInt(c)}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
      {info.warnings.map((w, i) => (
        <div key={i} className="hint warn">⚠ {w}</div>
      ))}
    </>
  )
}

function ObjectProps(): JSX.Element {
  const id = useStore((s) => s.selectedId)
  const o = useStore((s) => s.project.objects.find((x) => x.id === id))
  const layers = useStore((s) => s.project.layers)
  const asset = useStore((s) => (o?.assetId ? s.project.assets[o.assetId] : undefined))
  const status = useStore((s) => (o?.assetId ? s.assetStatus[o.assetId] : undefined))
  const st = useStore.getState()
  if (!o) return <div className="empty">Selecciona un objeto en el visor o en la lista para ver y editar sus propiedades.</div>
  const setP = (k: string, v: number | string | boolean): void => st.setParams(o.id, { [k]: v })
  return (
    <>
      <Section title={KIND_LABEL[o.kind]}>
        <Field label="Nombre"><input className="input" value={o.name} onChange={(e) => st.updateObject(o.id, { name: e.target.value }, false)} onBlur={() => st.commit()} /></Field>
        <Field label="Colección">
          <Select value={o.layerId} options={layers.map((l) => ({ value: l.id, label: l.name }))} onChange={(v) => st.updateObject(o.id, { layerId: v })} />
        </Field>
        <Field label="Visible"><Toggle checked={o.visible} onChange={(v) => st.updateObject(o.id, { visible: v })} /></Field>
        <div className="row">
          <button className="btn small" onClick={duplicateSelected}><Icon name="copy" size={13} /> Duplicar</button>
          <button className="btn small danger" onClick={() => st.removeObjects([o.id])}><Icon name="trash" size={13} /> Quitar</button>
        </div>
      </Section>
      <Section title="Transformación">
        <Field label="Posición"><Vec3Input value={o.transform.position} step={1} onChange={(v) => st.setTransform(o.id, { ...o.transform, position: v })} /></Field>
        <Field label="Rotación °"><Vec3Input value={o.transform.rotation} step={15} onChange={(v) => st.setTransform(o.id, { ...o.transform, rotation: v })} /></Field>
        <Field label="Escala"><Vec3Input value={o.transform.scale} step={0.1} min={0.01} onChange={(v) => st.setTransform(o.id, { ...o.transform, scale: v })} /></Field>
        <div className="row">
          <button className="btn small" title="Escala uniforme a partir de X" onClick={() => st.setTransform(o.id, { ...o.transform, scale: [o.transform.scale[0], o.transform.scale[0], o.transform.scale[0]] })}>Escala uniforme</button>
          <button className="btn small" onClick={() => st.setTransform(o.id, { position: o.transform.position, rotation: [0, 0, 0], scale: [1, 1, 1] })}>Restablecer</button>
        </div>
      </Section>
      {o.kind === 'build' && (
        <Section title="Datos del archivo">
          {status?.state === 'loading' && <div className="row hint"><span className="spinner" /> Generando malla…</div>}
          {status?.state === 'error' && <div className="callout err">{status.message}</div>}
          {asset ? <BuildInfoView info={asset.info} fileName={asset.fileName} demo={asset.isDemo} /> : <div className="hint err">El archivo de esta construcción no está en el proyecto.</div>}
          {status?.faces != null && <div className="hint">Malla: {fmtInt(status.faces)} caras visibles{status.untextured ? ` · ${fmtInt(status.untextured)} bloques sin textura propia` : ''}</div>}
          <button className="btn small block" onClick={renderSelectedIsolated}><Icon name="camera" size={13} /> Render aislado (PNG transparente)</button>
        </Section>
      )}
      {o.kind !== 'build' && (
        <Section title="Parámetros">
          <ParamEditor o={o} setP={setP} />
        </Section>
      )}
    </>
  )
}

function ParamEditor({ o, setP }: { o: SceneObject; setP: (k: string, v: number | string | boolean) => void }): JSX.Element {
  const p = o.params
  const num = (k: string, label: string, min: number, max: number, step = 1): JSX.Element => (
    <Field label={label} key={k}><Slider value={p[k] as number} min={min} max={max} step={step} decimals={step < 1 ? 2 : 0} onChange={(v) => setP(k, v)} /></Field>
  )
  const col = (k: string, label: string): JSX.Element => <Field label={label} key={k}><ColorInput value={p[k] as string} onChange={(v) => setP(k, v)} /></Field>
  const sel = (k: string, label: string, opts: [string, string][]): JSX.Element => (
    <Field label={label} key={k}><Select value={p[k] as string} options={opts.map(([value, label]) => ({ value, label }))} onChange={(v) => setP(k, v)} /></Field>
  )
  const tog = (k: string, label: string): JSX.Element => <Field label={label} key={k}><Toggle checked={!!p[k]} onChange={(v) => setP(k, v)} /></Field>
  const seed = <Field label="Semilla" key="seed"><div className="row"><NumInput value={p.seed as number} step={1} onChange={(v) => setP('seed', Math.round(v))} /><button className="btn small" onClick={() => setP('seed', Math.floor(Math.random() * 9999))}>Aleatoria</button></div></Field>
  const blk = (k: string, label: string, list: string[]): JSX.Element => sel(k, label, list.map((x) => [x, x.replace(/_/g, ' ')]))
  const woods = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped']
  switch (o.kind) {
    case 'base': return p.shape === 'island' ? <>{sel('shape', 'Forma', [['island', 'Isla de terreno'], ['blocks', 'Escalonada'], ['round', 'Redonda'], ['square', 'Cuadrada']])}{num('radius', 'Radio (bloques)', 3, 60)}{num('height', 'Grosor (bloques)', 1, 8)}{sel('islandStyle', 'Terreno', [['verde', 'Verde (hierba y flores)'], ['seca', 'Seco (tierra y arbustos)'], ['nieve', 'Nevado'], ['arena', 'Arena']])}{num('plants', 'Vegetación', 0, 1, 0.01)}{seed}<div className="hint">Isla orgánica bajo la construcción, como en las presentaciones de colecciones.</div></> : <>{sel('shape', 'Forma', [['island', 'Isla de terreno'], ['blocks', 'Escalonada'], ['round', 'Redonda'], ['square', 'Cuadrada']])}{num('radius', 'Radio (bloques)', 2, 60)}{num('height', 'Altura (bloques)', 1, 8)}{blk('block', 'Bloque superior', BASE_BLOCKS)}{blk('sideBlock', 'Bloque lateral', BASE_BLOCKS)}{tog('rim', 'Borde')}{blk('rimBlock', 'Bloque del borde', RIM_BLOCKS)}</>
    case 'terrain': return <>{num('size', 'Tamaño (bloques)', 16, 256)}{num('amplitude', 'Relieve', 0, 30, 1)}{num('roughness', 'Rugosidad', 0.2, 0.8, 0.01)}{num('flatCenter', 'Centro llano', 0, 100)}{blk('block', 'Superficie', SURFACE_BLOCKS)}{blk('fillBlock', 'Subsuelo', ['dirt', 'coarse_dirt', 'sand', 'sandstone', 'gravel', 'stone', 'snow_block'])}{blk('deepBlock', 'Profundidad', ['stone', 'deepslate', 'andesite', 'sandstone', 'netherrack', 'end_stone'])}{num('plants', 'Hierba y flores', 0, 0.6, 0.01)}{num('trees', 'Árboles', 0, 80)}{sel('treeSpecies', 'Especie', TREE_SPECIES)}{seed}</>
    case 'water': return <>{num('size', 'Tamaño (bloques)', 2, 256)}{num('depth', 'Profundidad', 1, 6)}<div className="hint">Bloques de agua de Minecraft. Colócala un bloque por debajo de la superficie del terreno para formar lagos en los valles.</div></>
    case 'path': return <>{num('length', 'Longitud', 2, 200)}{num('width', 'Anchura', 1, 12)}{num('curve', 'Curvatura', 0, 20)}{blk('block', 'Bloque', ['dirt_path', 'gravel', 'cobblestone', 'stone_bricks', 'mossy_cobblestone', 'sandstone', 'mixed'])}{seed}</>
    case 'rock': return <>{num('size', 'Tamaño', 1, 12, 0.5)}{num('jagged', 'Irregularidad', 0, 0.8, 0.01)}{blk('block', 'Bloque', ['stone', 'andesite', 'granite', 'diorite', 'cobblestone', 'mossy_cobblestone', 'deepslate', 'tuff', 'basalt'])}{seed}</>
    case 'tree': return <>{sel('species', 'Especie', TREE_SPECIES)}{num('height', 'Altura', 4, 20)}{seed}</>
    case 'vegetation': return <>{sel('mix', 'Tipo', [['mixed', 'Hierba y flores'], ['grass', 'Solo hierba'], ['flowers', 'Solo flores']])}{num('area', 'Diámetro', 5, 300)}{num('count', 'Cantidad', 10, 5000, 10)}{num('avoidCenter', 'Hueco central', 0, 100)}{seed}<div className="hint">Se reparte sobre un plano. Para que siga el relieve, usa «Hierba y flores» del propio terreno.</div></>
    case 'light': return <>{sel('type', 'Tipo', [['point', 'Puntual'], ['spot', 'Foco']])}{col('color', 'Color')}{num('intensity', 'Intensidad', 0, 400)}{num('distance', 'Alcance', 1, 200)}{tog('castShadow', 'Proyecta sombras')}</>
    case 'decor': return <>{sel('type', 'Elemento', [['lamp', 'Farola (valla + farol)'], ['fence', 'Valla'], ['bench', 'Banco de losas'], ['campfire', 'Hoguera'], ['well', 'Pozo'], ['crate', 'Barril y fardos']])}{blk('wood', 'Madera', woods)}</>
    default: return <></>
  }
}

function SceneProps(): JSX.Element {
  const env = useStore((s) => s.project.environment)
  const sunCycle = useStore((s) => s.sunCycle)
  const st = useStore.getState()
  const hh = Math.floor(env.timeOfDay), mm = Math.round((env.timeOfDay - hh) * 60)
  return (
    <>
      <BackgroundSection />
      <Section title="Sol y luz">
        <Field label="Hora del día"><Slider value={env.timeOfDay} min={0} max={24} step={0.1} decimals={1} onChange={(v) => st.setEnv({ timeOfDay: v })} /></Field>
        <div className="hint" style={{ marginTop: -4, textAlign: 'right' }}>{String(hh).padStart(2, '0')}:{String(mm % 60).padStart(2, '0')} {sunCycle && '· ciclo animado activo'}</div>
        <Field label="Orientación °"><Slider value={env.sunAzimuth} min={0} max={360} step={1} decimals={0} onChange={(v) => st.setEnv({ sunAzimuth: v })} /></Field>
        <Field label="Color del sol"><ColorInput value={env.sunColor} onChange={(v) => st.setEnv({ sunColor: v })} /></Field>
        <Field label="Intensidad"><Slider value={env.sunIntensity} min={0} max={8} step={0.05} onChange={(v) => st.setEnv({ sunIntensity: v })} /></Field>
        <Field label="Sombras"><Toggle checked={env.shadows} onChange={(v) => st.setEnv({ shadows: v })} /></Field>
        <Field label="Suavidad sombra"><Slider value={env.shadowSoftness} min={0} max={1} onChange={(v) => st.setEnv({ shadowSoftness: v })} /></Field>
        <Field label="Luz ambiental"><ColorInput value={env.ambientColor} onChange={(v) => st.setEnv({ ambientColor: v })} /></Field>
        <Field label="Intensidad amb."><Slider value={env.ambientIntensity} min={0} max={3} onChange={(v) => st.setEnv({ ambientIntensity: v })} /></Field>
        <Field label="Exposición"><Slider value={env.exposure} min={0.2} max={2.5} onChange={(v) => st.setEnv({ exposure: v })} /></Field>
      </Section>
      <Section title="Cielo y nubes">
        <Field label="Tono del cielo"><ColorInput value={env.skyTint} onChange={(v) => st.setEnv({ skyTint: v })} /></Field>
        <Field label="Nubes"><Toggle checked={env.clouds.enabled} onChange={(v) => st.setEnvSub('clouds', { enabled: v })} /></Field>
        <Field label="Estilo"><Seg value={env.clouds.style} onChange={(v) => st.setEnvSub('clouds', { style: v })} options={[{ value: 'blocky', label: 'Bloques' }, { value: 'volumetric', label: 'Volumétricas' }]} /></Field>
        <Field label="Densidad"><Slider value={env.clouds.density} min={0} max={1} onChange={(v) => st.setEnvSub('clouds', { density: v })} /></Field>
        <Field label="Escala"><Slider value={env.clouds.scale} min={0.3} max={3} onChange={(v) => st.setEnvSub('clouds', { scale: v })} /></Field>
        <Field label="Detalle"><Slider value={env.clouds.detail} min={1} max={6} step={1} decimals={0} onChange={(v) => st.setEnvSub('clouds', { detail: v })} /></Field>
        <Field label="Altura"><Slider value={env.clouds.height} min={60} max={400} step={5} decimals={0} onChange={(v) => st.setEnvSub('clouds', { height: v })} /></Field>
        <Field label="Viento"><Slider value={env.clouds.speed} min={0} max={3} onChange={(v) => st.setEnvSub('clouds', { speed: v })} /></Field>
        <div className="hint">Bloques: capa plana de celdas, como en Minecraft. Volumétricas: raymarching con detalle; los pasos dependen de la calidad del visor.</div>
      </Section>
      <Section title="Niebla">
        <Field label="Niebla"><Toggle checked={env.fog.enabled} onChange={(v) => st.setEnvSub('fog', { enabled: v })} /></Field>
        <Field label="Densidad"><Slider value={env.fog.density} min={0} max={1} onChange={(v) => st.setEnvSub('fog', { density: v })} /></Field>
        <Field label="Altura"><Slider value={env.fog.height} min={2} max={150} step={1} decimals={0} onChange={(v) => st.setEnvSub('fog', { height: v })} /></Field>
        <Field label="Color"><ColorInput value={env.fog.color} onChange={(v) => st.setEnvSub('fog', { color: v })} /></Field>
      </Section>
      <Section title="Clima">
        <Seg value={env.weather} onChange={(v) => st.setEnv({ weather: v })} options={[{ value: 'clear', label: 'Despejado' }, { value: 'rain', label: 'Lluvia' }, { value: 'snow', label: 'Nieve' }]} />
        <Field label="Intensidad"><Slider value={env.weatherIntensity} min={0} max={1} onChange={(v) => st.setEnv({ weatherIntensity: v })} /></Field>
        <div className="hint">La lluvia y la nieve son partículas; además oscurecen el cielo y aumentan nubes y niebla. No hay superficies mojadas ni acumulación de nieve.</div>
      </Section>
    </>
  )
}

function TexturesSection(): JSX.Element {
  const [, force] = useState(0)
  const [installs, setInstalls] = useState<{ version: string; path: string }[]>([])
  useEffect(() => atlas.subscribe(() => force((x) => x + 1)), [])
  useEffect(() => { window.api.mcInstallations().then(setInstalls).catch(() => setInstalls([])) }, [])
  const src = atlas.get().source
  return (
    <Section title="Bloques de Minecraft">
      {src.kind === 'minecraft' ? (
        <div className="callout ok">Usando <b>{src.label}</b> · {src.count} texturas de bloque.</div>
      ) : (
        <div className="callout warn">Sin texturas de Minecraft: se usa una textura pixelada genérica con el color aproximado de cada bloque.</div>
      )}
      <button className="btn primary small block" disabled={!installs.length} onClick={useInstalledMinecraft}>
        {installs.length ? `Usar mi Minecraft instalado (${installs[0].version})` : 'No se detectó Minecraft Java instalado'}
      </button>
      <div className="row">
        <button className="btn small" style={{ flex: 1 }} onClick={pickTextureSource}>Elegir otra versión (.jar)…</button>
        {src.kind === 'minecraft' && <button className="btn small" onClick={clearTextures}>Quitar</button>}
      </div>
      <PacksPanel />
      <div className="hint">Las texturas se leen de tu copia local de Minecraft y de los paquetes que instales (se copian a la carpeta de datos de BlockScene). Admite paquetes HD de hasta 64 px. No se guardan dentro del proyecto.</div>
    </Section>
  )
}

function RenderProps(): JSX.Element {
  const env = useStore((s) => s.project.environment)
  const st = useStore.getState()
  const first = useRef(true)
  // regenerar mallas cuando cambian los ajustes de material que se calculan en el worker
  useEffect(() => {
    if (first.current) {
      first.current = false
      return
    }
    const t = setTimeout(() => remeshAll(), 350)
    return () => clearTimeout(t)
  }, [env.material.vertexAO, env.material.colorVariation])
  return (
    <>
      <LooksSection />
      <TexturesSection />
      <PostSection />
      <ShadersSection />
      <Section title="Materiales">
        <Field label="Acabado"><Seg value={env.material.style} onChange={(v) => st.setEnvSub('material', { style: v })} options={[{ value: 'matte', label: 'Mate' }, { value: 'soft', label: 'Suave' }, { value: 'glossy', label: 'Brillante' }]} /></Field>
        <Field label="Oclusión vértice" title="Sombreado de esquinas calculado en la malla (como el suavizado de luz de Minecraft)"><Toggle checked={env.material.vertexAO} onChange={(v) => st.setEnvSub('material', { vertexAO: v })} /></Field>
        <Field label="Variación color"><Slider value={env.material.colorVariation} min={0} max={0.2} step={0.01} onChange={(v) => st.setEnvSub('material', { colorVariation: v })} /></Field>
        <Field label="Texturas" title="Desactívalo para ver solo colores planos"><Toggle checked={env.material.pixelTexture} onChange={(v) => st.setEnvSub('material', { pixelTexture: v })} /></Field>
        <div className="hint">Formas: losas, escaleras (sin esquinas), vallas, muros y paneles conectados, puertas, trampillas y antorchas con su orientación; plantas como planos cruzados. Otros bloques especiales se dibujan como cubo.</div>
      </Section>
      <Section title="Calidad">
        <Field label="Visor"><Seg value={env.quality.preset} onChange={(v) => st.setEnvSub('quality', { preset: v })} options={[{ value: 'low', label: 'Baja' }, { value: 'medium', label: 'Media' }, { value: 'high', label: 'Alta' }]} /></Field>
        <Field label="Oclusión amb." title="GTAO en pantalla (postproceso). Consume GPU."><Toggle checked={env.quality.ao} onChange={(v) => st.setEnvSub('quality', { ao: v })} /></Field>
        <Field label="Reflejos" title="Mapa de entorno del cielo (IBL) aplicado a agua, cristal y materiales"><Toggle checked={env.quality.reflections} onChange={(v) => st.setEnvSub('quality', { reflections: v })} /></Field>
        <div className="hint">Reflejos: mapa de entorno del cielo. No hay reflejos en espacio de pantalla ni trazado de rayos; el agua no refleja las construcciones.</div>
      </Section>
      <Section title="Vista previa y render final">
        <div className="hint">El visor es la vista previa rápida en tiempo real. El render final genera una imagen nueva a la resolución elegida, acumulando muestras para el suavizado de bordes y de sombras.</div>
        <button className="btn primary block" onClick={() => st.setModal({ type: 'render' })}><Icon name="camera" size={14} /> Render final… <span className="muted small">F12</span></button>
      </Section>
    </>
  )
}
