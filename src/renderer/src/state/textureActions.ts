// Texturas de Minecraft: versión base (tu instalación) + paquetes de texturas instalados encima.
import { useStore } from './store'
import { atlas, buildAtlas, resetAtlas } from './atlas'
import { remeshAll } from './importer'
import { loadMcFont } from '../compositor/mcFont'

const fileOf = (p: string): string => p.split(/[\\/]/).pop() ?? p

/** Carga la base (o null para usar solo paquetes) y aplica los paquetes activos. */
export async function loadTexturesFrom(path: string | null, quiet = false): Promise<boolean> {
  const st = useStore.getState()
  const job = st.startJob('Cargando texturas de Minecraft')
  try {
    const r = await window.api.mcLoadTextures(path)
    const file = path ? fileOf(path) : ''
    const base = path ? (file.endsWith('.jar') ? `Minecraft ${file.replace(/\.jar$/, '')}` : `Paquete ${file}`) : 'Solo paquetes'
    const label = r.applied.length ? `${base} + ${r.applied.length} paquete${r.applied.length > 1 ? 's' : ''}` : base
    const n = await buildAtlas(r.textures, { kind: 'minecraft', path, label, count: r.textures.length, packs: r.applied }, r.faces)
    await remeshAll()
    loadMcFont(path).catch(() => undefined)
    if (r.failed) st.toast({ kind: 'warning', title: `${r.failed} paquete(s) no se pudieron leer`, detail: 'Revisa la lista de paquetes de texturas.' })
    if (!quiet) st.toast({ kind: 'success', title: 'Texturas cargadas', detail: `${label}: ${n} texturas de bloque. Se leen de tu copia local; no se guardan en el proyecto.` })
    return true
  } catch (e) {
    if (quiet && path) {
      // la versión guardada ya no existe o no se puede leer: se olvida para no avisar en cada arranque
      await window.api.mcClearSource().catch(() => undefined)
      st.toast({ kind: 'warning', title: 'No se encontró la versión de Minecraft que usabas', detail: `${fileOf(path)} ya no está disponible. Se usan texturas genéricas; elige otra versión en Render → Bloques de Minecraft.` })
    } else st.toast({ kind: 'error', title: 'No se pudieron cargar las texturas', detail: (e as Error).message })
    return false
  } finally {
    useStore.getState().endJob(job)
  }
}

const currentBase = (): string | null => {
  const s = atlas.get().source
  return s.kind === 'minecraft' ? s.path : null
}

export async function useInstalledMinecraft(): Promise<void> {
  const list = await window.api.mcInstallations()
  if (!list.length) {
    useStore.getState().toast({ kind: 'warning', title: 'No se encontró Minecraft Java instalado', detail: 'Busca manualmente el .jar de una versión (carpeta .minecraft/versions).' })
    return
  }
  await loadTexturesFrom(list[0].path)
}

export async function pickTextureSource(): Promise<void> {
  const p = await window.api.mcPickTextureSource()
  if (p) await loadTexturesFrom(p)
}

export async function clearTextures(): Promise<void> {
  await window.api.mcClearSource()
  resetAtlas()
  await remeshAll()
}

/** Recarga tras instalar, activar, ordenar o quitar paquetes. */
export async function reloadWithPacks(): Promise<void> {
  const base = currentBase() ?? (await window.api.mcSavedSource())
  const { installed } = await window.api.packsList()
  if (!base && !installed.some((p) => p.enabled)) {
    resetAtlas()
    await remeshAll()
    return
  }
  await loadTexturesFrom(base, true)
}

export async function installPack(src: string | null): Promise<void> {
  const st = useStore.getState()
  try {
    const r = await window.api.packsInstall(src)
    if (!r) return
    await reloadWithPacks()
    window.dispatchEvent(new Event('bs-packs-changed'))
    st.toast({ kind: 'success', title: `Paquete instalado: ${r.file}`, detail: `${r.blockTextures} texturas de bloque. Se aplica por encima de la versión base.` })
  } catch (e) {
    st.toast({ kind: 'error', title: 'No se pudo instalar el paquete', detail: (e as Error).message.replace(/^Error invoking remote method '[^']+': (Error: )?/, '') })
  }
}

/** Al iniciar: recarga la fuente de texturas elegida anteriormente y los paquetes activos. */
export async function initTextures(): Promise<void> {
  try {
    const saved = await window.api.mcSavedSource()
    const { installed } = await window.api.packsList()
    if ((saved || installed.some((p) => p.enabled)) && atlas.get().source.kind === 'procedural') await loadTexturesFrom(saved, true)
  } catch {
    /* sin fuente guardada */
  }
}
