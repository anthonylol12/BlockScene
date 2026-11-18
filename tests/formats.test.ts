import { describe, expect, it } from 'vitest'
import { compress, writeNbt, type WTag } from '../src/renderer/src/core/nbt'
import { parseBuildFile, minecraftVersionFor } from '../src/renderer/src/core/formats'
import { buildMesh } from '../src/renderer/src/core/mesher'
import { generateDemoSchem } from '../src/renderer/src/core/demo'
import { classifyBlock } from '../src/renderer/src/core/blocks'

const varints = (vals: number[]): Uint8Array => {
  const out: number[] = []
  for (let v of vals) {
    while (v & ~0x7f) {
      out.push((v & 0x7f) | 0x80)
      v >>>= 7
    }
    out.push(v)
  }
  return Uint8Array.from(out)
}

/** Empaqueta valores en un long array estilo Litematica (los valores pueden cruzar longs). */
function packSpanning(vals: number[], bits: number): bigint[] {
  const total = vals.length * bits
  const longs = new Array<bigint>(Math.ceil(total / 64)).fill(0n)
  vals.forEach((v, i) => {
    for (let b = 0; b < bits; b++) {
      if ((v >> b) & 1) {
        const bit = i * bits + b
        longs[bit >> 6] |= 1n << BigInt(bit & 63)
      }
    }
  })
  return longs.map((l) => BigInt.asIntN(64, l))
}

describe('Sponge .schem', () => {
  it('lee v2 comprimido con gzip y cuenta los bloques reales', async () => {
    // 2×2×2: un bloque de piedra y uno de cristal
    const data = [1, 0, 0, 0, 0, 0, 0, 2]
    const file = writeNbt('Schematic', {
      Version: { t: 'int', v: 2 },
      DataVersion: { t: 'int', v: 3465 },
      Width: { t: 'short', v: 2 },
      Height: { t: 'short', v: 2 },
      Length: { t: 'short', v: 2 },
      Palette: { t: 'compound', v: { 'minecraft:air': { t: 'int', v: 0 }, 'minecraft:stone': { t: 'int', v: 1 }, 'minecraft:glass': { t: 'int', v: 2 } } },
      BlockData: { t: 'byteArray', v: varints(data) }
    })
    const gz = await compress(file)
    const { model, info } = await parseBuildFile('casa.schem', gz)
    expect([info.width, info.height, info.length]).toEqual([2, 2, 2])
    expect(info.blockCount).toBe(2)
    expect(info.format).toBe('sponge')
    expect(info.minecraftVersion).toBe('1.20.1')
    expect(model.palette[model.data[7]]).toBe('minecraft:glass')
  })

  it('lee v3 (Blocks anidado) con varints de varios bytes', async () => {
    const pal: Record<string, WTag> = { 'minecraft:air': { t: 'int', v: 0 } }
    for (let i = 1; i < 200; i++) pal[`minecraft:block_${i}`] = { t: 'int', v: i }
    const file = writeNbt('', {
      Schematic: {
        t: 'compound',
        v: {
          Version: { t: 'int', v: 3 },
          DataVersion: { t: 'int', v: 3955 },
          Width: { t: 'short', v: 3 },
          Height: { t: 'short', v: 1 },
          Length: { t: 'short', v: 1 },
          Blocks: { t: 'compound', v: { Palette: { t: 'compound', v: pal }, Data: { t: 'byteArray', v: varints([199, 0, 150]) } } }
        }
      }
    })
    const { model, info } = await parseBuildFile('x.schem', file)
    expect(info.formatLabel).toContain('v3')
    expect(model.palette[model.data[0]]).toBe('minecraft:block_199')
    expect(model.palette[model.data[2]]).toBe('minecraft:block_150')
    expect(info.blockCount).toBe(2)
  })
})

