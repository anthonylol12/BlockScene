// Depuración: arranca la app compilada, ejecuta JS en el renderer y muestra el resultado.
const { app, BrowserWindow } = require('electron')
require('../out/main/index.js')
const code = process.argv[process.argv.length - 1]
app.whenReady().then(async () => {
  let win
  while (!(win = BrowserWindow.getAllWindows()[0])) await new Promise((r) => setTimeout(r, 100))
  win.webContents.on('console-message', (e) => console.log('[console]', e.message))
  await new Promise((r) => win.webContents.once('did-finish-load', r))
  await new Promise((r) => setTimeout(r, 1500))
  try { console.log(JSON.stringify(await win.webContents.executeJavaScript(code), null, 1)) } catch (e) { console.log('ERR', e.message) }
  app.exit(0)
})
