import { describe, expect, it } from 'vitest'
import { BASE_OPTIONS, TEMPLATE_OPTIONS, baseForBuild, lookSummary, recommendedTemplate } from '../src/renderer/src/state/wizard'
import { BUILTIN_LOOKS } from '../src/renderer/src/state/looks'

const opt = (id: string) => BASE_OPTIONS.find((b) => b.id === id)!

describe('Asistente: base ajustada a la construcción', () => {
  it('la isla cubre la huella con margen (también construcciones grandes e impares)', () => {
    for (const [w, l] of [[13, 11], [5, 5], [41, 27], [96, 96]]) {
      const b = baseForBuild({ width: w, length: l }, [3, 0, -2], opt('isla-verde'))!
      const half = Math.max(w, l) / 2
      // la isla puede encogerse hasta un 18 % en su borde irregular: el radio mínimo debe seguir cubriendo la construcción
      expect((b.params.radius as number) * 0.82).toBeGreaterThanOrEqual(Math.min(half, 60 * 0.82))
      expect(b.position).toEqual([3, -2, -2]) // centrada bajo la construcción y con su parte superior en y = 0
      expect(b.params.shape).toBe('island')
    }
  })
  it('la base escalonada usa un margen fijo y «Sin base» no crea nada', () => {
    expect(baseForBuild({ width: 13, length: 11 }, [0, 0, 0], opt('escalonada'))!.params.radius).toBe(9)
    expect(baseForBuild({ width: 13, length: 11 }, [0, 0, 0], opt('ninguna'))).toBeNull()
  })
  it('cada base recomienda un estilo que existe', () => {
    for (const b of BASE_OPTIONS) expect(BUILTIN_LOOKS.some((l) => l.id === b.look)).toBe(true)
  })
})

describe('Asistente: explicación de los estilos', () => {
  it('resume lo que cambia cada estilo incluido', () => {
    for (const l of BUILTIN_LOOKS) expect(lookSummary(l).length).toBeGreaterThan(0)
    const exhib = lookSummary(BUILTIN_LOOKS.find((l) => l.id === 'exhibicion')!)
    expect(exhib).toContain('fondo de estudio (oculta terreno y agua)')
    expect(exhib).toContain('hora 10:30')
    expect(exhib).toContain('brillo en las luces')
    expect(lookSummary(BUILTIN_LOOKS.find((l) => l.id === 'invierno')!)).toContain('nieve')
  })
  it('recomienda la plantilla acorde y marca las que necesitan fondo transparente', () => {
    expect(recommendedTemplate('pastel')).toBe('bundle')
    expect(recommendedTemplate('pergamino')).toBe('collection')
    expect(recommendedTemplate(null)).toBe('showcase')
    expect(TEMPLATE_OPTIONS.find((t) => t.id === 'showcase')!.transparent).toBe(false)
    expect(TEMPLATE_OPTIONS.find((t) => t.id === 'bundle')!.transparent).toBe(true)
  })
})
