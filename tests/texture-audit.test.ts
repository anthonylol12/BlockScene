// Auditoría de texturas contra una versión real de Minecraft (solo si BS_JAR apunta a un .jar).
// Uso: set BS_JAR=...\.minecraft\versions\26.3\26.3.jar && npx vitest run tests/texture-audit.test.ts
import { it } from 'vitest'
import { listZipNames, readBlockTextures, readZipFile } from '../src/main/mcTextures'
import { resolveFaces } from '../src/renderer/src/core/textures'
import { buildModelFaces } from '../src/renderer/src/core/blockModels'
import { classifyBlock } from '../src/renderer/src/core/blocks'

const jar = process.env.BS_JAR
it.skipIf(!jar)('auditoría de texturas', async () => {
  const names = await listZipNames(jar!)
  const blocks = names.filter((n) => /^assets\/minecraft\/blockstates\/[^/]+\.json$/.test(n)).map((n) => n.split('/').pop()!.slice(0, -5))
  const tex = (await readBlockTextures(jar!)).map((t) => t.name)
  const idx = new Map(['__procedural', ...tex].map((n, i) => [n, i]))
  const has = (n: string): number => idx.get(n) ?? 0
  // datos de modelos del juego
  const json = async (p: string): Promise<unknown> => {
    const d = await readZipFile(jar!, p)
    return d ? JSON.parse(Buffer.from(d).toString('utf8')) : null
  }
  const states: Record<string, unknown> = {}
  const models: Record<string, unknown> = {}
  for (const n of names) {
    if (/^assets\/minecraft\/blockstates\/[^/]+\.json$/.test(n)) states[n.split('/').pop()!.slice(0, -5)] = await json(n)
    if (/^assets\/minecraft\/models\/block\/[^/]+\.json$/.test(n)) models[n.split('/').pop()!.slice(0, -5)] = await json(n)
  }
  const faces = buildModelFaces(states, models)
  let heur = 0, model = 0, none = 0, invisible = 0
  const missH: string[] = [], missM: string[] = [], diff: string[] = []
  for (const b of blocks) {
    if (classifyBlock(`minecraft:${b}`).shape === 'none') { invisible++; continue }
    const h = resolveFaces(`minecraft:${b}`, has)
    const m = faces[b]
    if (h) heur++
    else missH.push(b)
    if (m && has(m[1])) model++
    else missM.push(b)
    if (!h && !(m && has(m[1]))) none++
    if (h && m && has(m[1]) && tex[h.side - 1] !== m[1]) diff.push(`${b}: ${tex[h.side - 1]} → ${m[1]}`)
  }
  const total = blocks.length - invisible
  console.log(`\nBloques en la versión: ${blocks.length} (${invisible} invisibles) · texturas: ${tex.length}`)
  console.log(`Método anterior (por nombre): ${heur}/${total} con textura · sin textura: ${missH.length}`)
  console.log(`Con modelos del juego: ${model}/${total} · sin textura: ${missM.length}`)
  console.log(`Combinado (modelos + nombre): sin textura ${none}`)
  console.log(`Caras laterales que cambian al usar modelos: ${diff.length}`)
  console.log('Ejemplos de corrección:', diff.slice(0, 25).join(' | '))
  console.log('Sin textura (anterior), ejemplos:', missH.slice(0, 40).join(', '))
  console.log('Sin textura (modelos):', missM.join(', '))
}, 120000)
