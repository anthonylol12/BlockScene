// Estilos visuales ("shaders" de BlockScene): conjuntos de ajustes de luz, fondo y postprocesado.
// Se pueden instalar desde archivos .bslook (JSON) y exportar los ajustes actuales.
// Los shaderpacks de Minecraft (OptiFine/Iris) NO son compatibles: son programas GLSL para el motor del juego.
import type { EnvironmentSettings } from '@shared/types'
import { useStore } from './store'

type Sub<K extends keyof EnvironmentSettings> = EnvironmentSettings[K] extends object ? Partial<EnvironmentSettings[K]> : EnvironmentSettings[K]
export type LookEnv = { [K in keyof EnvironmentSettings]?: Sub<K> }

export interface Look {
  format: 'blockscene-look'
  version: 1
  id: string
  name: string
  description: string
  env: LookEnv
  builtIn?: boolean
}

const L = (id: string, name: string, description: string, env: LookEnv): Look => ({ format: 'blockscene-look', version: 1, id, name, description, env, builtIn: true })

export const BUILTIN_LOOKS: Look[] = [
  L('exhibicion', 'Exhibición oscura', 'Fondo de estudio oscuro con motas, sombra suave en el suelo, brillo en las luces y viñeta. Ideal para presentar construcciones.', {
    background: { mode: 'studio', color1: '#4b4541', color2: '#141210', specks: 0.55, floorShadow: true, shadowOpacity: 0.6, hideEnvironment: true },
    timeOfDay: 10.5, sunAzimuth: 200, sunColor: '#ffe9cf', sunIntensity: 2.4, shadows: true, shadowSoftness: 0.7,
    ambientColor: '#d6ccc2', ambientIntensity: 1.15, exposure: 1.05,
    clouds: { enabled: false }, fog: { enabled: false }, weather: 'clear',
    material: { style: 'soft', vertexAO: true },
    quality: { ao: true, reflections: true },
    post: { bloom: 0.35, bloomThreshold: 0.8, vignette: 0.5, saturation: 0.96, contrast: 1.08, warmth: 0.12, grain: 0.12 }
  }),
  L('estudio-claro', 'Estudio claro', 'Fondo gris claro de catálogo con sombra suave. Para fichas limpias.', {
    background: { mode: 'studio', color1: '#e9e6e1', color2: '#b9b4ad', specks: 0, floorShadow: true, shadowOpacity: 0.35, hideEnvironment: true },
    timeOfDay: 11, sunAzimuth: 210, sunColor: '#ffffff', sunIntensity: 2.2, shadows: true, shadowSoftness: 0.8,
    ambientColor: '#ffffff', ambientIntensity: 1.4, exposure: 1,
    clouds: { enabled: false }, fog: { enabled: false }, weather: 'clear',
    quality: { ao: true },
    post: { bloom: 0, vignette: 0.12, saturation: 1, contrast: 1.02, warmth: 0, grain: 0 }
  }),
  // ---- estilos habituales en renders de construcciones publicados en internet
  L('pergamino', 'Colección pergamino', 'Fondo liso beige cálido y luz de día suave, como las hojas de colección. Combínalo con la base «Isla de terreno» (seca) y la plantilla «Colección con etiquetas».', {
    background: { mode: 'studio', color1: '#d2c4a2', color2: '#b7a785', specks: 0, floorShadow: true, shadowOpacity: 0.4, hideEnvironment: true },
    timeOfDay: 11.5, sunAzimuth: 135, sunColor: '#fff3df', sunIntensity: 2.3, shadows: true, shadowSoftness: 0.75,
    ambientColor: '#efe4cf', ambientIntensity: 1.35, exposure: 1.05,
    clouds: { enabled: false }, fog: { enabled: false }, weather: 'clear', material: { style: 'soft', vertexAO: true },
    quality: { ao: true, reflections: true },
    post: { bloom: 0.1, bloomThreshold: 0.85, vignette: 0.12, saturation: 0.95, contrast: 1.03, warmth: 0.15, grain: 0 }
  }),
  L('pastel', 'Paquete pastel', 'Fondo azul pastel, sombras cortas y suaves y colores limpios, como los paquetes de casas. Combínalo con «Isla de terreno» (verde) y la plantilla «Paquete de construcciones».', {
    background: { mode: 'studio', color1: '#cfe3f0', color2: '#b4cfe2', specks: 0, floorShadow: true, shadowOpacity: 0.28, hideEnvironment: true },
    timeOfDay: 12.5, sunAzimuth: 160, sunColor: '#ffffff', sunIntensity: 2.2, shadows: true, shadowSoftness: 0.85,
    ambientColor: '#e8f1fa', ambientIntensity: 1.5, exposure: 1.05,
    clouds: { enabled: false }, fog: { enabled: false }, weather: 'clear', material: { style: 'soft', vertexAO: true },
    quality: { ao: true, reflections: true },
    post: { bloom: 0, vignette: 0.05, saturation: 1.02, contrast: 1.05, warmth: 0, grain: 0 }
  }),
  L('noche-cine', 'Noche cinematográfica', 'Noche oscura verdosa con las ventanas y faroles brillando y viñeta fuerte. Para el fondo desenfocado activa el shader «Profundidad de campo».', {
    background: { mode: 'sky' }, timeOfDay: 21.5, sunAzimuth: 200, ambientColor: '#4d6b5e', ambientIntensity: 0.75, exposure: 1.25,
    clouds: { enabled: true, style: 'volumetric', density: 0.35 }, fog: { enabled: true, density: 0.35, height: 30, color: '#2f4a44' }, weather: 'clear',
    material: { style: 'soft', vertexAO: true }, quality: { ao: true, reflections: true },
    post: { bloom: 0.9, bloomThreshold: 0.5, vignette: 0.6, saturation: 0.88, contrast: 1.08, warmth: 0.1, grain: 0.12 }
  }),
  L('hora-dorada', 'Hora dorada', 'Sol bajo y dorado con niebla ligera, como los renders de paisaje (Chunky/Blender).', {
    background: { mode: 'sky' }, timeOfDay: 7.3, sunAzimuth: 110, sunColor: '#ffc27a', sunIntensity: 3.2, shadows: true, shadowSoftness: 0.45,
    ambientColor: '#ffd9b0', ambientIntensity: 0.85, exposure: 1.1,
    clouds: { enabled: true, style: 'volumetric', density: 0.4, detail: 5 }, fog: { enabled: true, density: 0.28, height: 40, color: '#f3cf9e' }, weather: 'clear',
    quality: { ao: true, reflections: true },
    post: { bloom: 0.35, bloomThreshold: 0.7, vignette: 0.3, saturation: 1.08, contrast: 1.06, warmth: 0.3, grain: 0.06 }
  }),
  L('plano', 'Plano técnico', 'Fondo azul de plano con luz plana y uniforme, para guías de construcción. Queda bien con el shader «Contorno cel» y la vista superior o isométrica.', {
    background: { mode: 'studio', color1: '#2a5c9c', color2: '#173864', specks: 0, floorShadow: true, shadowOpacity: 0.2, hideEnvironment: true },
    timeOfDay: 12, sunAzimuth: 180, sunColor: '#ffffff', sunIntensity: 1.4, shadows: true, shadowSoftness: 1,
    ambientColor: '#ffffff', ambientIntensity: 1.9, exposure: 1,
    clouds: { enabled: false }, fog: { enabled: false }, weather: 'clear', material: { style: 'matte', vertexAO: true },
    quality: { ao: false, reflections: false },
    post: { bloom: 0, vignette: 0.15, saturation: 0.9, contrast: 1.05, warmth: -0.1, grain: 0 }
  }),
  L('miniatura', 'Miniatura (tilt-shift)', 'Colores saturados y contraste alto que, con el shader «Profundidad de campo» y una cámara alta, hacen que la construcción parezca una maqueta.', {
    background: { mode: 'sky' }, timeOfDay: 13.5, sunAzimuth: 210, sunColor: '#fffaf0', sunIntensity: 2.8, shadowSoftness: 0.4,
    ambientColor: '#cfe2ff', ambientIntensity: 1.05,
    clouds: { enabled: true, style: 'blocky', density: 0.35 }, fog: { enabled: false }, weather: 'clear', quality: { ao: true },
    post: { bloom: 0.1, vignette: 0.35, saturation: 1.3, contrast: 1.12, warmth: 0.05, grain: 0 }
  }),
  L('invierno', 'Invierno', 'Nieve cayendo, luz fría y niebla blanca. Combínalo con «Isla de terreno» (nevado).', {
    background: { mode: 'sky' }, timeOfDay: 10.5, sunAzimuth: 160, sunColor: '#eef4ff', sunIntensity: 1.9, shadowSoftness: 0.7,
    ambientColor: '#dbe7ff', ambientIntensity: 1.25,
    clouds: { enabled: true, style: 'volumetric', density: 0.65 }, fog: { enabled: true, density: 0.4, height: 35, color: '#e6eef8' }, weather: 'snow', weatherIntensity: 0.55,
    quality: { ao: true },
    post: { bloom: 0.15, vignette: 0.2, saturation: 0.85, contrast: 1, warmth: -0.25, grain: 0.04 }
  }),
  L('natural', 'Mundo natural', 'Cielo de día con nubes de bloques y colores neutros.', {
    background: { mode: 'sky' }, timeOfDay: 14, sunAzimuth: 225, sunColor: '#fff2dc', sunIntensity: 2.6, shadowSoftness: 0.35,
    ambientColor: '#bcd4ff', ambientIntensity: 0.9, exposure: 1,
    clouds: { enabled: true, style: 'blocky', density: 0.45 }, fog: { enabled: true, density: 0.15 }, weather: 'clear',
    post: { bloom: 0, vignette: 0.15, saturation: 1, contrast: 1, warmth: 0, grain: 0 }
  }),
  L('atardecer', 'Atardecer cinematográfico', 'Sol bajo y cálido, neblina dorada y brillo suave.', {
    background: { mode: 'sky' }, timeOfDay: 18.2, sunAzimuth: 250, sunColor: '#ffb070', sunIntensity: 3, shadowSoftness: 0.5,
    ambientColor: '#ffcfa8', ambientIntensity: 0.8, exposure: 1.1,
    clouds: { enabled: true, style: 'blocky', density: 0.5 }, fog: { enabled: true, density: 0.3, height: 35, color: '#f0c8a0' }, weather: 'clear',
    post: { bloom: 0.3, bloomThreshold: 0.75, vignette: 0.35, saturation: 1.1, contrast: 1.06, warmth: 0.35, grain: 0.08 }
  }),
  L('noche', 'Noche con faroles', 'Noche estrellada; las luces y bloques emisivos brillan.', {
    background: { mode: 'sky' }, timeOfDay: 22, sunAzimuth: 225, ambientColor: '#6a7fb5', ambientIntensity: 0.7, exposure: 1.2,
    clouds: { enabled: true, style: 'blocky', density: 0.3 }, fog: { enabled: true, density: 0.2, color: '#4a5878' }, weather: 'clear',
    post: { bloom: 0.7, bloomThreshold: 0.55, vignette: 0.45, saturation: 0.9, contrast: 1.05, warmth: -0.1, grain: 0.1 }
  }),
  L('niebla', 'Mañana con niebla', 'Luz difusa, niebla baja y colores apagados.', {
    background: { mode: 'sky' }, timeOfDay: 8, sunAzimuth: 120, sunColor: '#fff4e6', sunIntensity: 1.6, shadowSoftness: 0.9,
    ambientColor: '#dfe6ee', ambientIntensity: 1.2,
    clouds: { enabled: true, style: 'volumetric', density: 0.6 }, fog: { enabled: true, density: 0.6, height: 25, color: '#d8dee6' }, weather: 'clear',
    post: { bloom: 0.1, vignette: 0.2, saturation: 0.85, contrast: 0.95, warmth: 0.05, grain: 0.05 }
  }),
  L('vibrante', 'Vibrante', 'Mediodía con colores saturados y contraste alto.', {
    background: { mode: 'sky' }, timeOfDay: 13, sunAzimuth: 210, sunColor: '#ffffff', sunIntensity: 3, shadowSoftness: 0.3,
    ambientColor: '#c4dcff', ambientIntensity: 1, clouds: { enabled: true, style: 'blocky', density: 0.45 }, fog: { enabled: true, density: 0.1 }, weather: 'clear',
    post: { bloom: 0.15, bloomThreshold: 0.85, vignette: 0.15, saturation: 1.25, contrast: 1.1, warmth: 0.05, grain: 0 }
  })
]

