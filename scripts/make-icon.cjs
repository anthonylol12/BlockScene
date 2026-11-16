// Genera build/icon.png (512 px) y build/icon.ico (16–256 px) con un diseño propio:
// un bloque isométrico pixelado sobre fondo redondeado. Uso: npm run icon
const { app, BrowserWindow, nativeImage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')

const draw = `(() => {
  const S = 512, c = document.createElement('canvas'); c.width = c.height = S
  const x = c.getContext('2d')
  // fondo
  const g = x.createLinearGradient(0, 0, S, S); g.addColorStop(0, '#2b3a55'); g.addColorStop(1, '#141a26')
  x.fillStyle = g; x.beginPath(); x.roundRect(16, 16, S - 32, S - 32, 96); x.fill()
  // bloque isométrico de 8×8 "píxeles" por cara
  const N = 8, s = 18, cx = S / 2, cy = 256
  let seed = 7; const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff)
  const shade = (hex, f) => { const n = parseInt(hex.slice(1), 16); const r = Math.min(255, ((n >> 16) & 255) * f), gg = Math.min(255, ((n >> 8) & 255) * f), b = Math.min(255, (n & 255) * f); return 'rgb(' + (r|0) + ',' + (gg|0) + ',' + (b|0) + ')' }
  const quad = (p, col) => { x.fillStyle = col; x.beginPath(); x.moveTo(...p[0]); for (const q of p.slice(1)) x.lineTo(...q); x.closePath(); x.fill(); x.strokeStyle = col; x.lineWidth = 0.8; x.stroke() }
  const iso = (u, v, w) => [cx + (u - v) * s * 0.866 * 1.25, cy + (u + v) * s * 0.5 * 1.25 - w * s * 1.25]
  // cara superior (hierba)
  for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) {
    const f = 0.85 + rnd() * 0.3
    quad([iso(i, j, N), iso(i + 1, j, N), iso(i + 1, j + 1, N), iso(i, j + 1, N)], shade('#6dbb45', f))
  }
  // cara izquierda y derecha (tierra con borde de hierba)
  for (let k = 0; k < N; k++) for (let h = 0; h < N; h++) {
    const top = h >= N - 2 && !(h === N - 2 && rnd() < 0.45)
    const base = top ? '#5ea33a' : '#8b5a33'
    const f = 0.82 + rnd() * 0.3
    quad([iso(N, k, h), iso(N, k + 1, h), iso(N, k + 1, h + 1), iso(N, k, h + 1)], shade(base, f * 0.72))
    quad([iso(k, N, h), iso(k + 1, N, h), iso(k + 1, N, h + 1), iso(k, N, h + 1)], shade(base, f * 0.92))
  }
  return c.toDataURL('image/png')
})()`

function ico(images) {
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2)
  header.writeUInt16LE(images.length, 4)
  const entries = []
  let offset = 6 + 16 * images.length
  for (const { size, png } of images) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0)
    e.writeUInt8(size >= 256 ? 0 : size, 1)
    e.writeUInt16LE(1, 4)
    e.writeUInt16LE(32, 6)
    e.writeUInt32LE(png.length, 8)
    e.writeUInt32LE(offset, 12)
    offset += png.length
    entries.push(e)
  }
  return Buffer.concat([header, ...entries, ...images.map((i) => i.png)])
}

app.whenReady().then(async () => {
  const win = new BrowserWindow({ show: false })
  await win.loadURL('data:text/html,<html><body></body></html>')
  const url = await win.webContents.executeJavaScript(draw)
  const img = nativeImage.createFromDataURL(url)
  const dir = path.join(__dirname, '..', 'build')
  fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'icon.png'), img.toPNG())
  const sizes = [256, 128, 64, 48, 32, 24, 16]
  fs.writeFileSync(path.join(dir, 'icon.ico'), ico(sizes.map((size) => ({ size, png: img.resize({ width: size, height: size, quality: 'best' }).toPNG() }))))
  console.log('icono generado en', dir)
  app.exit(0)
})