describe('MCEdit .schematic', () => {
  it('traduce IDs antiguos y marca los desconocidos', async () => {
    const file = writeNbt('Schematic', {
      Width: { t: 'short', v: 3 },
      Height: { t: 'short', v: 1 },
      Length: { t: 'short', v: 1 },
      Materials: { t: 'string', v: 'Alpha' },
      Blocks: { t: 'byteArray', v: Uint8Array.from([35, 1, 254]) },
      Data: { t: 'byteArray', v: Uint8Array.from([14, 3, 0]) }
    })
    const { model, info } = await parseBuildFile('viejo.schematic', file)
    expect(model.palette[model.data[0]]).toBe('minecraft:red_wool')
    expect(model.palette[model.data[1]]).toBe('minecraft:diorite')
    expect(model.palette[model.data[2]]).toBe('legacy:254')
    expect(info.warnings.join(' ')).toContain('254')
    expect(info.blockCount).toBe(3)
  })
})

describe('Litematica', () => {
  it('desempaqueta BlockStates que cruzan longs y combina regiones', async () => {
    // Región A: 3×2×2 con 3 estados → bits = 2
    const vals = [1, 2, 1, 0, 0, 0, 2, 2, 2, 1, 0, 1]
    const regionA = {
      t: 'compound',
      v: {
        Position: { t: 'compound', v: { x: { t: 'int', v: 0 }, y: { t: 'int', v: 0 }, z: { t: 'int', v: 0 } } },
        Size: { t: 'compound', v: { x: { t: 'int', v: 3 }, y: { t: 'int', v: 2 }, z: { t: 'int', v: 2 } } },
        BlockStatePalette: {
          t: 'list', et: 'compound',
          v: [
            { t: 'compound', v: { Name: { t: 'string', v: 'minecraft:air' } } },
            { t: 'compound', v: { Name: { t: 'string', v: 'minecraft:stone' } } },
            { t: 'compound', v: { Name: { t: 'string', v: 'minecraft:oak_slab' }, Properties: { t: 'compound', v: { type: { t: 'string', v: 'top' } } } } }
          ]
        },
        BlockStates: { t: 'longArray', v: packSpanning(vals, 2) }
      }
    } as WTag
    // Región B con tamaño negativo: 5 estados → bits = 3, 22 valores → cruza el límite de 64 bits
    const valsB = Array.from({ length: 22 }, (_, i) => (i % 5))
    const pal5 = ['air', 'dirt', 'sand', 'gravel', 'clay'].map((n) => ({ t: 'compound', v: { Name: { t: 'string', v: `minecraft:${n}` } } }) as WTag)
    const regionB = {
      t: 'compound',
      v: {
        Position: { t: 'compound', v: { x: { t: 'int', v: 10 }, y: { t: 'int', v: 0 }, z: { t: 'int', v: 5 } } },
        Size: { t: 'compound', v: { x: { t: 'int', v: -22 }, y: { t: 'int', v: 1 }, z: { t: 'int', v: 1 } } },
        BlockStatePalette: { t: 'list', et: 'compound', v: pal5 },
        BlockStates: { t: 'longArray', v: packSpanning(valsB, 3) }
      }
    } as WTag
    const file = writeNbt('', {
      Version: { t: 'int', v: 6 },
      MinecraftDataVersion: { t: 'int', v: 3700 },
      Metadata: { t: 'compound', v: { Name: { t: 'string', v: 'Prueba' }, Author: { t: 'string', v: 'Tester' } } },
      Regions: { t: 'compound', v: { A: regionA, B: regionB } }
    })
    const { model, info } = await parseBuildFile('p.litematic', await compress(file))
    expect(info.regions).toBe(2)
    expect(info.author).toBe('Tester')
    // B va de x=-11 a x=10 → caja global x ∈ [-11, 10] → ancho 22
    expect(info.width).toBe(22)
    const minX = -11
    const at = (x: number, y: number, z: number): string => model.palette[model.data[(y * model.sz + z) * model.sx + (x - minX)]]
    expect(at(0, 0, 0)).toBe('minecraft:stone')
    expect(at(1, 0, 0)).toBe('minecraft:oak_slab[type=top]')
    expect(at(0, 1, 1)).toBe('minecraft:stone') // vals[9]
    expect(at(2, 1, 0)).toBe('minecraft:oak_slab[type=top]') // vals[8]
    expect(at(-11 + 21, 0, 5)).toBe('minecraft:dirt') // valsB[21] = 1
    expect(at(-11, 0, 5)).toBe('minecraft:air') // valsB[0] = 0
    expect(at(-10, 0, 5)).toBe('minecraft:dirt')
    expect(at(-8, 0, 5)).toBe('minecraft:gravel')
    const expectedB = valsB.filter((v) => v !== 0).length
    const expectedA = vals.filter((v) => v !== 0).length
    expect(info.blockCount).toBe(expectedA + expectedB)
    expect(info.length).toBe(6)
  })
})

