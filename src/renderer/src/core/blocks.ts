// Clasificación de bloques: forma geométrica simplificada + color medio aproximado.
// BlockScene NO incluye las texturas de Minecraft (son propiedad de Mojang y no pueden redistribuirse),
// así que cada bloque se pinta con un color representativo.

export type Shape =
  | 'none'
  | 'cube'
  | 'glass'
  | 'liquid'
  | 'slab_bottom'
  | 'slab_top'
  | 'carpet'
  | 'small'
  | 'post'
  | 'stairs'
  | 'fence'
  | 'wall'
  | 'pane'
  | 'door'
  | 'trapdoor'
  | 'torch'

export interface BlockLook {
  shape: Shape
  color: [number, number, number]
  alpha: number
  emissive: boolean
  known: boolean
}

const DYES: Record<string, number> = {
  white: 0xe9ecec, orange: 0xf07613, magenta: 0xbd44b3, light_blue: 0x3aafd9, yellow: 0xf8c527, lime: 0x70b919,
  pink: 0xed8dac, gray: 0x3e4447, light_gray: 0x8e8e86, cyan: 0x158991, purple: 0x792aac, blue: 0x35399d,
  brown: 0x724728, green: 0x546d1b, red: 0xa12722, black: 0x141519
}
const TERRACOTTA: Record<string, number> = {
  white: 0xd1b2a1, orange: 0xa15325, magenta: 0x95586c, light_blue: 0x716c89, yellow: 0xba8523, lime: 0x677534,
  pink: 0xa14e4e, gray: 0x392a23, light_gray: 0x876a61, cyan: 0x575b5b, purple: 0x764656, blue: 0x4a3b5b,
  brown: 0x4d3323, green: 0x4c532a, red: 0x8f3d2e, black: 0x251610
}
const WOOD_PLANKS: Record<string, number> = {
  oak: 0xa2834f, spruce: 0x725431, birch: 0xc0af79, jungle: 0xa07351, acacia: 0xa85a32, dark_oak: 0x432b14,
  mangrove: 0x763631, cherry: 0xe2b2a9, bamboo: 0xc3ad53, crimson: 0x653147, warped: 0x2b6963, pale_oak: 0xe4d9d6
}
const WOOD_LOG: Record<string, number> = {
  oak: 0x6d5532, spruce: 0x3a2513, birch: 0xd8d7d2, jungle: 0x564419, acacia: 0x676157, dark_oak: 0x3c2e1a,
  mangrove: 0x544329, cherry: 0x371c22, crimson: 0x5c1a1e, warped: 0x3a3a4e, pale_oak: 0x5b5450
}
const LEAVES: Record<string, number> = {
  oak: 0x4a7a26, spruce: 0x3d5e3d, birch: 0x5f8a3a, jungle: 0x3f8a1c, acacia: 0x4f7a1f, dark_oak: 0x3e6b1c,
  mangrove: 0x4c7a26, cherry: 0xe5adc2, azalea: 0x5a7a2c, flowering_azalea: 0x6f7c45, pale_oak: 0xa0a69c
}

