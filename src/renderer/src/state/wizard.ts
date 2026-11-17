// Lógica del asistente de primera escena (sin interfaz, para poder probarla).
import type { BuildInfo, EnvironmentSettings, Vec3 } from '@shared/types'
import type { TemplateId } from '../compositor/templates'
import type { Look } from './looks'

export interface BaseOption {
  id: string
  label: string
  detail: string
  /** null = sin base */
  params: Record<string, number | string | boolean> | null
  /** estilo recomendado para esta base */
  look: string
}

export const BASE_OPTIONS: BaseOption[] = [
  { id: 'isla-verde', label: 'Isla verde', detail: 'Hierba, flores y tierra', params: { shape: 'island', islandStyle: 'verde', plants: 0.25, height: 2 }, look: 'pastel' },
  { id: 'isla-seca', label: 'Isla seca', detail: 'Tierra, arena y arbustos', params: { shape: 'island', islandStyle: 'seca', plants: 0.22, height: 2 }, look: 'pergamino' },
  { id: 'isla-nieve', label: 'Isla nevada', detail: 'Nieve, hielo y piedra', params: { shape: 'island', islandStyle: 'nieve', plants: 0.15, height: 2 }, look: 'invierno' },
  { id: 'isla-arena', label: 'Isla de arena', detail: 'Arena y arenisca', params: { shape: 'island', islandStyle: 'arena', plants: 0.12, height: 2 }, look: 'hora-dorada' },
  { id: 'escalonada', label: 'Base de exhibición', detail: 'Piedra pulida con borde dorado', params: { shape: 'blocks', height: 2, rim: true }, look: 'exhibicion' },
  { id: 'ninguna', label: 'Sin base', detail: 'Solo la construcción', params: null, look: 'exhibicion' }
]

export interface TemplateOption {
  id: TemplateId
  label: string
  detail: string
  /** el render debe salir con fondo transparente para que quede recortado sobre la lámina */
  transparent: boolean
}

export const TEMPLATE_OPTIONS: TemplateOption[] = [
  { id: 'showcase', label: 'Exhibición', detail: 'Render a pantalla completa con título y créditos', transparent: false },
  { id: 'bundle', label: 'Paquete de construcciones', detail: 'Gran título y construcciones recortadas', transparent: true },
  { id: 'collection', label: 'Colección con etiquetas', detail: 'Título pixelado y nombre bajo cada pieza', transparent: true },
  { id: 'sheet', label: 'Ficha individual', detail: 'Imagen con los datos reales del archivo', transparent: true }
]

/** Plantilla recomendada para cada estilo */
export function recommendedTemplate(lookId: string | null): TemplateId {
  if (lookId === 'pastel') return 'bundle'
  if (lookId === 'pergamino') return 'collection'
  return 'showcase'
}

/**
 * Parámetros y posición de una base que cubre la huella de la construcción.
 * La construcción apoya en y = 0 y la base queda justo debajo.
 */
export function baseForBuild(info: Pick<BuildInfo, 'width' | 'length'>, buildPos: Vec3, opt: BaseOption): { params: Record<string, number | string | boolean>; position: Vec3 } | null {
  if (!opt.params) return null
  const half = Math.max(info.width, info.length) / 2
  const island = opt.params.shape === 'island'
  // la isla es irregular (su radio varía ~±18 %): se amplía para que no asome la construcción
  const radius = Math.min(60, Math.max(4, Math.ceil(island ? half / 0.8 + 2 : half + 2)))
  const height = Number(opt.params.height ?? 2)
  return { params: { ...opt.params, radius, seed: 7 }, position: [buildPos[0], -height, buildPos[2]] }
}

const hhmm = (t: number): string => `${String(Math.floor(t)).padStart(2, '0')}:${String(Math.round((t % 1) * 60)).padStart(2, '0')}`

/** Lista legible de lo que cambia un estilo visual (para explicar cada estilo antes de aplicarlo). */
export function lookSummary(look: Look): string[] {
  const e = look.env as Partial<EnvironmentSettings> & Record<string, Record<string, unknown> | undefined>
  const out: string[] = []
  const bg = e.background as Partial<EnvironmentSettings['background']> | undefined
  if (bg?.mode === 'studio') out.push(bg.hideEnvironment ? 'fondo de estudio (oculta terreno y agua)' : 'fondo de estudio')
  else if (bg?.mode === 'sky') out.push('cielo y mundo')
  if (typeof e.timeOfDay === 'number') out.push(`hora ${hhmm(e.timeOfDay)}`)
  if (e.shadowSoftness != null) out.push(e.shadowSoftness >= 0.6 ? 'sombras suaves' : 'sombras definidas')
  const clouds = e.clouds as Partial<EnvironmentSettings['clouds']> | undefined
  if (clouds) out.push(clouds.enabled === false ? 'sin nubes' : clouds.style === 'volumetric' ? 'nubes volumétricas' : 'nubes de bloques')
  const fog = e.fog as Partial<EnvironmentSettings['fog']> | undefined
  if (fog?.enabled === true) out.push('niebla')
  if (e.weather === 'snow') out.push('nieve')
  if (e.weather === 'rain') out.push('lluvia')
  const post = e.post as Partial<EnvironmentSettings['post']> | undefined
  if (post) {
    if ((post.bloom ?? 0) > 0) out.push('brillo en las luces')
    if ((post.vignette ?? 0) >= 0.3) out.push('viñeta')
    if (post.saturation != null && Math.abs(post.saturation - 1) >= 0.05) out.push(post.saturation > 1 ? 'colores más saturados' : 'colores más suaves')
    if (post.warmth != null && Math.abs(post.warmth) >= 0.1) out.push(post.warmth > 0 ? 'tono cálido' : 'tono frío')
    if ((post.grain ?? 0) >= 0.05) out.push('grano de película')
  }
  const q = e.quality as Partial<EnvironmentSettings['quality']> | undefined
  if (q?.ao) out.push('oclusión ambiental')
  return out
}