describe('Estructura .nbt', () => {
  it('lee size, palette y blocks', async () => {
    const file = writeNbt('', {
      DataVersion: { t: 'int', v: 3955 },
      size: { t: 'list', et: 'int', v: [{ t: 'int', v: 2 }, { t: 'int', v: 1 }, { t: 'int', v: 1 }] },
      palette: { t: 'list', et: 'compound', v: [{ t: 'compound', v: { Name: { t: 'string', v: 'minecraft:bricks' } } }] },
      blocks: {
        t: 'list', et: 'compound',
        v: [{ t: 'compound', v: { pos: { t: 'list', et: 'int', v: [{ t: 'int', v: 1 }, { t: 'int', v: 0 }, { t: 'int', v: 0 }] }, state: { t: 'int', v: 0 } } }]
      }
    })
    const { info } = await parseBuildFile('torre.nbt', await compress(file))
    expect(info.blockCount).toBe(1)
    expect(info.topBlocks[0]).toEqual(['minecraft:bricks', 1])
    expect(info.minecraftVersion).toBe('1.21.1')
  })
})

describe('Región .mca', () => {
  it('lee un chunk 1.18+ con paleta empaquetada', async () => {
    const vals = Array.from({ length: 4096 }, (_, k) => (k >> 8 === 0 ? 1 : 0)) // capa y=0 de piedra
    // 1.18: bits mínimo 4, sin cruzar longs (16 valores por long)
    const longs: bigint[] = []
    for (let i = 0; i < 4096; i += 16) {
      let l = 0n
      for (let j = 0; j < 16; j++) l |= BigInt(vals[i + j]) << BigInt(j * 4)
      longs.push(BigInt.asIntN(64, l))
    }
    const chunk = writeNbt('', {
      DataVersion: { t: 'int', v: 3955 },
      xPos: { t: 'int', v: 1 },
      zPos: { t: 'int', v: 0 },
      sections: {
        t: 'list', et: 'compound',
        v: [{
          t: 'compound',
          v: {
            Y: { t: 'byte', v: -4 },
            block_states: {
              t: 'compound',
              v: {
                palette: { t: 'list', et: 'compound', v: [{ t: 'compound', v: { Name: { t: 'string', v: 'minecraft:air' } } }, { t: 'compound', v: { Name: { t: 'string', v: 'minecraft:stone' } } }] },
                data: { t: 'longArray', v: longs }
              }
            }
          }
        }]
      }
    })
    const cs = new CompressionStream('deflate')
    const z = new Uint8Array(await new Response(new Blob([chunk as BlobPart]).stream().pipeThrough(cs)).arrayBuffer())
    const file = new Uint8Array(8192 + 4096 * Math.ceil((z.length + 5) / 4096))
    const dv = new DataView(file.buffer)
    dv.setUint32(1 * 4, (2 << 8) | 1) // chunk (1,0) en el sector 2
    dv.setUint32(8192, z.length + 1)
    file[8192 + 4] = 2
    file.set(z, 8192 + 5)
    const { info } = await parseBuildFile('r.0.0.mca', file)
    expect([info.width, info.height, info.length]).toEqual([16, 1, 16])
    expect(info.blockCount).toBe(256)
  })
})

describe('Errores comprensibles', () => {
  it('rechaza archivos que no son NBT', async () => {
    await expect(parseBuildFile('foto.schem', new TextEncoder().encode('hola mundo'))).rejects.toThrow(/NBT/)
  })
  it('rechaza archivos vacíos', async () => {
    await expect(parseBuildFile('a.litematic', new Uint8Array())).rejects.toThrow(/vacío/)
  })
})

