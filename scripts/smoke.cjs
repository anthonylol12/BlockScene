// Prueba de humo: arranca la app compilada, recorre el flujo principal pulsando la interfaz y guarda capturas.
// Uso: npx electron scripts/smoke.cjs <carpeta-salida>
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const out = path.resolve(process.argv[process.argv.length - 1])
fs.mkdirSync(out, { recursive: true })
require('../out/main/index.js')

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function shot(win, name) {
  const img = await win.webContents.capturePage()
  fs.writeFileSync(path.join(out, name + '.png'), img.toPNG())
  console.log('captura', name)
}
const js = (win, code) => win.webContents.executeJavaScript(code)
const click = (win, text, sel = 'button') =>
  js(win, `(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => x.textContent.trim().startsWith(${JSON.stringify(text)})); if (!b) return 'NO ' + ${JSON.stringify(text)}; b.click(); return 'ok' })()`)

app.whenReady().then(async () => {
  let win
  for (let i = 0; i < 100 && !(win = BrowserWindow.getAllWindows()[0]); i++) await sleep(100)
  win.setSize(1600, 960)
  win.webContents.on('console-message', (e) => { if (e.level === 'error' || e.level === 3) console.log('[renderer error]', e.message) })
  await new Promise((r) => win.webContents.once('did-finish-load', r))
  await sleep(1500)
  await shot(win, '01-inicio')
  console.log(await click(win, 'Escena de ejemplo'))
  await sleep(6000)
  await shot(win, '02-demo')
  console.log(await click(win, 'Escena', '.panel.right .seg button'))
  await sleep(500)
  await shot(win, '03-panel-escena')
  // ajustar hora de atardecer + lluvia vía UI
  console.log(await click(win, 'Lluvia'))
  await sleep(1500)
  await shot(win, '04-lluvia')
  console.log(await click(win, 'Despejado'))
  console.log(await click(win, 'Isométrica'))
  await sleep(1200)
  await shot(win, '05-iso')
  // render final pequeño
  console.log(await js(win, `document.dispatchEvent(new KeyboardEvent('keydown', {key:'F12'})); window.dispatchEvent(new KeyboardEvent('keydown', {key:'F12'})); 'f12'`))
  await sleep(800)
  console.log(await click(win, '¾'))
  console.log(await click(win, 'Vista previa rápida'))
  await sleep(8000)
  await shot(win, '06-render')
  console.log(await js(win, `document.querySelector('.modal-head .icon-btn')?.click(); 'close'`))
  console.log(await click(win, 'Compositor'))
  await sleep(800)
  console.log(await click(win, 'Póster de colección', '.tpl-card'))
  await sleep(1500)
  await shot(win, '07-compositor')
  const errs = await js(win, `[...document.querySelectorAll('.toast.error')].map(t => t.textContent).join(' | ')`)
  console.log('toasts de error:', errs || '(ninguno)')
  await sleep(300)
  app.exit(0)
})
