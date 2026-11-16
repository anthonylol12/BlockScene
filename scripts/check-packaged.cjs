// Comprueba la app empaquetada: la lanza con depuración remota, espera a que cargue la interfaz,
// verifica que el visor 3D arrancó y guarda una captura. Uso: node scripts/check-packaged.cjs <exe> <salida.png>
const { spawn } = require('node:child_process')
const fs = require('node:fs')
const [exe, outPng, projectFile] = process.argv.slice(2)
const PORT = 9333
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const child = spawn(exe, [`--remote-debugging-port=${PORT}`, ...(projectFile ? [projectFile] : [])], { stdio: 'ignore' })
  let exited = null
  child.on('exit', (c) => (exited = c))
  let page
  for (let i = 0; i < 60 && !page; i++) {
    await sleep(500)
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
      page = list.find((t) => t.type === 'page')
    } catch { /* aún arrancando */ }
  }
  if (!page) throw new Error('La app empaquetada no abrió ninguna ventana' + (exited != null ? ` (salió con código ${exited})` : ''))
  const ws = new WebSocket(page.webSocketDebuggerUrl)
  await new Promise((r) => (ws.onopen = r))
  let id = 0
  const pending = new Map()
  ws.onmessage = (m) => { const d = JSON.parse(m.data); pending.get(d.id)?.(d); pending.delete(d.id) }
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })) })
  await sleep(4000)
  const r = await send('Runtime.evaluate', { expression: `JSON.stringify({ title: document.title, canvas: !!document.querySelector('.viewport canvas'), menus: [...document.querySelectorAll('.menu-btn')].map(b => b.textContent), api: typeof window.api, objetos: document.querySelectorAll('.tree-row.obj').length, nombre: document.querySelector('.panel.left input')?.value })`, returnByValue: true })
  console.log('estado:', r.result.result.value)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(outPng, Buffer.from(shot.result.data, 'base64'))
  console.log('captura:', outPng, '· proceso vivo:', exited == null)
  ws.close()
  child.kill()
  process.exit(0)
})().catch((e) => { console.error('ERROR', e.message); process.exit(1) })
