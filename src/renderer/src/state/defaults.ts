import type { Composition, EnvironmentSettings, ObjectKind, Project, SceneObject } from '@shared/types'

export const uid = (p = 'id'): string => `${p}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`

export const defaultEnvironment = (): EnvironmentSettings => ({
  timeOfDay: 15.5,
  sunAzimuth: 225,
  sunColor: '#fff2dc',
  sunIntensity: 2.6,
  shadows: true,
  shadowSoftness: 0.35,
  ambientColor: '#bcd4ff',
  ambientIntensity: 0.9,
  skyTint: '#5d9bff',
  clouds: { enabled: true, style: 'blocky', density: 0.45, scale: 1, detail: 4, height: 140, speed: 0.4 },
  fog: { enabled: true, density: 0.12, height: 30, color: '#d3d9e0' },
  weather: 'clear',
  weatherIntensity: 0.6,
  material: { style: 'soft', vertexAO: true, colorVariation: 0.05, pixelTexture: true },
  quality: { preset: 'medium', ao: false, reflections: true },
  exposure: 1,
  background: { mode: 'sky', color1: '#4b4541', color2: '#141210', specks: 0.4, floorShadow: true, shadowOpacity: 0.55, hideEnvironment: true },
  post: { bloom: 0, bloomThreshold: 0.85, vignette: 0.2, saturation: 1, contrast: 1, warmth: 0, grain: 0 }
})

export const DEFAULT_LAYERS = [
  { id: 'layer_builds', name: 'Construcciones', visible: true, color: '#5aa9ff' },
  { id: 'layer_env', name: 'Entorno', visible: true, color: '#6cc070' },
  { id: 'layer_lights', name: 'Luces y decoración', visible: true, color: '#f0b44c' }
]

export function newProject(name = 'Proyecto sin título'): Project {
  return {
    format: 'blockscene-project',
    version: 1,
    name,
    layers: DEFAULT_LAYERS.map((l) => ({ ...l })),
    objects: [],
    assets: {},
    environment: defaultEnvironment(),
    cameras: [],
    mainCameraId: null,
    renders: [],
    compositions: [],
    activeCompositionId: null,
    customTemplates: []
  }
}

export const KIND_LABEL: Record<ObjectKind, string> = {
  build: 'Construcción',
  base: 'Base de exhibición',
  terrain: 'Terreno',
  water: 'Agua',
  path: 'Camino',
  rock: 'Roca',
  tree: 'Árbol',
  vegetation: 'Vegetación',
  light: 'Luz',
  decor: 'Decoración'
}

export const KIND_DEFAULTS: Record<Exclude<ObjectKind, 'build'>, Record<string, number | string | boolean>> = {
  base: { shape: 'blocks', radius: 12, height: 2, block: 'polished_andesite', sideBlock: 'stone_bricks', rim: true, rimBlock: 'gold_block' },
  terrain: { size: 128, amplitude: 6, roughness: 0.5, seed: 7, flatCenter: 24, block: 'grass_block', fillBlock: 'dirt', deepBlock: 'stone', plants: 0.12, trees: 6, treeSpecies: 'oak' },
  water: { size: 90, depth: 1 },
  path: { length: 30, width: 3, curve: 0, seed: 3, block: 'dirt_path' },
  rock: { size: 2.5, seed: 11, jagged: 0.35, block: 'stone' },
  tree: { species: 'oak', height: 7, seed: 5 },
  vegetation: { area: 50, count: 400, seed: 2, mix: 'mixed', avoidCenter: 16 },
  light: { type: 'point', color: '#ffc98a', intensity: 40, distance: 30, castShadow: false },
  decor: { type: 'lamp', wood: 'oak' }
}

export function makeObject(kind: ObjectKind, layerId: string, extra: Partial<SceneObject> = {}): SceneObject {
  return {
    id: uid('obj'),
    name: KIND_LABEL[kind],
    kind,
    layerId,
    visible: true,
    transform: { position: [0, 0, 0], rotation: [0, 0, 0], scale: [1, 1, 1] },
    params: kind === 'build' ? {} : { ...KIND_DEFAULTS[kind] },
    ...extra
  }
}

export function blankComposition(name = 'Lámina 1'): Composition {
  return {
    id: uid('comp'),
    name,
    page: { width: 1920, height: 1080, preset: 'fhd', quality: 'high' },
    background: { type: 'linear', color1: '#14171d', color2: '#262b35', angle: 135 },
    margin: 72,
    safeZone: 40,
    showGuides: true,
    snap: true,
    elements: [],
    fonts: { heading: 'Segoe UI', body: 'Segoe UI' }
  }
}
