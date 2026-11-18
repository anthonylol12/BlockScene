// Prueba de extremo a extremo de «Importar mundo de Minecraft» con el primer mundo de la carpeta saves.
// Uso: npm run build && npx electron scripts/e2e-world.cjs <carpeta-salida>
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const out = path.resolve(process.argv[process.argv.length - 1])
fs.mkdirSync(out, { recursive: true })
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
  const until = async (expr, ms = 180000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(expr)) return true; await sleep(300) } return false }
  const shot = async (n) => fs.writeFileSync(path.join(out, n + '.png'), (await win.webContents.capturePage()).toPNG())

  check('Botón «Importar mundo» en el visor vacío', await click('Importar mundo', '.vp-empty button'))
  check('Lista los mundos de .minecraft/saves', await until(`document.querySelectorAll('.world-list .tpl-card').length > 0`, 10000))
  const first = await js(`document.querySelector('.world-list .tpl-card b')?.textContent`)
  await js(`document.querySelector('.world-list .tpl-card').click(); true`)
  check('Lee level.dat (nombre, versión y aparición)', await until(`/Aparición/.test(document.querySelector('.modal')?.innerText ?? '')`, 10000), first)
  await click('64×64', '.modal .seg button')
  await shot('world-1-dialogo')
  check('Botón «Importar zona» pulsado', await click('Importar zona', '.modal-foot button'))
  await sleep(8000)
  console.log('estado:', await js(`(document.querySelector('.modal')?.innerText ?? 'sin modal').replace(/\\n/g, ' ').slice(-300) + ' || ' + [...document.querySelectorAll('.toast')].map(t => t.innerText.replace(/\\n/g, ' ')).join(' | ')`))
  const done = await until(`!document.querySelector('.modal') && document.querySelectorAll('.tree-row.obj').length > 0 && !document.querySelector('.tree-row .spinner')`)
  const toast = await js(`[...document.querySelectorAll('.toast')].map(t => t.innerText.replace(/\\n/g, ' ')).join(' | ')`)
  check('La zona del mundo se importa como construcción', done, toast.slice(0, 200))
  const info = await js(`document.querySelector('.panel.right')?.innerText.replace(/\\n/g, ' ').slice(0, 400)`)
  check('Datos reales de la zona (Sponge Schematic, dimensiones)', /Sponge/.test(info) && /×/.test(info), info.slice(0, 160))
  await sleep(2500)
  await shot('world-2-escena')
  // render real de la zona importada
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12' })); true`)
  await sleep(600)
  await click('Vista previa rápida', '.modal-foot button')
  const rendered = await until(`!!document.querySelector('.modal .callout.ok img')`, 120000)
  if (rendered) {
    const dataUrl = await js(`document.querySelector('.modal .callout.ok img').src`)
    fs.writeFileSync(path.join(out, 'world-3-render.png'), Buffer.from(dataUrl.split(',')[1], 'base64'))
  }
  check('La zona importada se renderiza', rendered)
  check('Sin errores en la consola', errors.length === 0, errors.slice(0, 2).join(' | '))
  const failed = results.filter((x) => !x).length
  console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas`)
  app.exit(failed ? 1 : 0)
})
