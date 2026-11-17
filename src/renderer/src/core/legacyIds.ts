// Tabla de IDs numéricos anteriores a 1.13 (formato MCEdit/.schematic) → nombre moderno aproximado.
// Cubre los bloques más habituales; los IDs no cubiertos se marcan como "legacy:<id>" y se informan.

const COLORS = [
  'white', 'orange', 'magenta', 'light_blue', 'yellow', 'lime', 'pink', 'gray',
  'light_gray', 'cyan', 'purple', 'blue', 'brown', 'green', 'red', 'black'
]
const WOODS = ['oak', 'spruce', 'birch', 'jungle', 'acacia', 'dark_oak']
const STONES = ['stone', 'granite', 'polished_granite', 'diorite', 'polished_diorite', 'andesite', 'polished_andesite']
const SLABS = ['smooth_stone_slab', 'sandstone_slab', 'petrified_oak_slab', 'cobblestone_slab', 'brick_slab', 'stone_brick_slab', 'nether_brick_slab', 'quartz_slab']

const BASE: Record<number, string> = {
  0: 'air', 2: 'grass_block', 3: 'dirt', 4: 'cobblestone', 7: 'bedrock', 8: 'water', 9: 'water', 10: 'lava', 11: 'lava',
  12: 'sand', 13: 'gravel', 14: 'gold_ore', 15: 'iron_ore', 16: 'coal_ore', 19: 'sponge', 20: 'glass', 21: 'lapis_ore',
  22: 'lapis_block', 23: 'dispenser', 24: 'sandstone', 25: 'note_block', 26: 'red_bed', 27: 'powered_rail', 28: 'detector_rail',
  29: 'sticky_piston', 30: 'cobweb', 31: 'grass', 32: 'dead_bush', 33: 'piston', 37: 'dandelion', 38: 'poppy',
  39: 'brown_mushroom', 40: 'red_mushroom', 41: 'gold_block', 42: 'iron_block', 45: 'bricks', 46: 'tnt', 47: 'bookshelf',
  48: 'mossy_cobblestone', 49: 'obsidian', 50: 'torch', 51: 'fire', 52: 'spawner', 53: 'oak_stairs', 54: 'chest',
  55: 'redstone_wire', 56: 'diamond_ore', 57: 'diamond_block', 58: 'crafting_table', 59: 'wheat', 60: 'farmland',
  61: 'furnace', 62: 'furnace', 63: 'oak_sign', 64: 'oak_door', 65: 'ladder', 66: 'rail', 67: 'cobblestone_stairs',
  68: 'oak_wall_sign', 69: 'lever', 70: 'stone_pressure_plate', 71: 'iron_door', 72: 'oak_pressure_plate', 73: 'redstone_ore',
  74: 'redstone_ore', 75: 'redstone_torch', 76: 'redstone_torch', 77: 'stone_button', 78: 'snow', 79: 'ice', 80: 'snow_block',
  81: 'cactus', 82: 'clay', 83: 'sugar_cane', 84: 'jukebox', 85: 'oak_fence', 86: 'pumpkin', 87: 'netherrack', 88: 'soul_sand',
  89: 'glowstone', 90: 'nether_portal', 91: 'jack_o_lantern', 92: 'cake', 96: 'oak_trapdoor', 97: 'infested_stone',
  98: 'stone_bricks', 99: 'brown_mushroom_block', 100: 'red_mushroom_block', 101: 'iron_bars', 102: 'glass_pane',
  103: 'melon', 104: 'pumpkin_stem', 105: 'melon_stem', 106: 'vine', 107: 'oak_fence_gate', 108: 'brick_stairs',
  109: 'stone_brick_stairs', 110: 'mycelium', 111: 'lily_pad', 112: 'nether_bricks', 113: 'nether_brick_fence',
  114: 'nether_brick_stairs', 115: 'nether_wart', 116: 'enchanting_table', 117: 'brewing_stand', 118: 'cauldron',
  119: 'end_portal', 120: 'end_portal_frame', 121: 'end_stone', 122: 'dragon_egg', 123: 'redstone_lamp', 124: 'redstone_lamp',
  127: 'cocoa', 128: 'sandstone_stairs', 129: 'emerald_ore', 130: 'ender_chest', 131: 'tripwire_hook', 132: 'tripwire',
  133: 'emerald_block', 134: 'spruce_stairs', 135: 'birch_stairs', 136: 'jungle_stairs', 137: 'command_block', 138: 'beacon',
  139: 'cobblestone_wall', 140: 'flower_pot', 141: 'carrots', 142: 'potatoes', 143: 'oak_button', 144: 'skeleton_skull',
  145: 'anvil', 146: 'trapped_chest', 147: 'light_weighted_pressure_plate', 148: 'heavy_weighted_pressure_plate',
  151: 'daylight_detector', 152: 'redstone_block', 153: 'nether_quartz_ore', 154: 'hopper', 155: 'quartz_block',
  156: 'quartz_stairs', 157: 'activator_rail', 158: 'dropper', 160: 'white_stained_glass_pane', 163: 'acacia_stairs',
  164: 'dark_oak_stairs', 165: 'slime_block', 166: 'barrier', 167: 'iron_trapdoor', 168: 'prismarine', 169: 'sea_lantern',
  170: 'hay_block', 172: 'terracotta', 173: 'coal_block', 174: 'packed_ice', 175: 'sunflower', 176: 'white_banner',
  178: 'daylight_detector', 179: 'red_sandstone', 180: 'red_sandstone_stairs', 181: 'red_sandstone_slab', 182: 'red_sandstone_slab',
  183: 'spruce_fence_gate', 184: 'birch_fence_gate', 185: 'jungle_fence_gate', 186: 'dark_oak_fence_gate', 187: 'acacia_fence_gate',
  188: 'spruce_fence', 189: 'birch_fence', 190: 'jungle_fence', 191: 'dark_oak_fence', 192: 'acacia_fence', 193: 'spruce_door',
  194: 'birch_door', 195: 'jungle_door', 196: 'acacia_door', 197: 'dark_oak_door', 198: 'end_rod', 199: 'chorus_plant',
  200: 'chorus_flower', 201: 'purpur_block', 202: 'purpur_pillar', 203: 'purpur_stairs', 204: 'purpur_slab', 205: 'purpur_slab',
  206: 'end_stone_bricks', 207: 'beetroots', 208: 'dirt_path', 209: 'end_gateway', 210: 'repeating_command_block',
  211: 'chain_command_block', 212: 'frosted_ice', 213: 'magma_block', 214: 'nether_wart_block', 215: 'red_nether_bricks',
  216: 'bone_block', 217: 'structure_void', 218: 'observer', 255: 'structure_block',
  34: 'piston_head', 36: 'air', 93: 'repeater', 94: 'repeater', 149: 'comparator', 150: 'comparator', 177: 'white_wall_banner',
  253: 'air'
}

