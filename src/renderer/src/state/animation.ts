// Exportación de animaciones: giro 360° de la cámara y/o ciclo solar, como vídeo (MP4/WebM) o GIF.
// Cada fotograma es un render real de la escena (mismo motor que «Render final»), no una grabación de pantalla.
import type { FrameSpec } from '../engine/Engine'

export type AnimKind = 'turntable' | 'sun' | 'both'
export type AnimFormat = 'mp4' | 'webm' | 'gif'

export interface AnimOptions {
  kind: AnimKind
  format: AnimFormat
  width: number
  height: number
  /** duración en segundos */
  seconds: number
  fps: number
  samples: number
  /** grados del giro (360 = vuelta completa, en bucle perfecto) */
  degrees: number
  /** 1 = sentido antihorario visto desde arriba, -1 = horario */
  direction: 1 | -1
  /** hora inicial y final del ciclo solar */
  sunFrom: number
  sunTo: number
  scale: number
  transparent?: boolean
}

export const ANIM_DEFAULTS: AnimOptions = {
  kind: 'turntable', format: 'mp4', width: 1280, height: 720, seconds: 6, fps: 30, samples: 4,
  degrees: 360, direction: 1, sunFrom: 6, sunTo: 19, scale: 1
}

export const FORMAT_INFO: Record<AnimFormat, { label: string; ext: string; mime: string; filter: string }> = {
  mp4: { label: 'Vídeo MP4', ext: 'mp4', mime: 'video/mp4', filter: 'Vídeo MP4 (H.264)' },
  webm: { label: 'Vídeo WebM', ext: 'webm', mime: 'video/webm', filter: 'Vídeo WebM (VP9)' },
  gif: { label: 'GIF animado', ext: 'gif', mime: 'image/gif', filter: 'GIF animado' }
}

/** Número de fotogramas: duración × fps (mínimo 2). */
export const frameCount = (o: Pick<AnimOptions, 'seconds' | 'fps'>): number => Math.max(2, Math.round(o.seconds * o.fps))

/**
 * Ajustes de cada fotograma. El giro de 360° no repite el primer fotograma al final, para que el bucle
 * (GIF o vídeo en repetición) sea continuo.
 */
export function frameSpecs(o: AnimOptions): (i: number) => FrameSpec {
  const n = frameCount(o)
  const full = Math.abs(o.degrees) >= 360
  return (i) => {
    const s: FrameSpec = { time: i / o.fps }
    if (o.kind !== 'sun') s.orbitDeg = o.direction * o.degrees * (full ? i / n : i / (n - 1))
    if (o.kind !== 'turntable') s.timeOfDay = o.sunFrom + (o.sunTo - o.sunFrom) * (i / (n - 1))
    return s
  }
}

/** Los códecs de vídeo exigen dimensiones pares. */
export const evenSize = (v: number): number => Math.max(16, Math.round(v / 2) * 2)

/** Tamaño estimado en memoria de un GIF y aviso si es muy grande. */
export function gifWarning(o: AnimOptions): string | null {
  const px = o.width * o.height * frameCount(o)
  if (px > 120_000_000) return 'Un GIF tan grande puede pesar decenas de MB y tardar en abrirse. Para redes sociales usa MP4 o reduce tamaño y duración.'
  return null
}

interface Encoder {
  add(canvas: HTMLCanvasElement, i: number): Promise<void>
  finish(): Promise<Uint8Array>
}

async function gifEncoder(o: AnimOptions): Promise<Encoder> {
  const { GIFEncoder, quantize, applyPalette } = await import('gifenc')
  const gif = GIFEncoder()
  const delay = Math.round(1000 / o.fps)
  return {
    async add(canvas, i) {
      const { data, width, height } = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height)
      const palette = quantize(data, 256)
      const index = applyPalette(data, palette)
      gif.writeFrame(index, width, height, { palette, delay, repeat: i === 0 ? 0 : undefined })
    },
    async finish() {
      gif.finish()
      return gif.bytes()
    }
  }
}

async function videoEncoder(o: AnimOptions): Promise<Encoder> {
  const mb = await import('mediabunny')
  const codec = o.format === 'mp4' ? 'avc' : 'vp9'
  if (!(await mb.canEncodeVideo(codec, { width: o.width, height: o.height }))) {
    throw new Error(o.format === 'mp4'
      ? `Este equipo no puede codificar MP4 (H.264) a ${o.width}×${o.height}. Prueba WebM o un tamaño menor.`
      : `Este equipo no puede codificar WebM (VP9) a ${o.width}×${o.height}. Prueba MP4 o un tamaño menor.`)
  }
  // lienzo fijo: el render reutiliza el suyo entre fotogramas
  const frame = document.createElement('canvas')
  frame.width = o.width
  frame.height = o.height
  const fctx = frame.getContext('2d')!
  const target = new mb.BufferTarget()
  const output = new mb.Output({ format: o.format === 'mp4' ? new mb.Mp4OutputFormat({ fastStart: 'in-memory' }) : new mb.WebMOutputFormat(), target })
  const source = new mb.CanvasSource(frame, { codec, bitrate: mb.QUALITY_HIGH, keyFrameInterval: 2 })
  output.addVideoTrack(source, { frameRate: o.fps })
  await output.start()
  return {
    async add(canvas, i) {
      fctx.fillStyle = '#000'
      fctx.fillRect(0, 0, o.width, o.height)
      fctx.drawImage(canvas, 0, 0, o.width, o.height)
      await source.add(i / o.fps, 1 / o.fps)
    },
    async finish() {
      await output.finalize()
      if (!target.buffer) throw new Error('El codificador de vídeo no produjo datos.')
      return new Uint8Array(target.buffer)
    }
  }
}

export async function makeEncoder(o: AnimOptions): Promise<Encoder> {
  return o.format === 'gif' ? gifEncoder(o) : videoEncoder(o)
}
