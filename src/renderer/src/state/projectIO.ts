// Guardar / abrir / nuevo proyecto (.bscene = JSON con los archivos originales y renders incrustados)
import type { Project } from '@shared/types'
import { useStore } from './store'
import { blankComposition, defaultEnvironment, makeObject, newProject } from './defaults'
import { importFiles, meshCache, rebuildProjectMeshes } from './importer'
import { generateDemoSchem } from '../core/demo'

export function serializeProject(p: Project): string {
  const used = new Set(p.objects.map((o) => o.assetId).filter(Boolean))
  const assets = Object.fromEntries(Object.entries(p.assets).filter(([k]) => used.has(k)))
  return JSON.stringify({ ...p, assets })
}

export function parseProject(text: string): Project {
  let raw: Partial<Project>
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es un JSON válido; puede estar dañado.')
  }
  if (raw.format !== 'blockscene-project') throw new Error('El archivo no es un proyecto de BlockScene.')
  if (raw.version !== 1) throw new Error(`Versión de proyecto no compatible (${String(raw.version)}).`)
  const base = newProject()
  const env = defaultEnvironment()
  return {
    ...base,
    ...raw,
    environment: {
      ...env,
      ...raw.environment,
      clouds: { ...env.clouds, ...raw.environment?.clouds },
      fog: { ...env.fog, ...raw.environment?.fog },
      material: { ...env.material, ...raw.environment?.material },
      quality: { ...env.quality, ...raw.environment?.quality },
      background: { ...env.background, ...raw.environment?.background },
      post: { ...env.post, ...raw.environment?.post }
    }
  } as Project
}

function confirmDiscard(): boolean {
  if (!useStore.getState().dirty) return true
  return window.confirm('Hay cambios sin guardar. ¿Descartarlos y continuar?')
}

export function newProjectAction(): void {
  if (!confirmDiscard()) return
  meshCache.clear()
  useStore.getState().loadProject(newProject(), null)
}

export async function openProjectAction(): Promise<void> {
  if (!confirmDiscard()) return
  const r = await window.api.openProject()
  if (r) await loadProjectText(r.path, r.text)
}

/** Proyecto recibido por doble clic en un .bscene (al arrancar o con la app ya abierta). */
export async function openProjectFromSystem(): Promise<void> {
  const r = await window.api.initialProject()
  if (!r) return
  if (r.error || r.text == null) {
    useStore.getState().toast({ kind: 'error', title: 'No se pudo abrir el proyecto', detail: `${r.path}: ${r.error ?? 'archivo ilegible'}` })
    return
  }
  if (!confirmDiscard()) return
  await loadProjectText(r.path, r.text)
}

async function loadProjectText(path: string, text: string): Promise<void> {
  const st = useStore.getState()
  const r = { path, text }
  let project: Project
  try {
    project = parseProject(r.text)
  } catch (e) {
    st.toast({ kind: 'error', title: 'No se pudo abrir el proyecto', detail: (e as Error).message })
    return
  }
  st.loadProject(project, r.path)
  await rebuildProjectMeshes()
  useStore.setState({ dirty: false })
  st.toast({ kind: 'success', title: `Proyecto abierto: ${project.name}`, detail: r.path })
}

export async function saveProjectAction(saveAs = false): Promise<boolean> {
  const st = useStore.getState()
  const job = st.startJob('Guardando proyecto')
  try {
    const text = serializeProject(st.project)
    const r = await window.api.saveProject({ path: saveAs ? null : st.projectPath, text, suggestedName: st.project.name })
    if (!r) return false
    st.markSaved(r.path)
    st.toast({
      kind: 'success',
      title: 'Proyecto guardado',
      detail: `${r.path} (${(r.size / 1048576).toFixed(2)} MB)`,
      action: { label: 'Mostrar en carpeta', run: () => window.api.showItem(r.path) }
    })
    return true
  } catch (e) {
    st.toast({ kind: 'error', title: 'No se pudo guardar el proyecto', detail: (e as Error).message })
    return false
  } finally {
    st.endJob(job)
  }
}

export async function importBuildsAction(): Promise<void> {
  const files = await window.api.openBuilds()
  if (files.length) await importFiles(files)
}

/** Escena de demostración: claramente marcada como EJEMPLO. La construcción es generada, no importada. */
export async function loadDemoAction(): Promise<void> {
  if (!confirmDiscard()) return
  meshCache.clear()
  const p = newProject('EJEMPLO · Escena de demostración')
  useStore.getState().loadProject(p, null)
  await importFiles([{ name: 'casa-de-ejemplo.schem', data: generateDemoSchem() }], { isDemo: true })
  const st = useStore.getState()
  const add = (kind: Parameters<typeof makeObject>[0], layer: string, pos: [number, number, number], params: Record<string, string | number | boolean> = {}, name?: string): void => {
    const o = makeObject(kind, layer)
    o.transform.position = pos
    o.params = { ...o.params, ...params }
    if (name) o.name = name
    st.addObject(o, false)
  }
  add('base', 'layer_env', [0, -2, 0], { radius: 11 })
  add('terrain', 'layer_env', [0, -2, 0], { flatCenter: 22, trees: 10, plants: 0.14 })
  add('water', 'layer_env', [0, -3, 0], { size: 128 })
  add('path', 'layer_env', [0, -2.97, 22], { length: 22, width: 3 })
  add('vegetation', 'layer_env', [0, -2, 0], { area: 44, count: 160, avoidCenter: 13 })
  add('tree', 'layer_env', [-15, -2, -9], { species: 'oak', seed: 3 })
  add('tree', 'layer_env', [16, -2, 10], { species: 'birch', seed: 4 })
  add('rock', 'layer_env', [13, -2, -10], { size: 2, seed: 4 })
  add('decor', 'layer_lights', [3, 0, 8], { type: 'lamp' }, 'Farola')
  add('decor', 'layer_lights', [-4, 0, 8], { type: 'lamp' }, 'Farola')
  const sel = useStore.getState().project.objects.find((o) => o.kind === 'build')
  st.select(sel?.id ?? null)
  st.addComposition(blankComposition('Lámina de ejemplo'), true)
  useStore.setState({ dirty: false, undoStack: [] })
  st.toast({ kind: 'info', title: 'Escena de demostración cargada', detail: 'La casa es una construcción GENERADA de ejemplo, no un archivo tuyo.' }, 7000)
}