// Colores de bloques concretos (promedio aproximado de su textura)
const TABLE: Record<string, number> = {
  stone: 0x7e7e7e, granite: 0x956756, polished_granite: 0x9a6a59, diorite: 0xbcbcbc, polished_diorite: 0xc0c1c2,
  andesite: 0x888889, polished_andesite: 0x848786, cobblestone: 0x7f7f7f, mossy_cobblestone: 0x6e775f, smooth_stone: 0x9e9e9e,
  stone_bricks: 0x7a797a, mossy_stone_bricks: 0x737961, cracked_stone_bricks: 0x767676, chiseled_stone_bricks: 0x777777,
  deepslate: 0x505053, cobbled_deepslate: 0x4d4d50, polished_deepslate: 0x484849, deepslate_bricks: 0x464646, deepslate_tiles: 0x363637,
  tuff: 0x6c6d66, calcite: 0xdfe0dc, dripstone_block: 0x866b5c, bedrock: 0x555555, obsidian: 0x0f0b19, crying_obsidian: 0x200a3c,
  grass_block: 0x7cbd6b, dirt: 0x866043, coarse_dirt: 0x77553b, rooted_dirt: 0x90674c, podzol: 0x5b3f18, mycelium: 0x6f6265,
  dirt_path: 0x947a41, farmland: 0x513720, mud: 0x3c3a3d, mud_bricks: 0x89684f, packed_mud: 0x8e6b50, clay: 0xa0a6b3,
  sand: 0xdbcfa3, red_sand: 0xbe6621, gravel: 0x837f7e, sandstone: 0xd8cb9b, cut_sandstone: 0xd9ce9f, chiseled_sandstone: 0xd7ca9a,
  smooth_sandstone: 0xe0d6aa, red_sandstone: 0xb5621f, smooth_red_sandstone: 0xb5621f, cut_red_sandstone: 0xbd6520,
  bricks: 0x966153, terracotta: 0x985e43, snow_block: 0xf9fefe, snow: 0xf9fefe, ice: 0x91b7fd, packed_ice: 0x8db4fa, blue_ice: 0x74a7fd,
  water: 0x3f76e4, lava: 0xd45a12, glass: 0xc0dce4, tinted_glass: 0x2c2630, glass_pane: 0xc0dce4,
  netherrack: 0x612626, nether_bricks: 0x2c161a, red_nether_bricks: 0x450709, soul_sand: 0x513e32, soul_soil: 0x4b3a2f,
  basalt: 0x505055, polished_basalt: 0x636266, smooth_basalt: 0x48484e, blackstone: 0x2a2328, polished_blackstone: 0x353038,
  polished_blackstone_bricks: 0x302a31, gilded_blackstone: 0x382b26, magma_block: 0x8e3f1f, glowstone: 0xab8654, shroomlight: 0xf09c5a,
  end_stone: 0xdbde9e, end_stone_bricks: 0xdae0a2, purpur_block: 0xa97da9, purpur_pillar: 0xab81ab,
  quartz_block: 0xebe5de, smooth_quartz: 0xebe5de, quartz_pillar: 0xebe6e0, chiseled_quartz_block: 0xe7e2da, quartz_bricks: 0xeae5dd,
  prismarine: 0x639c97, prismarine_bricks: 0x63ab9e, dark_prismarine: 0x335b4b, sea_lantern: 0xacc7be,
  iron_block: 0xdcdcdc, gold_block: 0xf6d03d, diamond_block: 0x62ede4, emerald_block: 0x2acb57, lapis_block: 0x1f438c,
  redstone_block: 0xaf1805, coal_block: 0x101010, netherite_block: 0x423d3f, copper_block: 0xc06c50, exposed_copper: 0xa17e68,
  weathered_copper: 0x6c996e, oxidized_copper: 0x52a284, cut_copper: 0xbf6b51, amethyst_block: 0x8562bf, raw_iron_block: 0xa6876b,
  hay_block: 0xa68b0c, bookshelf: 0x75603b, crafting_table: 0x7a5a37, furnace: 0x6e6e6e, chest: 0x9c6e2b, barrel: 0x86643a,
  pumpkin: 0xc6771d, carved_pumpkin: 0xc6771d, jack_o_lantern: 0xd5932a, melon: 0x6f9123, cactus: 0x587d27, sponge: 0xc3c04b,
  tnt: 0xb34a3b, note_block: 0x593b29, jukebox: 0x5d4031, redstone_lamp: 0x5f361e, beacon: 0x75ddd7, lantern: 0x6a5b45,
  soul_lantern: 0x47626b, torch: 0xffd36a, soul_torch: 0x6ad9f0, wall_torch: 0xffd36a, end_rod: 0xe8e3dc, campfire: 0x8a5b2a,
  moss_block: 0x596e2d, moss_carpet: 0x596e2d, sculk: 0x0c1e24, honeycomb_block: 0xe5941e, slime_block: 0x6fc05b,
  bone_block: 0xe1ddc9, dried_kelp_block: 0x323b27, nether_wart_block: 0x732a2b, warped_wart_block: 0x177878,
  ochre_froglight: 0xf6e9b1, verdant_froglight: 0xe3f4d7, pearlescent_froglight: 0xf5e7ea, sea_pickle: 0x5a6129,
  scaffolding: 0xae8a50, ladder: 0x7d6037, iron_bars: 0x8a8b89, chain: 0x3c4150, lightning_rod: 0xc66d50,
  grass: 0x6a9e3c, short_grass: 0x6a9e3c, tall_grass: 0x6a9e3c, fern: 0x5a8a3c, large_fern: 0x5a8a3c, dead_bush: 0x7b5233,
  dandelion: 0xf2e037, poppy: 0xc22a1c, blue_orchid: 0x2aa9e0, allium: 0xb57fd9, azure_bluet: 0xd8dde5, red_tulip: 0xc2361f,
  orange_tulip: 0xe07a1c, white_tulip: 0xe3e8e3, pink_tulip: 0xe6a7cf, oxeye_daisy: 0xe8ebe0, cornflower: 0x4d6ad1,
  lily_of_the_valley: 0xe7e9e3, sunflower: 0xf3c21a, lilac: 0xc39ac8, rose_bush: 0xa83224, peony: 0xe6c4dc, sugar_cane: 0x94c065,
  vine: 0x3f6b1d, lily_pad: 0x2e7a26, wheat: 0xc2a64a, carrots: 0x4f8a2a, potatoes: 0x5a8a2a, sweet_berry_bush: 0x3b6a2e,
  kelp: 0x56892b, seagrass: 0x3b7a26, bamboo: 0x6b8d2b, azalea: 0x657c2f, flowering_azalea: 0x7b7a4b, glow_lichen: 0x6f8478,
  red_mushroom: 0xc72a27, brown_mushroom: 0x99714f, red_mushroom_block: 0xc72a27, brown_mushroom_block: 0x956f50, mushroom_stem: 0xcbc4b9,
  cobweb: 0xe4e8ea, fire: 0xe48a1c, flower_pot: 0x7c4434, anvil: 0x454545, cauldron: 0x3e3e3f, hopper: 0x4a4a4b,
  bell: 0xfbd34c, enchanting_table: 0x6d2f36, brewing_stand: 0x7a6852, lectern: 0xae8a50, composter: 0x75502a,
  smithing_table: 0x3a3b47, fletching_table: 0xc3ab7b, cartography_table: 0x684b2f, loom: 0x8e7a5e, stonecutter: 0x7b7672,
  grindstone: 0x8e8e8e, smoker: 0x5b5751, blast_furnace: 0x515152, rail: 0x7d6a4c, powered_rail: 0x9a7b3a,
  detector_rail: 0x7d6a5c, activator_rail: 0x7a5b4a, redstone_wire: 0xa1110b, lever: 0x6e6252, white_banner: 0xe9ecec,
  structure_block: 0x584a5b, command_block: 0xb18a6f, spawner: 0x243444, end_portal_frame: 0x5b7965, nether_portal: 0x5a15c0,
  pointed_dripstone: 0x866b5c, budding_amethyst: 0x8461bb, raw_copper_block: 0x9a6a4f, raw_gold_block: 0xdda92e,
  cherry_leaves: 0xe5adc2, mangrove_roots: 0x4a3b26, muddy_mangrove_roots: 0x463c2f, resin_block: 0xd9631c, creaking_heart: 0x4f4844
}

