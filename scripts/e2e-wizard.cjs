// Prueba de extremo a extremo del asistente de primera escena y de «Añadir a lámina».
// Uso: npm run build && npx electron scripts/e2e-wizard.cjs <carpeta-fixtures> <carpeta-salida>
const { app, BrowserWindow, dialog } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const [fixtures, out] = process.argv.slice(-2).map((p) => path.resolve(p))
fs.mkdirSync(out, { recursive: true })
const openQueue = []
dialog.showOpenDialog = async () => ({ canceled: false, filePaths: openQueue.shift() ?? [] })
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
  await sleep(4000)
  const js = (c) => win.webContents.executeJavaScript(c)
  const click = (text, sel = 'button') => js(`(() => { const b = [...document.querySelectorAll(${JSON.stringify(sel)})].find(x => x.textContent.trim().startsWith(${JSON.stringify(text)}) && !x.disabled); if (!b) return false; b.click(); return true })()`)
  const wiz = (expr) => js(`(() => { const w = document.querySelector('.wizard'); return ${expr} })()`)
  const until = async (expr, ms = 30000) => { const t = Date.now(); while (Date.now() - t < ms) { if (await js(expr)) return true; await sleep(250) } return false }
  const shot = async (n) => fs.writeFileSync(path.join(out, n + '.png'), (await win.webContents.capturePage()).toPNG())
  await js('window.confirm = () => true; true')

  // entrada desde la pantalla vacía
  check('Botón «Crear escena paso a paso» en el visor vacío', await click('Crear escena paso a paso', '.vp-empty button'))
  check('El asistente se abre', await until(`!!document.querySelector('.wizard')`, 3000))

  // paso 1: archivo dañado → error comprensible dentro del panel
  openQueue.push([path.join(fixtures, 'dañado.litematic')])
  await click('Elegir archivo', '.wizard button')
  await until(`!!document.querySelector('.wizard .callout.err')`, 15000)
  const err = await wiz(`w.querySelector('.callout.err')?.innerText ?? ''`)
  check('Archivo dañado: error dentro del asistente', /dañado\.litematic/.test(err) && /NBT/.test(err), err.replace(/\n/g, ' ').slice(0, 110))
  check('Sin construcción no se puede avanzar', await wiz(`[...w.querySelectorAll('.wizard-foot button')].find(b => b.textContent.includes('Siguiente'))?.disabled === true`))

  // paso 1: casa de ejemplo con vista previa de sus datos
  await click('Usar la casa de ejemplo', '.wizard button')
  check('Vista previa con datos reales del archivo', await until(`/13 × 12 × 11/.test(document.querySelector('.wizard')?.innerText) && /477/.test(document.querySelector('.wizard')?.innerText)`))
  check('Malla lista y paso desbloqueado', await until(`[...document.querySelectorAll('.wizard-foot button')].some(b => b.textContent.includes('Siguiente') && !b.disabled)`))
  await shot('wizard-1-construccion')
  await click('Siguiente', '.wizard-foot button')

  // paso 2: texturas
  check('Paso de texturas reutiliza el panel de Bloques de Minecraft', await until(`/Usar mi Minecraft|Usando/.test(document.querySelector('.wizard')?.innerText)`, 3000))
  await click('Siguiente', '.wizard-foot button')

  // paso 3: base ajustada
  await click('Isla verde', '.wizard .tpl-card')
  await sleep(1500)
  const base = await js(`[...document.querySelectorAll('.tree-row.obj')].map(r => r.textContent).join('|')`)
  check('Se crea la base «Isla verde»', /Isla verde/.test(base))
  await click('Base de exhibición', '.wizard .tpl-card')
  await sleep(800)
  const objs = await js(`[...document.querySelectorAll('.tree-row.obj')].map(r => r.textContent.trim())`)
  check('Cambiar de base reutiliza el mismo objeto', objs.length === 2 && objs.some((t) => /Base de exhibición/.test(t)), objs.join(' | '))
  await click('Isla verde', '.wizard .tpl-card')
  await sleep(1200)
  await click('Siguiente', '.wizard-foot button')

  // paso 4: estilo recomendado con explicación
  const look = await wiz(`[...w.querySelectorAll('.tpl-card')].find(c => c.textContent.includes('Paquete pastel'))?.innerText ?? ''`)
  check('Estilo recomendado según la base, con lo que cambia', /RECOMENDADO/.test(look) && /fondo de estudio/.test(look), look.replace(/\n/g, ' ').slice(0, 120))
  await click('Paquete pastel', '.wizard .tpl-card')
  await sleep(1200)
  await click('Siguiente', '.wizard-foot button')

  // paso 5: plantilla recomendada, render y lámina
  check('Plantilla recomendada preseleccionada (Paquete)', await wiz(`w.querySelector('.tpl-card.sel')?.textContent.includes('Paquete de construcciones')`))
  await click('Rápida', '.wizard .seg button')
  await shot('wizard-5-render')
  await click('Renderizar y crear lámina', '.wizard button')
  check('Render terminado y lámina creada', await until(`/Listo/.test(document.querySelector('.wizard')?.innerText ?? '')`, 90000))
  const comp = await js(`({ ws: document.querySelector('.ws-tab.active')?.textContent.trim(), name: document.querySelector('.comp-toolbar b')?.textContent, imgs: [...document.querySelectorAll('.comp-right .tree-row')].filter(r => r.textContent.includes('Construcción')).length })`)
  check('Se abre el Compositor con la plantilla Paquete', /Compositor/.test(comp.ws) && comp.name === 'Paquete de construcciones', JSON.stringify(comp))
  const transp = await js(`(() => { const t = document.querySelector('.gallery .thumb img'); return t ? t.naturalWidth + 'x' + t.naturalHeight : '' })()`)
  check('El render salió recortado (fondo transparente)', !!transp && transp !== '1920x1080', transp)
  await shot('wizard-6-lamina')
  await click('Cerrar', '.wizard button')
  check('El asistente se cierra conservando el trabajo', !(await js(`!!document.querySelector('.wizard')`)) && (await js(`document.querySelectorAll('.page-tab').length`)) >= 1)

  // «Añadir a lámina» desde el diálogo de render
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: '1', ctrlKey: true })); true`)
  await sleep(500)
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'F12' })); true`)
  await sleep(500)
  await click('Vista previa rápida', '.modal-foot button')
  await until(`!!document.querySelector('.modal .callout.ok img')`, 60000)
  check('Botón «Añadir a lámina» tras el render', await click('Añadir a lámina', '.modal button'))
  await sleep(1000)
  // el Compositor solo está montado en su pestaña: se cuentan las láminas allí (la del asistente + la nueva)
  const after = await js(`({ n: document.querySelectorAll('.page-tab').length, name: document.querySelector('.comp-toolbar b')?.textContent, modal: !!document.querySelector('.modal'), hero: [...document.querySelectorAll('.comp-right .tree-row')].some(r => r.textContent.includes('Render')) })`)
  check('Crea una lámina Exhibición con ese render y abre el Compositor', after.n === 2 && after.name === 'Exhibición' && !after.modal, JSON.stringify(after))

  // atajo de teclado
  await js(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'N', ctrlKey: true, shiftKey: true })); true`)
  check('Ctrl+Mayús+N abre el asistente', await until(`!!document.querySelector('.wizard')`, 2000))
  check('Sin errores en la consola', errors.length === 0, errors.slice(0, 2).join(' | '))
  const failed = results.filter((x) => !x).length
  console.log(`\n${results.length - failed}/${results.length} comprobaciones superadas`)
  app.exit(failed ? 1 : 0)
})
