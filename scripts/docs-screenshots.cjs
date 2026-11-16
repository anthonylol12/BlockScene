// Genera las capturas de la documentación (docs/images) recorriendo la app real.
// Uso: npm run build && npx electron scripts/docs-screenshots.cjs <carpeta-con-construcciones-de-prueba>
const { app, BrowserWindow, dialog, nativeImage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const fixtures = path.resolve(process.argv[process.argv.length - 1])
const out = path.resolve(__dirname, '..', 'docs', 'images')
fs.mkdirSync(out, { recursive: true })
const openQueue = []
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: openQueue.shift() ?? [] })
let saveAs = 'export.png'
dialog.showSaveDialog = async () => ({ canceled: false, filePath: path.join(out, saveAs) })
require('../out/main/index.js')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  let win
  while (!(win = BrowserWindow.getAllWindows()[0])) await sleep(100)
  win.setSize(1600, 960)
  await new Promise((r) => win.webContents.once('did-finish-load', r))
  await sleep(4500)
  const js = (c) => win.webContents.executeJavaScript(c)
  const click = (text, sel = 'button') => js(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => x.textContent.trim().startsWith(${JSON.stringify(text)}) && !x.disabled); if (!b) return 'NO ' + ${JSON.stringify(text)}; b.click(); return 'ok' })()`)
  const key = (k, mods = {}) => js(`window.dispatchEvent(new KeyboardEvent('keydown', ${JSON.stringify({ key: k, ...mods })})); true`)
  const quiet = () => js(`document.querySelectorAll('.toast .icon-btn').forEach(b => b.click()); true`)
  const closeModal = () => js(`document.querySelector('.modal-head .icon-btn')?.click(); true`)
  const setSelect = (label, value) => js(`(() => { const f = [...document.querySelectorAll('.panel.right .field')].find(x => x.querySelector('.lbl')?.textContent === ${JSON.stringify(label)}); const sel = f?.querySelector('select'); if (!sel) return 'NO'; Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, ${JSON.stringify(value)}); sel.dispatchEvent(new Event('change', { bubbles: true })); return 'ok' })()`)
  const scrollPanel = (title) => js(`(() => { const s = [...document.querySelectorAll('.panel.right summary')].find(x => x.textContent.trim().startsWith(${JSON.stringify(title)})); s?.scrollIntoView({ block: 'start' }); return !!s })()`)
  const shot = async (name) => {
    await quiet()
    await sleep(350)
    const img = (await win.webContents.capturePage()).resize({ width: 1600, quality: 'best' })
    fs.writeFileSync(path.join(out, name + '.png'), img.toPNG())
    console.log('captura', name)
  }
  const waitRender = async () => { for (let i = 0; i < 160 && !(await js(`!!document.querySelector('.modal .callout.ok img')`)); i++) await sleep(500) }
  await js('window.confirm = () => true; window.prompt = (m, d) => d; true')

  await shot('01-inicio')

  // importar archivos reales y ver el informe
  openQueue.push(fs.readdirSync(fixtures).filter((f) => !f.includes('dañado')).map((f) => path.join(fixtures, f)))
  await click('Importar', '.panel.left button')
  await sleep(4000)
  await shot('02-informe-importacion')
  await closeModal()

  // escena de ejemplo con texturas de Minecraft
  await key('n', { ctrlKey: true })
  await sleep(500)
  await click('Escena de ejemplo')
  await sleep(6000)
  await click('Render', '.panel.right .seg button')
  await click('Mundo natural', '.panel.right .tpl-card')
  await sleep(500)
  await click('¾')
  await sleep(1500)
  await scrollPanel('Bloques de Minecraft')
  await shot('03-estudio-texturas')

  await click('EJEMPLO', '.tree-row.obj')
  await click('Objeto', '.panel.right .seg button')
  await sleep(500)
  await shot('04-propiedades-objeto')

  await click('Escena', '.panel.right .seg button')
  await sleep(300)
  await shot('05-ambiente')

  // estilo de exhibición
  await key('Escape')
  await click('Render', '.panel.right .seg button')
  await click('Exhibición oscura', '.panel.right .tpl-card')
  await sleep(1200)
  await scrollPanel('Estilo visual')
  await shot('06-estilos-visuales')

  // shaders externos (se desinstala al final)
  await scrollPanel('Shaders externos')
  await js(`(() => { const sel = document.querySelector('select[aria-label="Shaders de ejemplo"]'); const o = [...sel.options].find(x => x.textContent === 'Contorno cel'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value').set.call(sel, o.value); sel.dispatchEvent(new Event('change', { bubbles: true })); return true })()`)
  await sleep(200)
  await js(`(() => { const b = [...document.querySelectorAll('.panel.right button')].find(x => x.textContent.trim() === 'Instalar' && x.previousElementSibling?.getAttribute('aria-label') === 'Shaders de ejemplo'); b?.click(); return true })()`)
  await sleep(2000)
  await js(`(() => { const r = [...document.querySelectorAll('.panel.right .tree-row')].find(x => x.textContent.includes('Contorno cel')); r?.click(); return true })()`)
  await sleep(500)
  await scrollPanel('Shaders externos')
  await shot('07-shaders')
  await js(`window.api.shadersUpdate([]).then(() => true)`)
  await js(`location.hash = ''; true`)

  // render final
  await key('F12')
  await sleep(600)
  await js(`(() => { [...document.querySelectorAll('.modal .seg button')].find(b => b.textContent === '16')?.click(); return true })()`)
  await shot('08-render-final')
  await click('Render final', '.modal-foot button')
  await waitRender()
  await shot('09-render-resultado')
  await closeModal()

  // compositor: plantilla de exhibición y exportación
  await key('2', { ctrlKey: true })
  await sleep(700)
  await click('Exhibición', '.comp-left .tpl-card')
  await sleep(1500)
  await shot('10-compositor-exhibicion')
  await key('e', { ctrlKey: true })
  await sleep(400)
  await click('Generar vista previa', '.modal button')
  for (let i = 0; i < 60 && !(await js(`!!document.querySelector('.modal .preview-img')`)); i++) await sleep(300)
  await shot('11-exportar')
  saveAs = 'ejemplo-exhibicion.png'
  await click('Guardar', '.modal-foot button')
  await sleep(1500)
  await closeModal()

  // isla de terreno + estilo pastel + render transparente + plantilla de paquete
  await key('1', { ctrlKey: true })
  await sleep(500)
  await click('Base de exhibición', '.tree-row.obj')
  await click('Objeto', '.panel.right .seg button')
  await sleep(300)
  await setSelect('Forma', 'island')
  await sleep(500)
  await setSelect('Terreno', 'verde')
  await sleep(800)
  await js(`[...document.querySelectorAll('.tree-row.obj')].filter(r => /Árbol|Roca|Farola/.test(r.textContent)).forEach(r => r.querySelector('button[aria-label="Ocultar"]')?.click()); true`)
  await click('Render', '.panel.right .seg button')
  await click('Paquete pastel', '.panel.right .tpl-card')
  await sleep(1200)
  await click('Objeto', '.panel.right .seg button')
  await sleep(300)
  await shot('12-isla-de-terreno')
  await key('F12')
  await sleep(500)
  await js(`(() => { [...document.querySelectorAll('.modal .seg button')].find(b => b.textContent === '16')?.click(); const f = [...document.querySelectorAll('.modal .field')].find(x => x.textContent.startsWith('Fondo transparente')); f?.querySelector('input')?.click(); return true })()`)
  await click('Render final', '.modal-foot button')
  await waitRender()
  await closeModal()
  await key('2', { ctrlKey: true })
  await sleep(600)
  await click('Paquete de construcciones', '.comp-left .tpl-card')
  await sleep(1500)
  await shot('13-compositor-paquete')
  await key('e', { ctrlKey: true })
  await sleep(400)
  await click('Generar vista previa', '.modal button')
  for (let i = 0; i < 60 && !(await js(`!!document.querySelector('.modal .preview-img')`)); i++) await sleep(300)
  saveAs = 'ejemplo-paquete.png'
  await click('Guardar', '.modal-foot button')
  await sleep(1500)
  await closeModal()

  // preferencias
  await key('1', { ctrlKey: true })
  await key(',', { ctrlKey: true })
  await sleep(600)
  await shot('14-preferencias')
  await closeModal()

  // reducir las láminas exportadas para la documentación
  for (const f of ['ejemplo-exhibicion.png', 'ejemplo-paquete.png']) {
    const p = path.join(out, f)
    if (fs.existsSync(p)) fs.writeFileSync(p, nativeImage.createFromPath(p).resize({ width: 1280, quality: 'best' }).toPNG())
  }
  console.log('listo:', fs.readdirSync(out).length, 'imágenes')
  app.exit(0)
})
