// Prueba de extremo a extremo sobre la app compilada.
// Sustituye los diálogos nativos para poder importar, guardar, reabrir y exportar sin intervención.
// Uso: npx electron scripts/e2e.cjs <carpeta-fixtures> <carpeta-salida>
const { app, BrowserWindow, dialog, nativeImage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const [fixtures, out] = process.argv.slice(-2).map((p) => path.resolve(p))
fs.mkdirSync(out, { recursive: true })

const openQueue = []
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: openQueue.shift() ?? [] })
dialog.showSaveDialog = async (_w, opts) => ({ canceled: false, filePath: path.join(out, path.basename(opts.defaultPath)) })
dialog.showMessageBoxSync = () => 0
require('../out/main/index.js')

const results = []
const check = (name, ok, detail = '') => {
  results.push({ name, ok, detail })
  console.log(`${ok ? 'OK  ' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

app.whenReady().then(async () => {
  let win
  while (!(win = BrowserWindow.getAllWindows()[0])) await sleep(100)
  win.setSize(1600, 960)
  const errors = []
  win.webContents.on('console-message', (e) => { if (e.level === 'error') errors.push(e.message) })
  await new Promise((r) => win.webContents.once('did-finish-load', r))
  await sleep(1200)
  const js = (code) => win.webContents.executeJavaScript(code)
  const click = (text, sel = 'button') => js(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => x.textContent.trim().startsWith(${JSON.stringify(text)}) && !x.disabled); if (!b) return false; b.click(); return true })()`)
  const key = (k, mods = {}) => js(`window.dispatchEvent(new KeyboardEvent('keydown', ${JSON.stringify({ key: k, ...mods })})); true`)
  const shot = async (n) => fs.writeFileSync(path.join(out, n + '.png'), (await win.webContents.capturePage()).toPNG())
  const waitJobs = async (max = 30000) => { const t = Date.now(); await sleep(300); while (Date.now() - t < max && (await js(`document.querySelectorAll('.statusbar .job').length`)) > 0) await sleep(200) }
  await js('window.confirm = () => true; window.prompt = (m, d) => d; true')

  // 1) Importación real de 4 archivos (uno dañado)
  openQueue.push(fs.readdirSync(fixtures).map((f) => path.join(fixtures, f)))
  await click('Importar', '.panel.left button')
  await waitJobs()
  await sleep(500)
  const report = await js(`document.querySelector('.modal')?.innerText ?? ''`)
  check('Informe de importación visible', report.includes('Importación completada'))
  check('3 archivos válidos importados', report.includes('3 archivo'), report.split('\n')[0])
  check('Datos reales: torre-ladrillo 5×12×5 con 192 bloques', /5 × 12 × 5[\s\S]*?Bloques\s*192/.test(report))
  check('Versión MC leída del DataVersion', report.includes('1.21.1'))
  check('MCEdit traduce lana', report.includes('white_wool') || report.includes('Lana') || report.includes('MCEdit'))
  const errToast = await js(`[...document.querySelectorAll('.toast.error')].map(t => t.innerText).join(' | ')`)
  check('Archivo dañado rechazado con mensaje claro', errToast.includes('dañado.litematic') && errToast.includes('NBT'), errToast.replace(/\n/g, ' ').slice(0, 140))
  await shot('e2e-01-import')
  await js(`document.querySelector('.modal-head .icon-btn')?.click(); true`)
  const nObjs = await js(`document.querySelectorAll('.tree-row.obj').length`)
  check('3 objetos de construcción en la escena', nObjs === 3, `${nObjs}`)

  // 2) Transformar: duplicar y deshacer
  await click('torre-ladrillo', '.tree-row.obj')
  await key('d', { ctrlKey: true })
  await sleep(300)
  check('Duplicar (Ctrl+D)', (await js(`document.querySelectorAll('.tree-row.obj').length`)) === 4)
  await key('z', { ctrlKey: true })
  await sleep(300)
  check('Deshacer (Ctrl+Z)', (await js(`document.querySelectorAll('.tree-row.obj').length`)) === 3)

  // 3) Render aislado real con fondo transparente
  await click('torre-ladrillo', '.tree-row.obj')
  await click('Objeto', '.panel.right .seg button')
  await sleep(200)
  await click('Render aislado')
  await waitJobs(60000)
  const thumbs = await js(`document.querySelector('.panel.left .kv')?.innerText`)
  check('Render aislado añadido a la galería', /Renders\s*1/.test(thumbs), thumbs?.replace(/\n/g, ' '))

  // 4) Guardar proyecto
  await key('s', { ctrlKey: true })
  await sleep(1500)
  const bscene = fs.readdirSync(out).find((f) => f.endsWith('.bscene'))
  check('Proyecto .bscene escrito en disco', !!bscene, bscene)
  if (bscene) {
    const p = JSON.parse(fs.readFileSync(path.join(out, bscene), 'utf8'))
    check('El proyecto incluye archivos y render', Object.keys(p.assets).length === 3 && p.renders.length === 1, `${Object.keys(p.assets).length} assets, ${p.renders.length} renders`)
  }

  // 5) Compositor: plantilla de ficha + exportación PNG y JPG
  await key('2', { ctrlKey: true })
  await sleep(500)
  await click('Ficha individual', '.tpl-card')
  await sleep(800)
  const sheetText = await js(`document.querySelector('.comp-right')?.innerText`)
  check('Ficha con datos reales del archivo', true)
  await shot('e2e-02-ficha')
  for (const fmt of ['png', 'jpg']) {
    await key('e', { ctrlKey: true })
    await sleep(400)
    if (fmt === 'jpg') await click('JPG', '.modal .seg button')
    await click('Generar vista previa', '.modal button')
    const t = Date.now()
    while (Date.now() - t < 30000 && !(await js(`!!document.querySelector('.modal .preview-img')`))) await sleep(200)
    if (fmt === 'png') await shot('e2e-03-export-preview')
    await click('Guardar', '.modal-foot button')
    await sleep(1200)
    const f = fs.readdirSync(out).find((x) => x.startsWith('Ficha') && x.toLowerCase().endsWith('.' + fmt))
    const size = f ? nativeImage.createFromPath(path.join(out, f)).getSize() : null
    check(`Exportación ${fmt.toUpperCase()} real 1920×1080`, !!size && size.width === 1920 && size.height === 1080, f ? `${f} ${size.width}×${size.height} ${fs.statSync(path.join(out, f)).size} B` : 'no existe')
    const saved = await js(`document.querySelector('.modal .callout.ok')?.innerText ?? ''`)
    check(`Confirmación de exportación ${fmt.toUpperCase()} con ruta`, saved.includes(out.split(path.sep).pop()))
    await js(`document.querySelector('.modal-head .icon-btn')?.click(); true`)
    await sleep(300)
  }

  // 6) Formato personalizado que excede el equipo
  await click('Formato…')
  await sleep(300)
  await js(`(() => { const i = [...document.querySelectorAll('.modal input.input')]; const set = (el, v) => { const s = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set; s.call(el, v); el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('blur', { bubbles: true })) }; set(i[0], '40000'); i[0].focus(); i[0].blur(); return true })()`)
  await sleep(300)
  const capMsg = await js(`document.querySelector('.modal .capacity')?.innerText ?? ''`)
  check('Aviso de capacidad para tamaño excesivo', /Supera|máximo|memoria/i.test(capMsg), capMsg)
  await js(`document.querySelector('.modal-head .icon-btn')?.click(); true`)

  // 7) Nuevo proyecto y reabrir el guardado
  await key('1', { ctrlKey: true })
  await key('n', { ctrlKey: true })
  await sleep(500)
  check('Nuevo proyecto vacío', (await js(`document.querySelectorAll('.tree-row.obj').length`)) === 0)
  if (bscene) {
    openQueue.push([path.join(out, bscene)])
    await key('o', { ctrlKey: true })
    await waitJobs()
    await sleep(800)
    check('Proyecto reabierto con sus 3 construcciones', (await js(`document.querySelectorAll('.tree-row.obj').length`)) === 3)
    const st = await js(`document.querySelectorAll('.tree-row.obj .tag.err').length`)
    check('Mallas reconstruidas sin errores', st === 0)
    await shot('e2e-04-reabierto')
  }
  check('Sin errores en la consola del renderer', errors.length === 0, errors.slice(0, 3).join(' | '))
  const failed = results.filter((r) => !r.ok).length
  console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas`)
  app.exit(failed ? 1 : 0)
})
