// Pila de shaders GLSL externos instalados (configuración global de la app, no del proyecto).
import { createValidationRenderer, parseShaderMeta, validateShader, type ActiveShader, type ShaderMeta } from '../engine/userShaders'
import type { WebGLRenderer } from 'three'
import { useStore } from './store'

export interface InstalledShader {
  file: string
  enabled: boolean
  params: Record<string, number>
  source: string | null
  meta: ShaderMeta | null
  error: string | null
}

const examplesRaw = import.meta.glob('../shaders/examples/*.glsl', { query: '?raw', import: 'default', eager: true }) as Record<string, string>
export const EXAMPLE_SHADERS = Object.entries(examplesRaw).map(([path, source]) => {
  const file = path.split('/').pop()!
  return { file, source, meta: parseShaderMeta(source, file) }
})

let list: InstalledShader[] = []
let version = 0
const listeners = new Set<() => void>()
const publish = (): void => {
  version++
  listeners.forEach((l) => l())
}
export const shaderStack = {
  get: (): InstalledShader[] => list,
  version: (): number => version,
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
  /** Shaders activos, válidos, en orden, listos para el motor. */
  active(): ActiveShader[] {
    return list
      .filter((s) => s.enabled && s.source && s.meta && !s.error)
      .map((s) => ({ file: s.file, source: s.source!, meta: s.meta!, values: s.params }))
  }
}

// resultado de compilación por contenido: cada shader se compila una sola vez por sesión
const validated = new Map<string, string | null>()

function hydrate(raw: { file: string; enabled: boolean; params: Record<string, number>; source: string | null }, getRenderer: () => WebGLRenderer): InstalledShader {
  if (!raw.source) return { ...raw, meta: null, error: 'El archivo del shader ya no existe en la carpeta de shaders.' }
  const meta = parseShaderMeta(raw.source, raw.file)
  const params = Object.fromEntries(meta.params.map((p) => [p.name, raw.params?.[p.name] ?? p.def]))
  let error = validated.get(raw.source)
  if (error === undefined) {
    error = validateShader(raw.source, raw.file, getRenderer())
    validated.set(raw.source, error)
  }
  return { ...raw, params, meta, error }
}

export async function loadShaders(): Promise<void> {
  // un único contexto WebGL temporal para todo el lote (solo si hay algo que compilar)
  let r: WebGLRenderer | null = null
  const getRenderer = (): WebGLRenderer => (r ??= createValidationRenderer())
  try {
    list = (await window.api.shadersList()).map((x) => hydrate(x, getRenderer))
  } finally {
    if (r) {
      ;(r as WebGLRenderer).dispose()
      ;(r as WebGLRenderer).forceContextLoss()
    }
  }
  publish()
}

let saveTimer: number | null = null
function persist(): void {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = window.setTimeout(() => {
    window.api.shadersUpdate(list.map(({ file, enabled, params }) => ({ file, enabled, params })))
  }, 300)
}

export function setShaders(next: InstalledShader[]): void {
  list = next
  publish()
  persist()
}

export function setShaderParam(file: string, name: string, value: number): void {
  list = list.map((s) => (s.file === file ? { ...s, params: { ...s.params, [name]: value } } : s))
  publish()
  persist()
}

const cleanErr = (e: unknown): string => String((e as Error).message ?? e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '')

/** Instala desde ruta (arrastrar), ejemplo incluido (texto) o diálogo (null). Valida antes de activar. */
export async function installShader(args: { path?: string; name?: string; text?: string } | null): Promise<void> {
  const st = useStore.getState()
  try {
    const r = await window.api.shadersInstall(args)
    if (!r) return
    await loadShaders()
    const s = list.find((x) => x.file === r.file)
    if (s?.error) st.toast({ kind: 'error', title: `El shader «${s.meta?.name ?? r.file}» no compila`, detail: s.error.slice(0, 400) }, 15000)
    else st.toast({ kind: 'success', title: `Shader instalado: ${s?.meta?.name ?? r.file}`, detail: s?.meta?.description || 'Activado en el visor y en el render final.' })
  } catch (e) {
    st.toast({ kind: 'error', title: 'No se pudo instalar el shader', detail: cleanErr(e) })
  }
}
