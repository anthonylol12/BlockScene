// Prueba de extremo a extremo de «Exportar animación» (MP4, WebM y GIF) y de la nitidez 2× del render.
// Uso: npm run build && npx electron scripts/e2e-animation.cjs <carpeta-salida>
const { app, BrowserWindow, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const out = path.resolve(process.argv[process.argv.length - 1])
fs.mkdirSync(out, { recursive: true })
for (const f of fs.readdirSync(out)) if (/\.(mp4|webm|gif)$/.test(f)) fs.unlinkSync(path.join(out, f))
dialog.showSaveDialog = async (_w, opts) => ({ canceled: false, filePath: path.join(out, path.basename(opts.defaultPath)) })
require('../out/main/index.js')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const results = []
const check = (name, ok, detail = '') => {
  results.push(ok)
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
}

app.whenReady().then(async () => {
  let win
  while (!(win = BrowserWindow.getAllWindows()[0])) await sleep(100)
  win.setSize(1600, 960)
  const errors = []
  win.webContents.on('console-message', (e) => { if (e.level === 'error') errors.push(e.message) })
  await new Promise((r) => win.webContents.once('did-finish-load', r))
  await sleep(3500)
  const js = (c) => win.webContents.executeJavaScript(c)
  const click = (text, sel = 'button') => js(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => x.textContent.trim().startsWith(${JSON.stringify(text)}) && !x.disabled); if (!b) return false; b.click(); return true })()`)
  const exact = (text, sel) => js(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => x.textContent.trim() === ${JSON.stringify(text)} && !x.disabled); if (!b) return false; b.click(); return true })()`)
  const until = async (expr, ms = 120000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(expr)) return true; await sleep(300) } return false }
  await js('window.confirm = () => true; true')
  await click('Escena de ejemplo', '.vp-empty button')
  await sleep(6000)

  // render con nitidez 2×: el tamaño final es el pedido
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12' })); true`)
  await sleep(600)
  check('Opción «Nitidez» en el diálogo de render', await js(`/Nitidez/.test(document.querySelector('.modal')?.innerText)`))
  await click('Alta 2×', '.modal .seg button')
  await exact('4', '.modal .seg button')
  await click('Render final', '.modal-foot button')
  await until(`!!document.querySelector('.modal .callout.ok img')`)
  const size = await js(`(() => { const i = document.querySelector('.modal .callout.ok img'); return i.naturalWidth + 'x' + i.naturalHeight })()`)
  check('Render 2× sale al tamaño pedido (1920×1080)', size === '1920x1080', size)
  await js(`document.querySelector('.modal-head .icon-btn')?.click(); true`)
  await sleep(400)

  for (const fmt of ['MP4', 'WebM', 'GIF']) {
    await click('Vídeo / GIF', '.bb-group button')
    await sleep(500)
    if (fmt === 'MP4') check('Se abre «Exportar animación»', await js(`/Exportar animación/.test(document.querySelector('.modal')?.innerText)`))
    await click(fmt, '.modal .seg button')
    await js(`(() => { const s = [...document.querySelectorAll('.modal select')][0]; s.value = '480'; s.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
    await exact('3 s', '.modal .seg button')
    await exact('15', '.modal .seg button')
    await click('Borrador', '.modal .seg button')
    if (fmt === 'GIF') await click('Ambos', '.modal .seg button')
    await click('Exportar', '.modal-foot button')
    const ok = await until(`/Guardado en/.test(document.querySelector('.modal')?.innerText ?? '')`, 240000)
    const ext = fmt.toLowerCase()
    const f = fs.readdirSync(out).find((x) => x.endsWith('.' + ext))
    const bytes = f ? fs.statSync(path.join(out, f)).size : 0
    check(`${fmt} exportado`, ok && bytes > 10000, f ? `${f} · ${(bytes / 1024).toFixed(0)} KB` : 'no existe')
    if (f && fmt !== 'GIF') {
      // el vídeo se puede abrir y dura lo pedido
      const info = await js(`new Promise((res) => { const v = document.createElement('video'); v.muted = true; v.onloadedmetadata = () => res({ d: v.duration, w: v.videoWidth, h: v.videoHeight }); v.onerror = () => res({ err: v.error && v.error.code }); v.src = ${JSON.stringify('file:///' + path.join(out, f).replace(/\\/g, '/'))} })`)
      check(`${fmt} reproducible, 3 s y 854×480`, Math.abs((info.d ?? 0) - 3) < 0.3 && info.w === 854 && info.h === 480, JSON.stringify(info))
    }
    if (f && fmt === 'GIF') {
      const head = fs.readFileSync(path.join(out, f)).subarray(0, 6).toString('ascii')
      const gifUrl = require('node:url').pathToFileURL(path.join(out, f)).href
      const img = await js(`new Promise((res) => { const i = new Image(); i.onload = () => res({ width: i.naturalWidth, height: i.naturalHeight }); i.onerror = () => res({ width: 0, height: 0 }); i.src = ${JSON.stringify(gifUrl)} })`)
      check('GIF válido de 854×480', head === 'GIF89a' && img.width === 854 && img.height === 480, `${head} ${img.width}×${img.height}`)
    }
    await js(`document.querySelector('.modal-head .icon-btn')?.click(); true`)
    await sleep(400)
  }
  check('Sin errores en la consola', errors.length === 0, errors.slice(0, 2).join(' | '))
  const failed = results.filter((x) => !x).length
  console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas`)
  app.exit(failed ? 1 : 0)
})
