// Genera una construcción de EJEMPLO (una casita) como archivo Sponge .schem v2 real,
// para que la escena de demostración recorra exactamente el mismo flujo que un archivo importado.
import { writeNbt, type WTag } from './nbt'

export function generateDemoSchem(): Uint8Array {
  const W = 13, H = 12, L = 11
  const grid: string[] = new Array(W * H * L).fill('minecraft:air')
  const set = (x: number, y: number, z: number, s: string): void => {
    if (x >= 0 && y >= 0 && z >= 0 && x < W && y < H && z < L) grid[(y * L + z) * W + x] = s
  }
  // Base de piedra
  for (let x = 0; x < W; x++) for (let z = 0; z < L; z++) set(x, 0, z, x === 0 || z === 0 || x === W - 1 || z === L - 1 ? 'minecraft:stone_bricks' : 'minecraft:grass_block')
  // Casa 9×7 centrada
  const x0 = 2, x1 = 10, z0 = 2, z1 = 8
  for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) set(x, 1, z, 'minecraft:cobblestone')
  for (let y = 2; y <= 5; y++) {
    for (let x = x0; x <= x1; x++) for (let z = z0; z <= z1; z++) {
      const edge = x === x0 || x === x1 || z === z0 || z === z1
      if (!edge) continue
      const corner = (x === x0 || x === x1) && (z === z0 || z === z1)
      let s = corner ? 'minecraft:oak_log[axis=y]' : 'minecraft:oak_planks'
      const win = (y === 3 || y === 4) && !corner && ((z === z0 || z === z1) ? (x === 4 || x === 8) : z === 5)
      if (win) s = 'minecraft:glass_pane'
      if (z === z0 && x === 6 && (y === 2 || y === 3)) s = y === 2 ? 'minecraft:oak_door[half=lower]' : 'minecraft:oak_door[half=upper]'
      set(x, y, z, s)
    }
  }
  // Tejado escalonado de losas y bloques
  for (let k = 0; k <= 4; k++) {
    const y = 6 + k
    for (let x = x0 - 1; x <= x1 + 1; x++) {
      set(x, y, z0 - 1 + k, 'minecraft:dark_oak_stairs[facing=south,half=bottom]')
      set(x, y, z1 + 1 - k, 'minecraft:dark_oak_stairs[facing=north,half=bottom]')
      if (k < 4) for (let z = z0 + k; z <= z1 - k; z++) if (x === x0 || x === x1) set(x, y, z, 'minecraft:oak_planks')
    }
  }
  for (let x = x0 - 1; x <= x1 + 1; x++) set(x, 11, 5, 'minecraft:dark_oak_slab[type=bottom]')
  // Chimenea, farolillos y flores
  for (let y = 6; y <= 11; y++) set(9, y, 7, 'minecraft:bricks')
  set(5, 3, z0 - 1, 'minecraft:lantern[hanging=false]')
  set(7, 3, z0 - 1, 'minecraft:lantern[hanging=false]')
  const flowers = ['minecraft:poppy', 'minecraft:dandelion', 'minecraft:cornflower', 'minecraft:oxeye_daisy']
  let fi = 0
  for (let x = 1; x < W - 1; x++) if (x < 5 || x > 7) set(x, 1, 1, flowers[fi++ % flowers.length])
  set(1, 1, 9, 'minecraft:oak_leaves'); set(11, 1, 9, 'minecraft:oak_leaves')
  // Camino
  for (let z = 0; z < z0; z++) set(6, 0, z, 'minecraft:dirt_path')

  const palette = new Map<string, number>()
  const bytes: number[] = []
  for (const s of grid) {
    let id = palette.get(s)
    if (id === undefined) palette.set(s, (id = palette.size))
    let v = id
    while (v & ~0x7f) {
      bytes.push((v & 0x7f) | 0x80)
      v >>>= 7
    }
    bytes.push(v)
  }
  const pal: Record<string, WTag> = {}
  for (const [k, v] of palette) pal[k] = { t: 'int', v }
  return writeNbt('Schematic', {
    Version: { t: 'int', v: 2 },
    DataVersion: { t: 'int', v: 3955 },
    Width: { t: 'short', v: W },
    Height: { t: 'short', v: H },
    Length: { t: 'short', v: L },
    PaletteMax: { t: 'int', v: palette.size },
    Palette: { t: 'compound', v: pal },
    BlockData: { t: 'byteArray', v: Uint8Array.from(bytes) },
    Metadata: { t: 'compound', v: { Name: { t: 'string', v: 'Casa de ejemplo' }, Author: { t: 'string', v: 'BlockScene (demo)' } } }
  })
}
