// Prueba de shaders externos, instalación por arrastre y preferencias. Deja la configuración como estaba.
// Uso: npx electron scripts/smoke-tools.cjs <carpeta-salida>
const { app, BrowserWindow } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const out = path.resolve(process.argv[process.argv.length - 1])
fs.mkdirSync(out, { recursive: true })
require('../out/main/index.js')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  let win
  while (!(win = BrowserWindow.getAllWindows()[0])) await sleep(100)
  win.setSize(1600, 960)
  const errors = []
  win.webContents.on('console-message', (e) => { if (e.level === 'error') errors.push(e.message) })
  await new Promise((r) => win.webContents.once('did-finish-load', r))
  await sleep(4000)
  const js = (c) => win.webContents.executeJavaScript(c)
  const click = (text, sel = 'button') => js(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => x.textContent.trim().startsWith(${JSON.stringify(text)}) && !x.disabled); if (!b) return 'NO ' + ${JSON.stringify(text)}; b.click(); return 'ok' })()`)
  const shot = async (n) => fs.writeFileSync(path.join(out, n + '.png'), (await win.webContents.capturePage()).toPNG())
  const toasts = () => js(`[...document.querySelectorAll('.toast')].map(t => t.innerText.replace(/\\n/g, ' ')).join(' | ')`)
  const closeToasts = () => js(`document.querySelectorAll('.toast .icon-btn').forEach(b => b.click()); true`)
  await js('window.confirm = () => true; window.prompt = (m, d) => d; true')
  const before = await js(`Promise.all([window.api.shadersList(), window.api.looksLoad()]).then(([s, l]) => ({ s: s.length, l: l.length }))`)
  console.log('estado previo:', JSON.stringify(before))

  await click('Escena de ejemplo')
  await sleep(5000)
  await click('Render', '.panel.right .seg button')
  await click('Exhibición oscura', '.panel.right .tpl-card')
  await sleep(800)
  // instalar todos los ejemplos
  for (let i = 0; i < 5; i++) {
    await js(`(() => { const sel = document.querySelector('select[aria-label="Shaders de ejemplo"]'); if (!sel || sel.options.length < 2) return false; const set = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set; set.call(sel, sel.options[1].value); sel.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
    await sleep(200)
    await js(`(() => { const b = [...document.querySelectorAll('.panel.right button')].find(x => x.textContent.trim() === 'Instalar' && !x.disabled && x.previousElementSibling?.getAttribute('aria-label') === 'Shaders de ejemplo'); b?.click(); return !!b })()`)
    await sleep(1500)
  }
  const list = await js(`window.api.shadersList().then(l => l.map(s => s.file))`)
  console.log('ejemplos instalados:', list.join(', '))
  console.log('con error de compilación:', await js(`document.querySelectorAll('.panel.right .tag.err').length`))
  await closeToasts()
  // dejar activos solo contorno cel y teal-naranja para la captura
  await js(`window.api.shadersList().then(l => window.api.shadersUpdate(l.map(s => ({ file: s.file, enabled: /contorno|teal/.test(s.file), params: s.params }))))`)
  await js(`(() => { document.querySelector('.panel.right .seg button')?.click(); return true })()`)
  await click('Render', '.panel.right .seg button')
  await sleep(300)
  // recargar la pila desde disco (como al reiniciar)
  win.webContents.reload()
  await new Promise((r) => win.webContents.once('did-finish-load', r))
  await sleep(4000)
  await js('window.confirm = () => true; true')
  await click('Escena de ejemplo')
  await sleep(5000)
  await click('Render', '.panel.right .seg button')
  await click('Exhibición oscura', '.panel.right .tpl-card')
  await sleep(500)
  await closeToasts()
  await click('¾')
  await sleep(1500)
  await shot('tools-01-shaders')

  // arrastrar un shader roto y un estilo
  await js(`(() => {
    const dt = new DataTransfer()
    dt.items.add(new File(['// @name Roto\\nvoid main() { gl_FragColor = vec4(1.0) }'], 'roto.glsl'))
    dt.items.add(new File([JSON.stringify({ format: 'blockscene-look', version: 1, name: 'Arrastrado', env: { post: { vignette: 0.8 } } })], 'arrastrado.bslook'))
    document.querySelector('.app').dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }))
    return true
  })()`)
  await sleep(2500)
  console.log('avisos tras arrastrar:', await toasts())
  await shot('tools-02-drop')
  await closeToasts()

  // preferencias
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: ',', ctrlKey: true })); true`)
  await sleep(600)
  await shot('tools-03-prefs')
  console.log('preferencias visibles:', await js(`!!document.querySelector('.modal') && document.querySelector('.modal-head h3').textContent`))

  // limpieza: volver al estado previo
  await js(`window.api.shadersUpdate([]).then(() => window.api.looksLoad()).then(l => window.api.looksSave(l.filter(x => x.name !== 'Arrastrado')))`)
  console.log('estado final:', JSON.stringify(await js(`Promise.all([window.api.shadersList(), window.api.looksLoad()]).then(([s, l]) => ({ s: s.length, l: l.length }))`)))
  console.log('errores consola:', errors.filter((e) => !/Shader Error|roto|ERROR: 0:/.test(e)).slice(0, 3))
  app.exit(0)
})
