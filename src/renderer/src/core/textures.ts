// Resolución de texturas: estado de bloque → textura de cada cara (arriba / lado / abajo) + tinte de bioma.
// Los nombres corresponden a assets/minecraft/textures/block/*.png de la copia de Minecraft del usuario.

export interface FaceTiles {
  top: number
  side: number
  bottom: number
  /** color multiplicador (tinte de bioma) o null */
  tint: [number, number, number] | null
  /** el tinte solo se aplica a la cara superior (bloque de hierba) */
  tintTopOnly?: boolean
}

const UNTINTED_LEAVES = new Set(['cherry_leaves', 'azalea_leaves', 'flowering_azalea_leaves', 'pale_oak_leaves'])
function tintFor(n: string): [number, number, number] | null {
  if (TINTS[n]) return TINTS[n]
  if (n.endsWith('_leaves') && !UNTINTED_LEAVES.has(n)) return FOLIAGE
  return null
}

/**
 * Resolución principal: primero los modelos del juego (blockstates + models), después la heurística por nombre.
 * `modelFaces[nombre] = [arriba, lado, abajo]` (nombres de textures/block).
 */
export function resolveBlock(state: string, has: (name: string) => number, modelFaces?: Record<string, [string, string, string]>): FaceTiles | null {
  let n = baseName(state)
  if (n.startsWith('waxed_') && !modelFaces?.[n]) n = n.slice(6)
  const mf = modelFaces?.[n]
  const side = mf ? has(mf[1]) : 0
  if (mf && side) {
    return { top: has(mf[0]) || side, side, bottom: has(mf[2]) || side, tint: tintFor(n), tintTopOnly: n === 'grass_block' }
  }
  const h = resolveFaces(state, has)
  return h ? { ...h, tint: h.tint ?? tintFor(n), tintTopOnly: n === 'grass_block' } : null
}

const hex = (h: number): [number, number, number] => [(h >> 16) & 255, (h >> 8) & 255, h & 255]
const GRASS = hex(0x79c05a)
const FOLIAGE = hex(0x59ae30)
export const TINTS: Record<string, [number, number, number]> = {
  grass_block: GRASS, short_grass: GRASS, grass: GRASS, tall_grass: GRASS, fern: GRASS, large_fern: GRASS, sugar_cane: hex(0x91bd59),
  oak_leaves: FOLIAGE, jungle_leaves: FOLIAGE, acacia_leaves: FOLIAGE, dark_oak_leaves: FOLIAGE, mangrove_leaves: hex(0x8db127),
  spruce_leaves: hex(0x619961), birch_leaves: hex(0x80a755), vine: FOLIAGE, lily_pad: hex(0x208030), water: hex(0x3f76e4), bubble_column: hex(0x3f76e4)
}

/** Texturas que se sustituyen por otro nombre */
const ALIAS: Record<string, string> = {
  water: 'water_still', lava: 'lava_still', grass: 'short_grass', bubble_column: 'water_still', snow: 'snow',
  petrified_oak: 'oak_planks', smooth_quartz: 'quartz_block_bottom', smooth_sandstone: 'sandstone_top',
  smooth_red_sandstone: 'red_sandstone_top', quartz: 'quartz_block', nether_brick: 'nether_bricks', red_nether_brick: 'red_nether_bricks',
  stone_brick: 'stone_bricks', mossy_stone_brick: 'mossy_stone_bricks', end_stone_brick: 'end_stone_bricks', purpur: 'purpur_block',
  prismarine_brick: 'prismarine_bricks', deepslate_brick: 'deepslate_bricks', deepslate_tile: 'deepslate_tiles', mud_brick: 'mud_bricks',
  polished_blackstone_brick: 'polished_blackstone_bricks', brick: 'bricks', tuff_brick: 'tuff_bricks', resin_brick: 'resin_bricks',
  moss_carpet: 'moss_block', pale_moss_carpet: 'pale_moss_block', chest: 'oak_planks', trapped_chest: 'oak_planks', ender_chest: 'obsidian',
  wall_torch: 'torch', soul_wall_torch: 'soul_torch', redstone_wall_torch: 'redstone_torch', oak_wall_sign: 'oak_planks',
  bamboo_block: 'bamboo_block', cut_copper: 'cut_copper', dirt_path: 'dirt_path', farmland: 'farmland', infested_stone: 'stone'
}