const STAIRS = new Set([53, 67, 108, 109, 114, 128, 134, 135, 136, 156, 163, 164, 180, 203])
const DOORS = new Set([64, 71, 193, 194, 195, 196, 197])
const AXIS = ['y', 'x', 'z'] as const
/** orientación de los bloques con "facing" numérico 2-5 (cofres, hornos, escaleras de mano…) */
const FACING_2_5: Record<number, string> = { 2: 'north', 3: 'south', 4: 'west', 5: 'east' }

/** Propiedades de orientación del ID numérico, para que escaleras, troncos, puertas… no salgan todos iguales. */
function legacyProps(id: number, d: number): string {
  if (STAIRS.has(id)) return `[facing=${['east', 'west', 'south', 'north'][d & 3]},half=${d & 4 ? 'top' : 'bottom'}]`
  if (DOORS.has(id)) return d & 8 ? '[half=upper]' : `[facing=${['east', 'south', 'west', 'north'][d & 3]},half=lower,open=${d & 4 ? 'true' : 'false'}]`
  if (id === 96 || id === 167) return `[facing=${['south', 'north', 'east', 'west'][d & 3]},half=${d & 8 ? 'top' : 'bottom'},open=${d & 4 ? 'true' : 'false'}]`
  if (id >= 183 && id <= 187 || id === 107) return `[facing=${['south', 'west', 'north', 'east'][d & 3]},open=${d & 4 ? 'true' : 'false'}]`
  if (id === 170 || id === 216 || id === 202) return `[axis=${AXIS[(d >> 2) & 3] ?? 'y'}]`
  if ([23, 54, 61, 62, 65, 130, 146, 158].includes(id) && FACING_2_5[d & 7]) return `[facing=${FACING_2_5[d & 7]}]`
  if (id === 78) return `[layers=${(d & 7) + 1}]`
  return ''
}