/** Aplica un estilo sobre los ajustes actuales (solo cambia lo que el estilo define). */
export function applyLook(look: Look): void {
  const st = useStore.getState()
  const cur = st.project.environment
  const next = { ...cur } as Record<string, unknown>
  for (const [k, v] of Object.entries(look.env)) {
    const base = (cur as unknown as Record<string, unknown>)[k]
    next[k] = v && typeof v === 'object' && base && typeof base === 'object' ? { ...base, ...v } : v
  }
  st.setEnv(next as Partial<EnvironmentSettings>)
  st.toast({ kind: 'success', title: `Estilo aplicado: ${look.name}`, detail: 'Puedes ajustar cualquier valor en las pestañas Escena y Render.' }, 3500)
}

const ENV_KEYS = new Set(['timeOfDay', 'sunAzimuth', 'sunColor', 'sunIntensity', 'shadows', 'shadowSoftness', 'ambientColor', 'ambientIntensity', 'skyTint', 'clouds', 'fog', 'weather', 'weatherIntensity', 'material', 'quality', 'exposure', 'background', 'post'])

/** Valida un archivo .bslook. Lanza un error comprensible si no es válido. */
export function parseLook(text: string, fallbackName: string): Look {
  let raw: Partial<Look>
  try {
    raw = JSON.parse(text)
  } catch {
    throw new Error('El archivo no es JSON válido.')
  }
  if (raw.format !== 'blockscene-look' || !raw.env || typeof raw.env !== 'object') throw new Error('No es un estilo de BlockScene (.bslook).')
  const env: LookEnv = {}
  for (const [k, v] of Object.entries(raw.env)) if (ENV_KEYS.has(k)) (env as Record<string, unknown>)[k] = v
  if (!Object.keys(env).length) throw new Error('El estilo no contiene ningún ajuste reconocido.')
  return { format: 'blockscene-look', version: 1, id: `user_${Date.now().toString(36)}`, name: String(raw.name || fallbackName).slice(0, 60), description: String(raw.description ?? '').slice(0, 300), env }
}