const EMISSIVE = new Set([
  'glowstone', 'sea_lantern', 'lantern', 'soul_lantern', 'torch', 'wall_torch', 'soul_torch', 'soul_wall_torch', 'shroomlight',
  'jack_o_lantern', 'end_rod', 'beacon', 'lava', 'fire', 'soul_fire', 'magma_block', 'ochre_froglight', 'verdant_froglight',
  'pearlescent_froglight', 'campfire', 'soul_campfire', 'redstone_torch', 'redstone_wall_torch', 'sea_pickle', 'glow_lichen',
  'crying_obsidian', 'respawn_anchor', 'candle', 'nether_portal'
])

const SMALL_PATTERNS = [
  /torch$/, /^(short_)?grass$/, /tall_grass$/, /fern$/, /_sapling$/, /dead_bush/, /flower$/, /tulip$/, /dandelion/, /poppy/,
  /orchid/, /allium/, /bluet/, /daisy/, /cornflower/, /lily_of_the_valley/, /wither_rose/, /mushroom$/, /^sunflower/, /lilac/,
  /rose_bush/, /peony/, /sugar_cane/, /^vine$/, /lily_pad/, /wheat/, /carrots/, /potatoes/, /beetroots/, /berry_bush/, /kelp/,
  /seagrass/, /^rail$/, /_rail$/, /redstone_wire/, /lever/, /_button$/, /_sign$/, /_hanging_sign$/, /tripwire/, /cobweb/, /^fire$/,
  /soul_fire/, /lichen/, /_banner$/, /flower_pot/, /potted_/, /candle/, /^chain$/, /lantern$/, /end_rod/, /lightning_rod/,
  /pointed_dripstone/, /_coral$/, /coral_fan$/, /sea_pickle/, /^bamboo$/, /pressure_plate/, /_head$/, /_skull$/, /^ladder$/,
  /nether_sprouts/, /_roots$/, /hanging_roots/, /spore_blossom/, /pink_petals/, /leaf_litter/, /wildflowers/, /bush$/, /firefly_bush/
]
const POST_PATTERNS = [/_fence$/, /_wall$/, /glass_pane$/, /^iron_bars$/, /_fence_gate$/, /_door$/, /_trapdoor$/, /scaffolding/, /_bars$/]