describe('Malla', () => {
  it('elimina caras ocultas entre bloques opacos', async () => {
    const model = { sx: 2, sy: 1, sz: 1, data: Uint16Array.from([1, 1]), palette: ['minecraft:air', 'minecraft:stone'] }
    const m = buildMesh(model, { vertexAO: true, colorVariation: 0 })
    expect(m.faces).toBe(10)
    expect(m.opaque.indices.length).toBe(60)
  })
  it('la demo es un .schem válido', async () => {
    const { info } = await parseBuildFile('demo.schem', generateDemoSchem())
    expect(info.width).toBe(13)
    expect(info.blockCount).toBeGreaterThan(300)
    expect(info.name).toBe('Casa de ejemplo')
  })
})

describe('Clasificación de bloques', () => {
  it('reconoce formas y colores habituales', () => {
    expect(classifyBlock('minecraft:oak_slab[type=bottom]').shape).toBe('slab_bottom')
    expect(classifyBlock('minecraft:red_sandstone_stairs').color).toEqual(classifyBlock('minecraft:red_sandstone').color)
    expect(classifyBlock('minecraft:white_stained_glass').shape).toBe('glass')
    expect(classifyBlock('minecraft:air').shape).toBe('none')
    expect(classifyBlock('minecraft:torch').emissive).toBe(true)
    expect(minecraftVersionFor(null)).toBeNull()
  })
})

import { resolveFaces } from '../src/renderer/src/core/textures'
describe('Texturas de Minecraft', () => {
  const names = ['__procedural', 'oak_log', 'oak_log_top', 'grass_block_top', 'grass_block_side', 'dirt', 'stone_bricks', 'oak_planks', 'poppy', 'white_wool', 'smooth_stone', 'smooth_stone_slab_side', 'water_still']
  const has = (n: string): number => Math.max(0, names.indexOf(n))
  it('resuelve caras por bloque', () => {
    expect(resolveFaces('minecraft:oak_log[axis=y]', has)).toMatchObject({ side: has('oak_log'), top: has('oak_log_top') })
    const g = resolveFaces('minecraft:grass_block', has)!
    expect(g.top).toBe(has('grass_block_top'))
    expect(g.side).toBe(has('grass_block_side'))
    expect(g.tint).not.toBeNull()
    expect(resolveFaces('minecraft:stone_brick_stairs', has)!.side).toBe(has('stone_bricks'))
    expect(resolveFaces('minecraft:oak_slab[type=top]', has)!.top).toBe(has('oak_planks'))
    expect(resolveFaces('minecraft:white_carpet', has)!.top).toBe(has('white_wool'))
    expect(resolveFaces('minecraft:smooth_stone_slab', has)!.side).toBe(has('smooth_stone_slab_side'))
    expect(resolveFaces('minecraft:water[level=0]', has)!.top).toBe(has('water_still'))
    expect(resolveFaces('minecraft:chorus_plant', has)).toBeNull()
  })
  it('la malla texturizada usa UV del atlas y planos cruzados para plantas', () => {
    const model = { sx: 2, sy: 1, sz: 1, data: Uint16Array.from([1, 2]), palette: ['minecraft:air', 'minecraft:oak_planks', 'minecraft:poppy'] }
    const m = buildMesh(model, { vertexAO: false, colorVariation: 0, atlas: { names, cols: 4, rows: 4 } })
    expect(m.cutout.indices.length).toBe(12) // 2 planos cruzados
    expect(m.opaque.uvs.length).toBe((m.opaque.positions.length / 3) * 2)
    expect(m.untextured).toBe(0)
    for (const u of m.opaque.uvs) expect(u).toBeGreaterThanOrEqual(0)
  })
})

