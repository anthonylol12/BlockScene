// Genera archivos de prueba reales en BS_FIXTURES (solo si la variable existe). Lo usa scripts/e2e.cjs.
import { it } from 'vitest'
import { mkdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { compress, writeNbt, type WTag } from '../src/renderer/src/core/nbt'
import { generateDemoSchem } from '../src/renderer/src/core/demo'

const dir = process.env.BS_FIXTURES
it.skipIf(!dir)('genera fixtures', async () => {
  mkdirSync(dir!, { recursive: true })
  writeFileSync(join(dir!, 'torre.schem'), await compress(generateDemoSchem()))
  // estructura .nbt: torre de ladrillo 5×12×5
  const blocks: WTag[] = []
  for (let y = 0; y < 12; y++) for (let x = 0; x < 5; x++) for (let z = 0; z < 5; z++)
    if (x === 0 || z === 0 || x === 4 || z === 4) blocks.push({ t: 'compound', v: { pos: { t: 'list', et: 'int', v: [{ t: 'int', v: x }, { t: 'int', v: y }, { t: 'int', v: z }] }, state: { t: 'int', v: y === 11 ? 1 : 0 } } })
  writeFileSync(join(dir!, 'torre-ladrillo.nbt'), await compress(writeNbt('', {
    DataVersion: { t: 'int', v: 3955 },
    size: { t: 'list', et: 'int', v: [{ t: 'int', v: 5 }, { t: 'int', v: 12 }, { t: 'int', v: 5 }] },
    palette: { t: 'list', et: 'compound', v: [{ t: 'compound', v: { Name: { t: 'string', v: 'minecraft:bricks' } } }, { t: 'compound', v: { Name: { t: 'string', v: 'minecraft:glowstone' } } }] },
    blocks: { t: 'list', et: 'compound', v: blocks }
  })))
  // MCEdit 6×4×6: lana de colores
  const W = 6, H = 4, L = 6
  const b = new Uint8Array(W * H * L), d = new Uint8Array(W * H * L)
  for (let i = 0; i < b.length; i++) { b[i] = 35; d[i] = i % 16 }
  writeFileSync(join(dir!, 'lana-antigua.schematic'), await compress(writeNbt('Schematic', {
    Width: { t: 'short', v: W }, Height: { t: 'short', v: H }, Length: { t: 'short', v: L }, Materials: { t: 'string', v: 'Alpha' },
    Blocks: { t: 'byteArray', v: b }, Data: { t: 'byteArray', v: d }
  })))
  writeFileSync(join(dir!, 'dañado.litematic'), new TextEncoder().encode('esto no es un archivo NBT'))
})
