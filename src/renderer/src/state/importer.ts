// Importación de construcciones: envía los archivos al worker y registra el resultado REAL en el proyecto.
import type { BuildAsset, BuildInfo, SceneObject } from '@shared/types'
import type { MeshResult } from '../core/mesher'
import type { WorkerIn, WorkerOut } from '../workers/import.worker'
import { useStore } from './store'
import { atlas } from './atlas'
import { makeObject, uid } from './defaults'

// ---- caché de mallas (no se guarda en el proyecto; se regenera a partir del archivo original)
const meshes = new Map<string, MeshResult>()
const listeners = new Set<(assetId: string) => void>()
export const meshCache = {
  get: (id: string): MeshResult | undefined => meshes.get(id),
  set(id: string, m: MeshResult): void {
    meshes.set(id, m)
    listeners.forEach((l) => l(id))
  },
  delete(id: string): void {
    meshes.delete(id)
    worker.postMessage({ type: 'forget', key: id } satisfies WorkerIn)
  },
  clear(): void {
    for (const k of [...meshes.keys()]) this.delete(k)
  },
  subscribe(fn: (assetId: string) => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }
}

// ---- worker
const worker = new Worker(new URL('../workers/import.worker.ts', import.meta.url), { type: 'module' })
type Pending = { resolve: (v: { info?: BuildInfo; mesh: MeshResult }) => void; reject: (e: Error) => void; progress: (stage: string, f: number) => void }
const pending = new Map<string, Pending>()
worker.onmessage = (ev: MessageEvent<WorkerOut>) => {
  const m = ev.data
  const p = pending.get(m.jobId)
  if (!p) return
  if (m.type === 'progress') p.progress(m.stage, m.f)
  else {
    pending.delete(m.jobId)
    if (m.type === 'done') p.resolve({ info: m.info, mesh: m.mesh })
    else p.reject(new Error(m.message))
  }
}
worker.onerror = (e) => {
  for (const [k, p] of pending) {
    p.reject(new Error(`El proceso de importación falló: ${e.message}`))
    pending.delete(k)
  }
}

function run(msg: WorkerIn & { jobId: string }, transfer: Transferable[], progress: Pending['progress']): Promise<{ info?: BuildInfo; mesh: MeshResult }> {
  return new Promise((resolve, reject) => {
    pending.set(msg.jobId, { resolve, reject, progress })
    worker.postMessage(msg, transfer)
  })
}

export function toBase64(bytes: Uint8Array): string {
  let s = ''
  const CH = 0x8000
  for (let i = 0; i < bytes.length; i += CH) s += String.fromCharCode(...bytes.subarray(i, i + CH))
  return btoa(s)
}
export function fromBase64(b64: string): Uint8Array {
  const s = atob(b64)
  const out = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i)
  return out
}

const STAGE = { parse: 'Analizando archivo', mesh: 'Generando malla' } as Record<string, string>

async function meshAsset(assetId: string, fileName: string, bytes: Uint8Array, label: string): Promise<{ info?: BuildInfo; mesh: MeshResult }> {
  const st = useStore.getState()
  const env = st.project.environment
  const job = st.startJob(label)
  st.setAssetStatus(assetId, { state: 'loading' })
  const copy = bytes.slice() // el buffer se transfiere al worker
  try {
    const res = await run(
      { type: 'import', jobId: job, key: assetId, fileName, bytes: copy.buffer, vertexAO: env.material.vertexAO, colorVariation: env.material.colorVariation, atlas: atlas.get().info },
      [copy.buffer],
      (stage, f) => useStore.getState().updateJob(job, stage === 'parse' ? f * 0.5 : 0.5 + f * 0.5, STAGE[stage])
    )
    meshCache.set(assetId, res.mesh)
    useStore.getState().setAssetStatus(assetId, { state: 'ready', faces: res.mesh.faces, untextured: res.mesh.untextured })
    return res
  } catch (e) {
    useStore.getState().setAssetStatus(assetId, { state: 'error', message: (e as Error).message })
    throw e
  } finally {
    useStore.getState().endJob(job)
  }
}

