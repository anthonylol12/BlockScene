// Modelo de datos del proyecto BlockScene (se serializa a JSON en archivos .bscene)

export type Vec3 = [number, number, number]

export interface Transform {
  position: Vec3
  /** grados */
  rotation: Vec3
  scale: Vec3
}

export type ObjectKind =
  | 'build'
  | 'base'
  | 'terrain'
  | 'water'
  | 'path'
  | 'rock'
  | 'tree'
  | 'vegetation'
  | 'light'
  | 'decor'

export interface SceneObject {
  id: string
  name: string
  kind: ObjectKind
  layerId: string
  visible: boolean
  transform: Transform
  /** Parámetros específicos del tipo (procedurales) */
  params: Record<string, number | string | boolean>
  /** Para kind === 'build': id del recurso importado */
  assetId?: string
}

export interface Layer {
  id: string
  name: string
  visible: boolean
  color: string
}

/** Datos REALES extraídos del archivo. Si algo no se pudo leer, el campo es null. */
export interface BuildInfo {
  format: string
  formatLabel: string
  version: string | null
  dataVersion: number | null
  minecraftVersion: string | null
  width: number
  height: number
  length: number
  blockCount: number
  paletteSize: number
  topBlocks: [string, number][]
  regions: number | null
  author: string | null
  name: string | null
  warnings: string[]
  /** Bloques que se dibujan con color aproximado por no estar en la tabla */
  unknownBlocks: number
}

export interface BuildAsset {
  id: string
  fileName: string
  /** Archivo original codificado en base64 (para poder re-analizarlo al abrir el proyecto) */
  dataBase64: string
  info: BuildInfo
  isDemo?: boolean
}

export type Weather = 'clear' | 'rain' | 'snow'
export type QualityPreset = 'low' | 'medium' | 'high'
export type MaterialStyle = 'matte' | 'soft' | 'glossy'

export interface EnvironmentSettings {
  timeOfDay: number // 0..24
  sunAzimuth: number // grados
  sunColor: string
  sunIntensity: number
  shadows: boolean
  shadowSoftness: number // 0..1
  ambientColor: string
  ambientIntensity: number
  skyTint: string
  clouds: { enabled: boolean; style: 'blocky' | 'volumetric'; density: number; scale: number; detail: number; height: number; speed: number }
  fog: { enabled: boolean; density: number; height: number; color: string }
  weather: Weather
  weatherIntensity: number
  material: { style: MaterialStyle; vertexAO: boolean; colorVariation: number; pixelTexture: boolean }
  quality: { preset: QualityPreset; ao: boolean; reflections: boolean }
  exposure: number
  /** sky = cielo y entorno; studio = fondo de exhibición con degradado y suelo que solo recibe sombra */
  background: { mode: 'sky' | 'studio'; color1: string; color2: string; specks: number; floorShadow: boolean; shadowOpacity: number; hideEnvironment: boolean }
  post: { bloom: number; bloomThreshold: number; vignette: number; saturation: number; contrast: number; warmth: number; grain: number }
}

export interface CameraView {
  id: string
  name: string
  position: Vec3
  target: Vec3
  fov: number
  ortho: boolean
  zoom: number
}

export interface RenderItem {
  id: string
  name: string
  width: number
  height: number
  createdAt: string
  /** PNG en data URL */
  dataUrl: string
  source: 'scene' | 'isolated' | 'imported'
  /** Si es un render aislado de una construcción */
  objectId?: string
  buildInfo?: BuildInfo
  samples?: number
  /** renderizado con fondo transparente (recortado al contenido) */
  transparent?: boolean
}

export type PageQuality = 'fast' | 'high' | 'max'

export interface TextStyle {
  role: 'title' | 'subtitle' | 'label' | 'credits' | 'watermark' | 'body'
  font: string
  size: number
  weight: number
  italic: boolean
  color: string
  align: 'left' | 'center' | 'right'
  letterSpacing: number
  lineHeight: number
  uppercase: boolean
}

export interface CompElement {
  id: string
  type: 'image' | 'text' | 'rect'
  name: string
  x: number
  y: number
  w: number
  h: number
  rotation: number
  opacity: number
  locked: boolean
  visible: boolean
  // imagen
  imageId?: string | null
  fit?: 'contain' | 'cover'
  shadow?: boolean
  // texto
  text?: string
  style?: TextStyle
  // rectángulo / marco
  fill?: string
  radius?: number
  stroke?: string
  strokeWidth?: number
}

export interface Background {
  type: 'solid' | 'linear' | 'radial'
  color1: string
  color2: string
  angle: number
}

export interface Composition {
  id: string
  name: string
  page: { width: number; height: number; preset: string; quality: PageQuality }
  background: Background
  margin: number
  safeZone: number
  showGuides: boolean
  snap: boolean
  elements: CompElement[]
  fonts: { heading: string; body: string }
}

export interface Project {
  format: 'blockscene-project'
  version: 1
  name: string
  layers: Layer[]
  objects: SceneObject[]
  assets: Record<string, BuildAsset>
  environment: EnvironmentSettings
  cameras: CameraView[]
  mainCameraId: string | null
  renders: RenderItem[]
  compositions: Composition[]
  activeCompositionId: string | null
  customTemplates: Composition[]
}