const DYED_ITEMS = new Set([
  'wool', 'concrete', 'carpet', 'stained_glass', 'stained_glass_pane', 'bed', 'banner', 'wall_banner', 'candle', 'shulker_box'
])

function hexToRgb(h: number): [number, number, number] {
  return [(h >> 16) & 255, (h >> 8) & 255, h & 255]
}

function parseState(state: string): { name: string; props: Record<string, string> } {
  const b = state.indexOf('[')
  let full = b < 0 ? state : state.slice(0, b)
  const props: Record<string, string> = {}
  if (b >= 0) {
    for (const kv of state.slice(b + 1, -1).split(',')) {
      const [k, v] = kv.split('=')
      if (k) props[k] = v
    }
  }
  const c = full.indexOf(':')
  if (c >= 0) full = full.slice(c + 1)
  return { name: full, props }
}

function baseColor(name: string): number | null {
  if (name in TABLE) return TABLE[name]
  for (const [dye, col] of Object.entries(DYES)) {
    if (name.startsWith(dye + '_')) {
      const rest = name.slice(dye.length + 1)
      if (rest === 'terracotta' || rest === 'glazed_terracotta') return TERRACOTTA[dye]
      if (rest.includes('concrete_powder')) return lighten(col, 0.18)
      if (DYED_ITEMS.has(rest)) return col // lana, hormigón, alfombra, cristal tintado, cama, vela, estandarte…
    }
  }
  for (const [wood, col] of Object.entries(WOOD_PLANKS)) {
    if (!name.startsWith(wood + '_')) continue
    const rest = name.slice(wood.length + 1)
    if (rest === 'log' || rest === 'wood' || rest === 'stem' || rest === 'hyphae') return WOOD_LOG[wood] ?? col
    if (rest === 'leaves') return LEAVES[wood] ?? 0x4a7a26
    if (rest.startsWith('stripped')) return col
    return col
  }
  if (name.startsWith('stripped_')) {
    const wood = name.replace('stripped_', '').replace(/_(log|wood|stem|hyphae)$/, '')
    return WOOD_PLANKS[wood] ?? 0xa2834f
  }
  if (name.endsWith('_leaves')) return LEAVES[name.replace('_leaves', '')] ?? 0x4a7a26
  // Derivados: escaleras, losas, muros… del material base
  const m = name.match(/^(.*?)(_stairs|_slab|_wall|_fence_gate|_fence|_pressure_plate|_button|_door|_trapdoor|_sign|_wall_sign|_hanging_sign)$/)
  if (m) {
    const base = m[1]
    for (const cand of [base, base + 's', base + '_block', base.replace('brick', 'bricks'), base.replace('tile', 'tiles')]) {
      const c = baseColor(cand)
      if (c != null) return c
    }
    if (WOOD_PLANKS[base] != null) return WOOD_PLANKS[base]
  }
  if (name.endsWith('_ore')) return name.startsWith('deepslate') ? 0x505053 : 0x7e7e7e
  if (name.startsWith('waxed_')) return baseColor(name.slice(6))
  if (name.startsWith('infested_')) return baseColor(name.slice(9))
  if (name.includes('copper')) return 0xc06c50
  if (name.includes('coral')) return 0xd05f8a
  if (name.startsWith('potted_')) return TABLE.flower_pot
  if (name.includes('glass')) return TABLE.glass
  if (name.includes('stone')) return TABLE.stone
  if (name.includes('brick')) return TABLE.bricks
  return null
}

