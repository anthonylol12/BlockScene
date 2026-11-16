import type { PageQuality } from '@shared/types'

export const PAGE_PRESETS: { id: string; label: string; w: number; h: number }[] = [
  { id: 'fhd', label: 'Full HD horizontal · 1920×1080', w: 1920, h: 1080 },
  { id: 'qhd', label: '2K horizontal · 2560×1440', w: 2560, h: 1440 },
  { id: '4k', label: '4K horizontal · 3840×2160', w: 3840, h: 2160 },
  { id: 'square', label: 'Cuadrado · 2048×2048', w: 2048, h: 2048 },
  { id: 'story', label: 'Vertical 9:16 · 1080×1920', w: 1080, h: 1920 },
  { id: 'a4p', label: 'A4 vertical 300 ppp · 2480×3508', w: 2480, h: 3508 },
  { id: 'a4l', label: 'A4 horizontal 300 ppp · 3508×2480', w: 3508, h: 2480 },
  { id: 'a3p', label: 'A3 vertical 300 ppp · 3508×4961', w: 3508, h: 4961 },
  { id: 'poster', label: 'Póster 2:3 · 4724×7087 (40×60 cm)', w: 4724, h: 7087 }
]

export const QUALITY_INFO: Record<PageQuality, { label: string; ss: number; jpg: number; detail: string }> = {
  fast: { label: 'Rápida', ss: 1, jpg: 0.85, detail: 'Se dibuja directamente al tamaño final. JPG al 85 %.' },
  high: { label: 'Alta', ss: 2, jpg: 0.92, detail: 'Se dibuja al doble de resolución y se reduce (bordes y texto más finos). JPG al 92 %.' },
  max: { label: 'Máxima', ss: 3, jpg: 0.98, detail: 'Se dibuja al triple de resolución y se reduce. JPG al 98 %.' }
}

// Límites de Chromium para <canvas>
export const CANVAS_MAX_SIDE = 32767
export const CANVAS_MAX_AREA = 268_435_456

export interface Capacity {
  level: 'ok' | 'warn' | 'err'
  message: string
  ss: number
  memMB: number
}

/** Evalúa si el equipo puede generar la lámina con el tamaño y calidad indicados. */
export function checkCapacity(w: number, h: number, q: PageQuality): Capacity {
  if (!Number.isFinite(w) || !Number.isFinite(h) || w < 64 || h < 64)
    return { level: 'err', message: 'El tamaño mínimo es 64×64 px.', ss: 1, memMB: 0 }
  if (w > CANVAS_MAX_SIDE || h > CANVAS_MAX_SIDE)
    return { level: 'err', message: `Supera el máximo de ${CANVAS_MAX_SIDE} px por lado que admite el motor de dibujo.`, ss: 1, memMB: 0 }
  if (w * h > CANVAS_MAX_AREA)
    return { level: 'err', message: `Supera el área máxima de lienzo (${(CANVAS_MAX_AREA / 1e6).toFixed(0)} Mpx).`, ss: 1, memMB: 0 }
  let ss = QUALITY_INFO[q].ss
  let reduced = false
  while (ss > 1 && (w * ss > CANVAS_MAX_SIDE || h * ss > CANVAS_MAX_SIDE || w * h * ss * ss > CANVAS_MAX_AREA)) {
    ss--
    reduced = true
  }
  const memMB = Math.round((w * h * 4 * (ss * ss + 2)) / 1048576)
  const devGB = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8
  const budget = devGB * 1024
  if (memMB > budget * 0.75)
    return { level: 'err', message: `Necesita unos ${memMB} MB de memoria y este equipo informa ${devGB} GB o más. Reduce el tamaño o la calidad.`, ss, memMB }
  if (reduced)
    return { level: 'warn', message: `Con este tamaño la calidad se limitará a ${ss}× de sobremuestreo (límite del lienzo). Memoria estimada: ${memMB} MB.`, ss, memMB }
  if (memMB > budget * 0.3)
    return { level: 'warn', message: `Exportación pesada: unos ${memMB} MB de memoria. Puede tardar y ralentizar el equipo.`, ss, memMB }
  return { level: 'ok', message: `Dentro de las capacidades del equipo · memoria estimada ${memMB} MB.`, ss, memMB }
}
