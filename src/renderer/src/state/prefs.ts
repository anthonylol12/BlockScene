// Preferencias de la aplicación (globales, no del proyecto): controles de cámara y herramientas.
import { useStore, type TransformMode } from './store'

export type MouseScheme = 'blockscene' | 'blender' | 'touchpad'

export interface Prefs {
  mouse: MouseScheme
  orbitSpeed: number
  zoomSpeed: number
  panSpeed: number
  invertZoom: boolean
  smoothCamera: boolean
  defaultTool: TransformMode
  /** pasos de ajuste del gizmo (0 = libre) */
  snapMove: number
  snapRotate: number
  snapScale: number
  gizmoSize: number
}

export const DEFAULT_PREFS: Prefs = {
  mouse: 'blockscene',
  orbitSpeed: 1,
  zoomSpeed: 1,
  panSpeed: 1,
  invertZoom: false,
  smoothCamera: true,
  defaultTool: 'translate',
  snapMove: 1,
  snapRotate: 15,
  snapScale: 0,
  gizmoSize: 1
}

export const MOUSE_SCHEMES: { value: MouseScheme; label: string; detail: string }[] = [
  { value: 'blockscene', label: 'BlockScene', detail: 'Izquierdo: orbitar · Derecho: desplazar · Rueda: zoom' },
  { value: 'blender', label: 'Estilo Blender', detail: 'Rueda pulsada: orbitar · Mayús + rueda pulsada: desplazar · Rueda: zoom · Izquierdo: seleccionar' },
  { value: 'touchpad', label: 'Panel táctil', detail: 'Izquierdo: orbitar · Mayús + izquierdo: desplazar · Desplazar con dos dedos: zoom' }
]

let prefs: Prefs = { ...DEFAULT_PREFS }
const listeners = new Set<() => void>()
export const prefsStore = {
  get: (): Prefs => prefs,
  subscribe(fn: () => void): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  }
}
const publish = (): void => listeners.forEach((l) => l())

export async function loadPrefs(): Promise<void> {
  try {
    const saved = (await window.api.prefsLoad()) as Partial<Prefs> | null
    prefs = { ...DEFAULT_PREFS, ...(saved ?? {}) }
  } catch {
    prefs = { ...DEFAULT_PREFS }
  }
  useStore.getState().setTransformMode(prefs.defaultTool)
  publish()
}

export function setPrefs(patch: Partial<Prefs>): void {
  prefs = { ...prefs, ...patch }
  publish()
  window.api.prefsSave(prefs)
}

export function resetPrefs(): void {
  prefs = { ...DEFAULT_PREFS }
  useStore.getState().setTransformMode(prefs.defaultTool)
  publish()
  window.api.prefsSave(prefs)
}