// ---- estilos instalados por el usuario (carpeta de datos de la app)
let userLooks: Look[] = []
const lookListeners = new Set<() => void>()
export const installedLooks = {
  get: (): Look[] => userLooks,
  subscribe(fn: () => void): () => void {
    lookListeners.add(fn)
    return () => lookListeners.delete(fn)
  }
}
export async function loadUserLooks(): Promise<void> {
  try {
    userLooks = (await window.api.looksLoad()) as Look[]
  } catch {
    userLooks = []
  }
  lookListeners.forEach((l) => l())
}
export async function saveUserLooks(list: Look[]): Promise<void> {
  userLooks = list
  lookListeners.forEach((l) => l())
  await window.api.looksSave(list)
}
/** Instala un .bslook (texto) y lo aplica. Lanza error comprensible si no es válido. */
export async function installLookText(text: string, fallbackName: string): Promise<Look> {
  const look = parseLook(text, fallbackName)
  await saveUserLooks([...userLooks.filter((u) => u.name !== look.name), look])
  applyLook(look)
  return look
}

export function currentAsLook(name: string): Look {
  const e = useStore.getState().project.environment
  const { timeOfDay, sunAzimuth, sunColor, sunIntensity, shadows, shadowSoftness, ambientColor, ambientIntensity, skyTint, clouds, fog, weather, weatherIntensity, material, quality, exposure, background, post } = e
  return { format: 'blockscene-look', version: 1, id: `user_${Date.now().toString(36)}`, name, description: 'Exportado desde BlockScene', env: { timeOfDay, sunAzimuth, sunColor, sunIntensity, shadows, shadowSoftness, ambientColor, ambientIntensity, skyTint, clouds, fog, weather, weatherIntensity, material, quality, exposure, background, post } }
}
