// Texturas por cara a partir de los modelos de bloque del propio juego (assets/minecraft/blockstates y models/block).
// Para cada bloque: blockstate → modelo (variante por defecto o primera parte) → cadena de modelos padre →
// texturas resueltas (#referencias) → textura de la cara superior, lateral e inferior.

type Json = Record<string, unknown>
/** [arriba, lado, abajo] como nombres de textures/block (sin prefijo) */
export type ModelFaces = Record<string, [string, string, string]>

const strip = (t: string): string => t.replace(/^minecraft:/, '').replace(/^block\//, '')

function modelOf(state: unknown): string | null {
  if (!state || typeof state !== 'object') return null
  const s = state as Json
  const pick = (v: unknown): string | null => {
    const x = Array.isArray(v) ? v[0] : v
    return x && typeof x === 'object' && typeof (x as Json).model === 'string' ? ((x as Json).model as string) : null
  }
  if (s.variants && typeof s.variants === 'object') {
    const vars = s.variants as Json
    const keys = Object.keys(vars)
    // preferimos la variante "sin propiedades", la inferior/cerrada/por defecto
    const age = (k: string): number => Number(/age=(\d+)/.exec(k)?.[1] ?? -1)
    const oldest = [...keys].sort((a, b) => age(b) - age(a))[0]
    const pref =
      keys.find((k) => k === '') ??
      keys.find((k) => /half=(lower|bottom)/.test(k) && !/open=true/.test(k) && (!/facing=/.test(k) || /facing=north/.test(k))) ??
      keys.find((k) => /axis=y/.test(k)) ??
      (keys.some((k) => /age=/.test(k)) ? oldest : undefined) ??
      keys.find((k) => /facing=north/.test(k)) ??
      keys[0]
    return pref != null ? pick(vars[pref]) : null
  }
  if (Array.isArray(s.multipart)) {
    for (const part of s.multipart) {
      const m = pick((part as Json).apply)
      if (m) return m
    }
  }
  return null
}

function resolveTextures(model: string, models: Record<string, unknown>): Record<string, string> {
  const chain: Json[] = []
  let name: string | null = strip(model)
  for (let i = 0; i < 12 && name; i++) {
    const m = models[name] as Json | undefined
    if (!m) break
    chain.unshift(m)
    name = typeof m.parent === 'string' ? strip(m.parent as string) : null
  }
  const tex: Record<string, string> = {}
  for (const m of chain) {
    if (!m.textures || typeof m.textures !== 'object') continue
    for (const [k, v] of Object.entries(m.textures as Json)) {
      // 26.x: la textura puede ser { "sprite": "...", "force_translucent": true }
      if (typeof v === 'string') tex[k] = v
      else if (v && typeof v === 'object' && typeof (v as Json).sprite === 'string') tex[k] = (v as Json).sprite as string
    }
  }
  // resolver referencias "#clave"
  for (let i = 0; i < 6; i++) for (const [k, v] of Object.entries(tex)) if (typeof v === 'string' && v.startsWith('#')) tex[k] = tex[v.slice(1)] ?? v
  return tex
}

const TOP = ['up', 'top', 'end', 'all', 'texture', 'cross', 'plant', 'crop', 'torch', 'lantern', 'rail', 'pane', 'wall', 'particle']
const SIDE = ['side', 'north', 'south', 'east', 'west', 'all', 'texture', 'cross', 'plant', 'crop', 'torch', 'lantern', 'rail', 'pane', 'wall', 'bars', 'front']
const BOTTOM = ['down', 'bottom', 'end', 'all', 'texture', 'cross', 'plant', 'crop', 'torch', 'lantern', 'rail', 'pane', 'wall', 'particle']

export function buildModelFaces(states: Record<string, unknown>, models: Record<string, unknown>): ModelFaces {
  const out: ModelFaces = {}
  for (const [block, state] of Object.entries(states)) {
    const model = modelOf(state)
    if (!model) continue
    const tex = resolveTextures(model, models)
    const valid = Object.fromEntries(Object.entries(tex).filter(([, v]) => typeof v === 'string' && !v.startsWith('#')))
    const first = Object.entries(valid).find(([k]) => k !== 'particle' && k !== 'overlay')?.[1] ?? valid.particle
    if (!first) continue
    const pick = (keys: string[]): string => strip(keys.map((k) => valid[k]).find(Boolean) ?? first)
    out[block] = [pick(TOP), pick(SIDE), pick(BOTTOM)]
  }
  return out
}
