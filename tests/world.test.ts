import { describe, expect, it } from 'vitest'
import { compress, writeNbt } from '../src/renderer/src/core/nbt'
import { parseBuildFile, stateString } from '../src/renderer/src/core/formats'
import { areaBounds, parseLevelDat, regionsForArea, writeSchem } from '../src/renderer/src/core/world'

describe('Mundos de Minecraft', () => {
  it('lee nombre, versión y aparición de level.dat (formato clásico)', async () => {
    const dat = await compress(writeNbt('', {
      Data: { t: 'compound', v: {
        LevelName: { t: 'string', v: 'Mi mundo' }, SpawnX: { t: 'int', v: 120 }, SpawnY: { t: 'int', v: 70 }, SpawnZ: { t: 'int', v: -40 },
        DataVersion: { t: 'int', v: 3955 }, Version: { t: 'compound', v: { Name: { t: 'string', v: '1.21.1' } } }
      } }
    }))
    expect(await parseLevelDat(dat)).toEqual({ name: 'Mi mundo', version: '1.21.1', dataVersion: 3955, spawn: { x: 120, y: 70, z: -40 } })
  })

  it('lee la aparición del formato 1.21.9+ (compuesto "spawn")', async () => {
    const dat = await compress(writeNbt('', {
      Data: { t: 'compound', v: { LevelName: { t: 'string', v: 'Nuevo' }, spawn: { t: 'compound', v: { pos: { t: 'intArray', v: [5, 80, -9] } } } } }
    }))
    expect((await parseLevelDat(dat)).spawn).toEqual({ x: 5, y: 80, z: -9 })
  })

  it('calcula los archivos de región de un área, también con coordenadas negativas', () => {
    expect(regionsForArea({ cx: 0, cz: 0, radius: 64, yMin: 0, yMax: 100 }).map((r) => r.file).sort()).toEqual(['r.-1.-1.mca', 'r.-1.0.mca', 'r.0.-1.mca', 'r.0.0.mca'])
    expect(regionsForArea({ cx: 256, cz: 256, radius: 32, yMin: 0, yMax: 100 }).map((r) => r.file)).toEqual(['r.0.0.mca'])
    expect(areaBounds({ cx: 10, cz: -10, radius: 32, yMin: 90, yMax: 40 })).toEqual({ x0: -22, x1: 41, z0: -42, z1: 21, y0: 40, y1: 90 })
  })

  it('entiende la paleta de bloques de las snapshots 26.4 y la clásica', () => {
    expect(stateString({ '': 'minecraft:stone' })).toBe('minecraft:stone')
    expect(stateString({ id: 'minecraft:oak_leaves', properties: { persistent: 'false', distance: '3' } })).toBe('minecraft:oak_leaves[distance=3,persistent=false]')
    expect(stateString({ Name: 'minecraft:oak_log', Properties: { axis: 'x' } })).toBe('minecraft:oak_log[axis=x]')
  })

  it('el .schem escrito se vuelve a leer igual', async () => {
    const palette = ['minecraft:air', 'minecraft:stone', 'minecraft:oak_stairs[facing=east,half=bottom]']
    // paleta grande para forzar varints de 2 bytes
    for (let i = 0; i < 200; i++) palette.push(`minecraft:test_${i}`)
    const data = new Uint16Array(4 * 3 * 2)
    data.forEach((_, i) => { data[i] = i % 3 === 0 ? 0 : i % 2 ? 1 : 201 })
    data[5] = 2
    const bytes = await writeSchem({ sx: 4, sy: 3, sz: 2, data, palette }, { name: 'Zona', dataVersion: 3955 })
    const { model, info } = await parseBuildFile('zona.schem', bytes)
    expect([model.sx, model.sy, model.sz]).toEqual([4, 3, 2])
    for (let i = 0; i < data.length; i++) expect(model.palette[model.data[i]]).toBe(palette[data[i]])
    expect(info.name).toBe('Zona')
  })
})
