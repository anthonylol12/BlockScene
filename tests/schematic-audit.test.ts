// Auditoría de texturas de construcciones reales: qué estados de bloque no tienen textura o salen con la
// textura genérica. Solo se ejecuta si BS_JAR apunta a un .jar y BS_SCHEMS a una lista de archivos
// separados por ';'. Uso:
//   set BS_JAR=...\26.3.jar && set BS_SCHEMS=a.schem;b.schematic && npx vitest run tests/schematic-audit.test.ts
import { it } from 'vitest'
import { readFileSync } from 'node:fs'
import { basename } from 'node:path'
import { readBlockModels, readBlockTextures } from '../src/main/mcTextures'
import { buildModelFaces } from '../src/renderer/src/core/blockModels'
import { resolveBlock } from '../src/renderer/src/core/textures'
import { classifyBlock } from '../src/renderer/src/core/blocks'
import { isAirState, parseBuildFile } from '../src/renderer/src/core/formats'

const jar = process.env.BS_JAR
const files = (process.env.BS_SCHEMS ?? '').split(';').filter(Boolean)
it.skipIf(!jar || !files.length)('auditoría de texturas en construcciones reales', async () => {
  const tex = (await readBlockTextures(jar!)).map((t) => t.name)
  const idx = new Map(['__procedural', ...tex].map((n, i) => [n, i]))
  const has = (n: string): number => idx.get(n) ?? 0
  const { states, models } = await readBlockModels(jar!)
  const faces = buildModelFaces(states, models)
  for (const f of files) {
    const { model } = await parseBuildFile(basename(f), new Uint8Array(readFileSync(f)))
    const counts = new Map<number, number>()
    for (const v of model.data) counts.set(v, (counts.get(v) ?? 0) + 1)
    const bad: string[] = []
    let badBlocks = 0, total = 0
    model.palette.forEach((s, i) => {
      const n = counts.get(i) ?? 0
      if (!n || isAirState(s) || classifyBlock(s).shape === 'none') return
      total += n
      if (!resolveBlock(s, has, faces)) {
        bad.push(`${s} ×${n}`)
        badBlocks += n
      }
    })
    console.log(`\n${basename(f)}: ${model.palette.length} estados · ${badBlocks}/${total} bloques sin textura`)
    if (bad.length) console.log('  ' + bad.slice(0, 60).join('\n  '))
  }
}, 300000)
