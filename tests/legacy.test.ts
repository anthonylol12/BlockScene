import { describe, expect, it } from 'vitest'
import { legacyToModern } from '../src/renderer/src/core/legacyIds'
import { inheritUpperDoors } from '../src/renderer/src/core/formats'

describe('IDs antiguos (.schematic)', () => {
  it('conserva la orientación de las escaleras', () => {
    expect(legacyToModern(53, 0)).toBe('minecraft:oak_stairs[facing=east,half=bottom]')
    expect(legacyToModern(109, 3 | 4)).toBe('minecraft:stone_brick_stairs[facing=north,half=top]')
  })
  it('troncos tumbados y solo corteza', () => {
    expect(legacyToModern(17, 1 | (1 << 2))).toBe('minecraft:spruce_log[axis=x]')
    expect(legacyToModern(162, 1 | (2 << 2))).toBe('minecraft:dark_oak_log[axis=z]')
    expect(legacyToModern(17, 2 | (3 << 2))).toBe('minecraft:birch_wood[axis=y]')
  })
  it('bloques que antes salían en magenta', () => {
    expect(legacyToModern(235, 0)).toBe('minecraft:white_glazed_terracotta')
    expect(legacyToModern(250, 0)).toBe('minecraft:black_glazed_terracotta')
    expect(legacyToModern(229, 0)).toBe('minecraft:purple_shulker_box')
    expect(legacyToModern(34, 0)).toBe('minecraft:piston_head')
    expect(legacyToModern(93, 0)).toBe('minecraft:repeater')
  })
  it('antorchas de pared y columnas', () => {
    expect(legacyToModern(50, 3)).toBe('minecraft:wall_torch[facing=south]')
    expect(legacyToModern(50, 5)).toBe('minecraft:torch')
    expect(legacyToModern(76, 1)).toBe('minecraft:redstone_wall_torch[facing=east]')
    expect(legacyToModern(155, 3)).toBe('minecraft:quartz_pillar[axis=x]')
    expect(legacyToModern(170, 4)).toBe('minecraft:hay_block[axis=x]')
  })
  it('la mitad superior de la puerta hereda la orientación de la inferior', () => {
    const palette = ['minecraft:air', legacyToModern(64, 1)!, legacyToModern(64, 8)!]
    const data = new Uint16Array([1, 2]) // 1×2×1: abajo la mitad inferior, arriba la superior
    inheritUpperDoors(1, 1, data, palette)
    expect(palette[data[1]]).toBe('minecraft:oak_door[facing=south,half=upper,open=false]')
  })
})
