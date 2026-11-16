// Instala un paquete de texturas real desde la carpeta resourcepacks de Minecraft, comprueba que se aplica,
// guarda una captura y lo desinstala. Uso: npx electron scripts/smoke-pack.cjs <nombre.zip> <carpeta-salida>
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const [packName, outDir] = process.argv.slice(-2)
const out = path.resolve(outDir)
fs.mkdirSync(out, { recursive: true })
require('../out/main/index.js')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  let win
  while (!(win = BrowserWindow.getAllWindows()[0])) await sleep(100)
  win.setSize(1600, 960)
  await new Promise((r) => win.webContents.once('did-finish-load', r))
  await sleep(4000)
  const js = (c) => win.webContents.executeJavaScript(c)
  const click = (text, sel = 'button') => js(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => x.textContent.trim().startsWith(${JSON.stringify(text)}) && !x.disabled); if (!b) return 'NO ' + ${JSON.stringify(text)}; b.click(); return 'ok' })()`)
  await js('window.confirm = () => true; true')
  await click('Escena de ejemplo')
  await sleep(5000)
  await click('Render', '.panel.right .seg button')
  await sleep(500)
  const r = await js(`(() => {
    const sel = document.querySelector('select[aria-label="Paquetes encontrados en Minecraft"]')
    const opt = [...(sel?.options ?? [])].find(o => o.textContent === ${JSON.stringify(packName)})
    if (!opt) return 'paquete no listado'
    const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set
    set.call(sel, opt.value); sel.dispatchEvent(new Event('change', { bubbles: true })); return 'ok'
  })()`)
  console.log('seleccionar:', r)
  await sleep(300)
  console.log('instalar:', await js(`(() => { const b = [...document.querySelectorAll('.panel.right button')].find(x => x.textContent.trim() === 'Instalar' && !x.disabled); b?.click(); return !!b })()`))
  await sleep(9000)
  console.log('estado:', await js(`document.querySelector('.panel.right .callout.ok')?.innerText`))
  console.log('aviso:', await js(`[...document.querySelectorAll('.toast')].map(t => t.innerText.replace(/\\n/g, ' ')).join(' | ')`))
  await js(`document.querySelectorAll('.toast .icon-btn').forEach(b => b.click()); true`)
  await click('¾')
  await sleep(800)
  await js(`(() => { const c = document.querySelector('.viewport canvas'); const r = c.getBoundingClientRect(); for (let i = 0; i < 14; i++) c.dispatchEvent(new WheelEvent('wheel', { deltaY: -120, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, bubbles: true })); return true })()`)
  await sleep(1500)
  fs.writeFileSync(path.join(out, 'pack.png'), (await win.webContents.capturePage()).toPNG())
  // desinstalar para dejar el estado como estaba
  await js(`window.api.packsUpdate([]).then(() => true)`)
  console.log('desinstalado; paquetes:', JSON.stringify(await js(`window.api.packsList().then(r => r.installed)`)))
  app.exit(0)
})