/** Devuelve el estado de bloque moderno ("minecraft:x[props]") o null si el ID no está en la tabla. */
export function legacyToModern(id: number, data: number): string | null {
  const d = data & 15
  let name: string | undefined
  let props = ''
  switch (id) {
    case 1: name = STONES[d] ?? 'stone'; break
    case 5: name = `${WOODS[d] ?? 'oak'}_planks`; break
    case 6: name = `${WOODS[d & 7] ?? 'oak'}_sapling`; break
    case 17:
    case 162: {
      // bits 2-3: eje del tronco (0 vertical, 1 este-oeste, 2 norte-sur, 3 solo corteza)
      const wood = id === 17 ? WOODS[d & 3] : WOODS[4 + (d & 1)]
      const ax = (d >> 2) & 3
      name = ax === 3 ? `${wood}_wood` : `${wood}_log`
      props = `[axis=${AXIS[ax === 3 ? 0 : ax]}]`
      break
    }
    case 155: {
      name = ['quartz_block', 'chiseled_quartz_block', 'quartz_pillar', 'quartz_pillar', 'quartz_pillar'][d] ?? 'quartz_block'
      if (d >= 2 && d <= 4) props = `[axis=${['y', 'x', 'z'][d - 2]}]`
      break
    }
    case 181: name = 'red_sandstone'; break
    case 219: case 220: case 221: case 222: case 223: case 224: case 225: case 226:
    case 227: case 228: case 229: case 230: case 231: case 232: case 233: case 234:
      name = `${COLORS[id - 219]}_shulker_box`; break
    case 235: case 236: case 237: case 238: case 239: case 240: case 241: case 242:
    case 243: case 244: case 245: case 246: case 247: case 248: case 249: case 250:
      name = `${COLORS[id - 235]}_glazed_terracotta`; break
    case 50: case 75: case 76: {
      const base = id === 50 ? 'torch' : 'redstone_torch'
      const f = ({ 1: 'east', 2: 'west', 3: 'south', 4: 'north' } as Record<number, string>)[d & 7]
      name = f ? base.replace('torch', 'wall_torch') : base
      if (f) props = `[facing=${f}]`
      break
    }
    case 18: name = `${WOODS[d & 3]}_leaves`; break
    case 161: name = `${WOODS[4 + (d & 1)]}_leaves`; break
    case 35: name = `${COLORS[d]}_wool`; break
    case 95: name = `${COLORS[d]}_stained_glass`; break
    case 159: name = `${COLORS[d]}_terracotta`; break
    case 160: name = `${COLORS[d]}_stained_glass_pane`; break
    case 171: name = `${COLORS[d]}_carpet`; break
    case 251: name = `${COLORS[d]}_concrete`; break
    case 252: name = `${COLORS[d]}_concrete_powder`; break
    case 43: name = ['smooth_stone', 'sandstone', 'oak_planks', 'cobblestone', 'bricks', 'stone_bricks', 'nether_bricks', 'quartz_block'][d & 7]; break
    case 44: name = SLABS[d & 7]; props = d & 8 ? '[type=top]' : '[type=bottom]'; break
    case 125: name = `${WOODS[d & 7] ?? 'oak'}_planks`; break
    case 126: name = `${WOODS[d & 7] ?? 'oak'}_slab`; props = d & 8 ? '[type=top]' : '[type=bottom]'; break
    case 98: name = ['stone_bricks', 'mossy_stone_bricks', 'cracked_stone_bricks', 'chiseled_stone_bricks'][d & 3]; break
    case 24: name = ['sandstone', 'chiseled_sandstone', 'cut_sandstone'][d % 3]; break
    case 168: name = ['prismarine', 'prismarine_bricks', 'dark_prismarine'][d % 3]; break
    case 12: name = d === 1 ? 'red_sand' : 'sand'; break
    case 3: name = ['dirt', 'coarse_dirt', 'podzol'][d % 3]; break
    case 38: name = ['poppy', 'blue_orchid', 'allium', 'azure_bluet', 'red_tulip', 'orange_tulip', 'white_tulip', 'pink_tulip', 'oxeye_daisy'][d] ?? 'poppy'; break
    case 31: name = d === 2 ? 'fern' : 'grass'; break
    case 175: name = ['sunflower', 'lilac', 'tall_grass', 'large_fern', 'rose_bush', 'peony'][d & 7] ?? 'tall_grass'; break
    case 139: name = d === 1 ? 'mossy_cobblestone_wall' : 'cobblestone_wall'; break
    default:
      name = BASE[id]
      props = legacyProps(id, d)
  }
  if (!name) return null
  return `minecraft:${name}${props}`
}
