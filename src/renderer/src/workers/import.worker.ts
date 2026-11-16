/// <reference lib="webworker" />
// Worker de importación: análisis del archivo + generación de malla fuera del hilo de la interfaz.
import { parseBuildFile, type VoxelModel } from '../core/formats'
import { buildMesh, GROUPS, type AtlasInfo, type MeshResult } from '../core/mesher'

export type WorkerIn =
  | { type: 'import'; jobId: string; key: string; fileName: string; bytes: ArrayBuffer; vertexAO: boolean; colorVariation: number; atlas: AtlasInfo }
  | { type: 'remesh'; jobId: string; key: string; vertexAO: boolean; colorVariation: number; atlas: AtlasInfo }
  | { type: 'forget'; key: string }

export type WorkerOut =
  | { type: 'progress'; jobId: string; stage: 'parse' | 'mesh'; f: number }
  | { type: 'done'; jobId: string; info?: import('@shared/types').BuildInfo; mesh: MeshResult }
  | { type: 'error'; jobId: string; message: string }

const models = new Map<string, VoxelModel>()
const ctx = self as unknown as DedicatedWorkerGlobalScope

function transferables(m: MeshResult): Transferable[] {
  const out: Transferable[] = []
  for (const k of GROUPS) out.push(m[k].positions.buffer, m[k].normals.buffer, m[k].colors.buffer, m[k].uvs.buffer, m[k].indices.buffer)
  return out
}

ctx.onmessage = async (ev: MessageEvent<WorkerIn>) => {
  const msg = ev.data
  if (msg.type === 'forget') {
    models.delete(msg.key)
    return
  }
  const { jobId } = msg
  try {
    let model: VoxelModel | undefined
    let info
    if (msg.type === 'import') {
      const parsed = await parseBuildFile(msg.fileName, new Uint8Array(msg.bytes), (f) =>
        ctx.postMessage({ type: 'progress', jobId, stage: 'parse', f } satisfies WorkerOut)
      )
      model = parsed.model
      info = parsed.info
      models.set(msg.key, model)
    } else {
      model = models.get(msg.key)
      if (!model) throw new Error('Modelo no disponible en memoria; vuelve a importar el archivo')
    }
    const mesh = buildMesh(model, {
      vertexAO: msg.vertexAO,
      colorVariation: msg.colorVariation,
      atlas: msg.atlas,
      onProgress: (f) => ctx.postMessage({ type: 'progress', jobId, stage: 'mesh', f } satisfies WorkerOut)
    })
    if (info) info.unknownBlocks = mesh.unknownBlocks
    ctx.postMessage({ type: 'done', jobId, info, mesh } satisfies WorkerOut, transferables(mesh))
  } catch (e) {
    ctx.postMessage({ type: 'error', jobId, message: (e as Error).message || String(e) } satisfies WorkerOut)
  }
}