function lighten(c: number, f: number): number {
  const [r, g, b] = hexToRgb(c)
  const l = (v: number): number => Math.min(255, Math.round(v + (255 - v) * f))
  return (l(r) << 16) | (l(g) << 8) | l(b)
}

const INVISIBLE = new Set(['air', 'cave_air', 'void_air', 'structure_void', 'barrier', 'light', 'moving_piston', 'piston_head', 'bubble_column'])

export function classifyBlock(state: string): BlockLook {
  const { name, props } = parseState(state)
  if (state.startsWith('legacy:')) return { shape: 'cube', color: [220, 40, 200], alpha: 1, emissive: false, known: false }
  if (INVISIBLE.has(name)) return { shape: 'none', color: [0, 0, 0], alpha: 0, emissive: false, known: true }
  const col = baseColor(name)
  const known = col != null
  const color = hexToRgb(col ?? 0xb04fb0)
  const emissive = EMISSIVE.has(name) || (name === 'redstone_lamp' && props.lit === 'true')
  if (name === 'water' || name === 'bubble_column') return { shape: 'liquid', color, alpha: 0.72, emissive: false, known }
  if (name === 'lava') return { shape: 'liquid', color, alpha: 1, emissive: true, known }
  if (name.endsWith('_slab')) {
    const t = props.type ?? 'bottom'
    return { shape: t === 'double' ? 'cube' : t === 'top' ? 'slab_top' : 'slab_bottom', color, alpha: 1, emissive, known }
  }
  if (name.endsWith('_carpet') || name === 'snow' || name === 'moss_carpet' || name.endsWith('pressure_plate') || name === 'pale_moss_carpet' || /rail$/.test(name) || name === 'redstone_wire' || name === 'lily_pad')
    return { shape: 'carpet', color, alpha: 1, emissive, known }
  if (name.endsWith('glass_pane') || name === 'iron_bars') return { shape: 'pane', color, alpha: name.includes('glass') ? 0.45 : 1, emissive, known }
  if (name.endsWith('_stairs')) return { shape: 'stairs', color, alpha: 1, emissive, known }
  if (name.endsWith('_fence') || name.endsWith('_fence_gate')) return { shape: 'fence', color, alpha: 1, emissive, known }
  if (name.endsWith('_wall') && !name.includes('wall_')) return { shape: 'wall', color, alpha: 1, emissive, known }
  if (name.endsWith('_trapdoor')) return { shape: 'trapdoor', color, alpha: 1, emissive, known }
  if (name.endsWith('_door')) return { shape: 'door', color, alpha: 1, emissive, known }
  if (/(^|_)torch$/.test(name)) return { shape: 'torch', color, alpha: 1, emissive, known }
  if (POST_PATTERNS.some((r) => r.test(name))) return { shape: 'post', color, alpha: 1, emissive, known }
  if (SMALL_PATTERNS.some((r) => r.test(name))) return { shape: 'small', color, alpha: 1, emissive, known }
  if (name.includes('glass') || name === 'ice' || name === 'slime_block' || name === 'honey_block')
    return { shape: 'glass', color, alpha: name === 'tinted_glass' ? 0.8 : name.includes('stained') ? 0.6 : 0.35, emissive, known }
  return { shape: 'cube', color, alpha: 1, emissive, known }
}