import { shapeBoxes } from '../src/renderer/src/core/mesher'
describe('Formas de bloque', () => {
  it('escalera: losa + escalón del lado de facing', () => {
    const [slab, step] = shapeBoxes('stairs', { facing: 'east', half: 'bottom' }, 'minecraft:oak_stairs')
    expect(slab).toEqual([0, 0, 0, 1, 0.5, 1])
    expect(step).toEqual([0.5, 0.5, 0, 1, 1, 1])
    const top = shapeBoxes('stairs', { facing: 'north', half: 'top' }, 'minecraft:oak_stairs')
    expect(top[1]).toEqual([0, 0, 0, 1, 0.5, 0.5])
  })
  it('valla: poste + travesaños solo hacia las conexiones', () => {
    expect(shapeBoxes('fence', { north: 'false', east: 'false', south: 'false', west: 'false' }, 'minecraft:oak_fence')).toHaveLength(1)
    expect(shapeBoxes('fence', { north: 'true', east: 'true', south: 'false', west: 'false' }, 'minecraft:oak_fence')).toHaveLength(5)
  })
  it('las vallas sin propiedades se conectan con sus vecinas', () => {
    const model = { sx: 3, sy: 1, sz: 1, data: Uint16Array.from([1, 1, 1]), palette: ['minecraft:air', 'minecraft:oak_fence'] }
    const isolated = { sx: 1, sy: 1, sz: 1, data: Uint16Array.from([1]), palette: model.palette }
    const a = buildMesh(model, { vertexAO: false, colorVariation: 0 })
    const b = buildMesh(isolated, { vertexAO: false, colorVariation: 0 })
    expect(a.faces).toBeGreaterThan(b.faces * 3)
  })
})

import { BUILTIN_LOOKS, parseLook } from '../src/renderer/src/state/looks'
describe('Estilos visuales', () => {
  it('valida archivos .bslook y descarta claves desconocidas', () => {
    const l = parseLook(JSON.stringify({ format: 'blockscene-look', version: 1, name: 'Mío', env: { post: { bloom: 0.5 }, hack: 1 } }), 'x')
    expect(l.name).toBe('Mío')
    expect(l.env).toEqual({ post: { bloom: 0.5 } })
    expect(() => parseLook('{"format":"otro"}', 'x')).toThrow(/BlockScene/)
    expect(() => parseLook('no json', 'x')).toThrow(/JSON/)
  })
  it('incluye el estilo de exhibición con fondo de estudio', () => {
    expect(BUILTIN_LOOKS.find((l) => l.id === 'exhibicion')?.env.background?.mode).toBe('studio')
  })
})

import { parseShaderMeta } from '../src/renderer/src/engine/userShaders'
import { buildModelFaces } from '../src/renderer/src/core/blockModels'
describe('Shaders externos y modelos de bloque', () => {
  it('lee las anotaciones del shader', () => {
    const m = parseShaderMeta('// @name Mi efecto\n// @stage hdr\n// @depth\n// @param fuerza 0.5 0 1 Fuerza total\n// @param mal x 0 1\nvoid main(){}', 'a.glsl')
    expect(m).toMatchObject({ name: 'Mi efecto', stage: 'hdr', depth: true })
    expect(m.params).toEqual([{ name: 'fuerza', def: 0.5, min: 0, max: 1, label: 'Fuerza total' }])
    expect(parseShaderMeta('void main(){}', 'x.glsl')).toMatchObject({ name: 'x', stage: 'ldr', depth: false })
  })
  it('resuelve texturas por cara desde blockstates y modelos (incluido el formato sprite de 26.x)', () => {
    const states = {
      oak_log: { variants: { 'axis=x': { model: 'minecraft:block/oak_log_horizontal' }, 'axis=y': { model: 'minecraft:block/oak_log' } } },
      glass: { variants: { '': { model: 'minecraft:block/glass' } } },
      wheat: { variants: { 'age=0': { model: 'minecraft:block/wheat_stage0' }, 'age=7': { model: 'minecraft:block/wheat_stage7' } } }
    }
    const models = {
      cube_column: { textures: { particle: '#side' } },
      oak_log: { parent: 'minecraft:block/cube_column', textures: { end: 'minecraft:block/oak_log_top', side: 'minecraft:block/oak_log' } },
      cube_all: { textures: { particle: '#all' } },
      glass: { parent: 'minecraft:block/cube_all', textures: { all: { sprite: 'minecraft:block/glass', force_translucent: true } } },
      crop: { textures: { particle: '#crop' } },
      wheat_stage7: { parent: 'minecraft:block/crop', textures: { crop: 'minecraft:block/wheat_stage7' } }
    }
    const f = buildModelFaces(states, models)
    expect(f.oak_log).toEqual(['oak_log_top', 'oak_log', 'oak_log_top'])
    expect(f.glass).toEqual(['glass', 'glass', 'glass'])
    expect(f.wheat[1]).toBe('wheat_stage7')
  })
})