const SUFFIXES = ['_stairs', '_slab', '_wall', '_fence_gate', '_fence', '_pressure_plate', '_button', '_wall_sign', '_hanging_sign', '_sign', '_carpet']
const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak', 'mangrove', 'cherry', 'bamboo', 'crimson', 'warped', 'pale_oak']

function baseName(state: string): string {
  let n = state.split('[')[0]
  const c = n.indexOf(':')
  if (c >= 0) n = n.slice(c + 1)
  return n
}

export function resolveFaces(state: string, has: (name: string) => number): FaceTiles | null {
  let n = baseName(state)
  if (n.startsWith('waxed_')) n = n.slice(6)
  const tint = TINTS[n] ?? null
  const pick = (...c: string[]): number => {
    for (const x of c) {
      const i = has(x)
      if (i > 0) return i
    }
    return 0
  }
  const triple = (b: string): FaceTiles | null => {
    const side = pick(`${b}_side`, b, `${b}_front`, `${b}_bottom`)
    if (!side) return null
    return { side, top: pick(`${b}_top`, b, `${b}_side`) || side, bottom: pick(`${b}_bottom`, `${b}_top`, b) || side, tint }
  }
  if (ALIAS[n]) {
    const r = triple(ALIAS[n])
    if (r) return { ...r, tint }
  }
  // troncos / madera / tallos
  for (const w of WOODS) {
    for (const kind of ['log', 'wood', 'stem', 'hyphae']) {
      for (const pre of ['', 'stripped_']) {
        if (n !== `${pre}${w}_${kind}`) continue
        const logName = `${pre}${w}_${kind === 'wood' ? 'log' : kind === 'hyphae' ? 'stem' : kind}`
        const side = pick(logName)
        if (side) return { side, top: kind === 'wood' || kind === 'hyphae' ? side : pick(`${logName}_top`) || side, bottom: kind === 'wood' || kind === 'hyphae' ? side : pick(`${logName}_top`) || side, tint: null }
      }
    }
  }
  if (n === 'bookshelf') return { side: pick('bookshelf'), top: pick('oak_planks'), bottom: pick('oak_planks'), tint: null }
  if (n.endsWith('_door')) {
    const s = pick(`${n}_bottom`, `${n}_top`)
    // "top" guarda la textura de la mitad superior; el generador de malla la usa para half=upper
    if (s) return { side: s, top: pick(`${n}_top`) || s, bottom: s, tint: null }
  }
  if (n.endsWith('glass_pane')) {
    const r = triple(n.replace('_pane', ''))
    if (r) return r
  }
  if (n.endsWith('_slab') && has(`${n}_side`)) {
    const top = pick(n.slice(0, -5), `${n.slice(0, -5)}_top`)
    return { side: has(`${n}_side`), top: top || has(`${n}_side`), bottom: top || has(`${n}_side`), tint }
  }
  const direct = triple(n)
  if (direct) return direct
  // derivados: escaleras, losas, muros… → material base
  for (const suf of SUFFIXES) {
    if (!n.endsWith(suf)) continue
    let b = n.slice(0, -suf.length)
    if (suf === '_carpet') b = `${b}_wool`
    if (suf === '_slab' && has(`${n}_side`)) return { side: has(`${n}_side`), top: pick(b, `${b}_top`), bottom: pick(b, `${b}_top`), tint }
    for (const cand of [ALIAS[b], b, `${b}s`, `${b}_planks`, `${b}_block`, b.replace(/brick$/, 'bricks'), b.replace(/tile$/, 'tiles')]) {
      if (!cand) continue
      const r = triple(cand)
      if (r) return { ...r, tint: TINTS[cand] ?? tint }
    }
  }
  // plantas altas: usar la mitad inferior
  const tall = pick(`${n}_bottom`, `${n}_front`, `${n}_stage3`, `${n}_stage7`, `${n}_stage_3`)
  if (tall) return { side: tall, top: tall, bottom: tall, tint }
  if (n.startsWith('potted_')) {
    const p = pick(n.slice(7))
    if (p) return { side: p, top: p, bottom: p, tint: null }
  }
  return null
}