/** Posición libre a la derecha de las construcciones existentes. */
function nextSlot(width: number): number {
  const s = useStore.getState().project
  let right = -Infinity
  for (const o of s.objects) {
    if (o.kind !== 'build' || !o.assetId) continue
    const a = s.assets[o.assetId]
    if (!a) continue
    right = Math.max(right, o.transform.position[0] + (a.info.width * o.transform.scale[0]) / 2)
  }
  return right === -Infinity ? 0 : right + 6 + width / 2
}

export async function importFiles(files: { name: string; data: Uint8Array | null; error?: string }[], opts: { isDemo?: boolean; quiet?: boolean; onError?: (file: string, message: string) => void } = {}): Promise<string[]> {
  // quiet: sin informe ni avisos (el asistente muestra los datos y errores en su propio panel)
  const fail = (file: string, message: string): void => {
    opts.onError?.(file, message)
    if (!opts.quiet) useStore.getState().toast({ kind: 'error', title: `No se pudo importar ${file}`, detail: message })
  }
  const ok: string[] = []
  await Promise.all(
    files.map(async (f) => {
      if (!f.data) {
        fail(f.name, f.error ?? 'No se pudo leer el archivo')
        return
      }
      const assetId = uid('asset')
      try {
        const { info } = await meshAsset(assetId, f.name, f.data, `Importando ${f.name}`)
        if (!info) throw new Error('El análisis no devolvió información')
        const asset: BuildAsset = { id: assetId, fileName: f.name, dataBase64: toBase64(f.data), info, isDemo: opts.isDemo }
        const s2 = useStore.getState()
        useStore.setState({ project: { ...s2.project, assets: { ...s2.project.assets, [assetId]: asset } } })
        const layer = s2.project.layers.find((l) => l.id === 'layer_builds')?.id ?? s2.project.layers[0].id
        const obj: SceneObject = makeObject('build', layer, {
          name: (opts.isDemo ? 'EJEMPLO · ' : '') + (info.name || f.name.replace(/\.[^.]+$/, '')),
          assetId
        })
        obj.transform.position = [nextSlot(info.width), 0, 0]
        s2.addObject(obj)
        ok.push(assetId)
        if (info.warnings.length && !opts.quiet)
          s2.toast({ kind: 'warning', title: `${f.name}: importado con avisos`, detail: info.warnings.join(' · ') }, 9000)
      } catch (e) {
        meshCache.delete(assetId)
        fail(f.name, (e as Error).message)
      }
    })
  )
  if (ok.length && !opts.isDemo && !opts.quiet) useStore.getState().setModal({ type: 'importReport', assetIds: ok })
  return ok
}

/** Al abrir un proyecto: re-analiza los archivos guardados para reconstruir las mallas. */
export async function rebuildProjectMeshes(): Promise<void> {
  meshCache.clear()
  const assets = Object.values(useStore.getState().project.assets)
  await Promise.all(
    assets.map(async (a) => {
      try {
        await meshAsset(a.id, a.fileName, fromBase64(a.dataBase64), `Cargando ${a.fileName}`)
      } catch (e) {
        useStore.getState().toast({ kind: 'error', title: `No se pudo reconstruir ${a.fileName}`, detail: (e as Error).message })
      }
    })
  )
}

/** Regenera las mallas al cambiar AO por vértice o variación de color. */
export async function remeshAll(): Promise<void> {
  const st = useStore.getState()
  const env = st.project.environment
  const ids = Object.keys(st.project.assets).filter((id) => meshes.has(id))
  if (!ids.length) return
  const job = st.startJob('Actualizando materiales')
  try {
    await Promise.all(
      ids.map(async (id) => {
        const res = await run(
          { type: 'remesh', jobId: uid('rm'), key: id, vertexAO: env.material.vertexAO, colorVariation: env.material.colorVariation, atlas: atlas.get().info },
          [],
          () => {}
        )
        meshCache.set(id, res.mesh)
        useStore.getState().setAssetStatus(id, { state: 'ready', faces: res.mesh.faces, untextured: res.mesh.untextured })
      })
    )
  } catch (e) {
    useStore.getState().toast({ kind: 'error', title: 'No se pudieron actualizar las mallas', detail: (e as Error).message })
  } finally {
    useStore.getState().endJob(job)
  }
}
