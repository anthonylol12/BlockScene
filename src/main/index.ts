import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join, basename } from 'node:path'
import { promises as fs } from 'node:fs'
import { findInstallations, findMinecraftPacks, listZipNames, readBlockModels, readBlockTextures, readZipFile } from './mcTextures'
import { buildModelFaces } from '../renderer/src/core/blockModels'

const MAX_IMPORT_BYTES = 512 * 1024 * 1024
let win: BrowserWindow | null = null
let dirty = false

function createWindow(): void {
  win = new BrowserWindow({
    width: 1600,
    height: 960,
    minWidth: 1024,
    minHeight: 640,
    backgroundColor: '#16181d',
    title: 'BlockScene',
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false
    }
  })
  win.setMenu(null)
  win.once('ready-to-show', () => win?.show())

  win.on('close', (e) => {
    if (!dirty || !win) return
    const choice = dialog.showMessageBoxSync(win, {
      type: 'warning',
      buttons: ['Salir sin guardar', 'Cancelar'],
      defaultId: 1,
      cancelId: 1,
      title: 'Cambios sin guardar',
      message: 'El proyecto tiene cambios sin guardar.',
      detail: '¿Quieres salir de todos modos? Los cambios se perderán.'
    })
    if (choice === 1) e.preventDefault()
  })

  // Herramientas de desarrollo: Ctrl+Shift+I
  win.webContents.on('before-input-event', (_e, input) => {
    if (input.type === 'keyDown' && input.control && input.shift && input.key.toLowerCase() === 'i') {
      win?.webContents.toggleDevTools()
    }
  })
  // Los enlaces externos se abren en el navegador del sistema
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

const BUILD_EXTS = ['schem', 'schematic', 'litematic', 'nbt', 'mca']

ipcMain.handle('dialog:openBuilds', async () => {
  if (!win) return []
  const r = await dialog.showOpenDialog(win, {
    title: 'Importar construcciones',
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Construcciones de Minecraft', extensions: BUILD_EXTS },
      { name: 'Todos los archivos', extensions: ['*'] }
    ]
  })
  if (r.canceled) return []
  const out: { path: string; name: string; data: Uint8Array | null; error?: string }[] = []
  for (const p of r.filePaths) {
    try {
      const st = await fs.stat(p)
      if (st.size > MAX_IMPORT_BYTES) {
        out.push({ path: p, name: basename(p), data: null, error: `El archivo pesa ${(st.size / 1048576).toFixed(0)} MB; el máximo admitido es 512 MB.` })
        continue
      }
      const buf = await fs.readFile(p)
      out.push({ path: p, name: basename(p), data: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength) })
    } catch (err) {
      out.push({ path: p, name: basename(p), data: null, error: `No se pudo leer el archivo: ${(err as Error).message}` })
    }
  }
  return out
})

ipcMain.handle('dialog:openImages', async () => {
  if (!win) return []
  const r = await dialog.showOpenDialog(win, {
    title: 'Añadir imágenes a la galería',
    properties: ['openFile', 'multiSelections'],
    filters: [{ name: 'Imágenes', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]
  })
  if (r.canceled) return []
  const out: { name: string; data: Uint8Array; mime: string }[] = []
  for (const p of r.filePaths) {
    const buf = await fs.readFile(p)
    const ext = p.split('.').pop()!.toLowerCase()
    out.push({
      name: basename(p),
      data: new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength),
      mime: ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/jpeg'
    })
  }
  return out
})

ipcMain.handle('project:open', async () => {
  if (!win) return null
  const r = await dialog.showOpenDialog(win, {
    title: 'Abrir proyecto',
    properties: ['openFile'],
    filters: [{ name: 'Proyecto BlockScene', extensions: ['bscene'] }]
  })
  if (r.canceled || !r.filePaths[0]) return null
  const p = r.filePaths[0]
  const text = await fs.readFile(p, 'utf8')
  return { path: p, text }
})

ipcMain.handle('project:save', async (_e, args: { path: string | null; text: string; suggestedName: string }) => {
  if (!win) return null
  let target = args.path
  if (!target) {
    const r = await dialog.showSaveDialog(win, {
      title: 'Guardar proyecto',
      defaultPath: `${args.suggestedName || 'Proyecto'}.bscene`,
      filters: [{ name: 'Proyecto BlockScene', extensions: ['bscene'] }]
    })
    if (r.canceled || !r.filePath) return null
    target = r.filePath
  }
  // Escritura atómica: primero a un temporal y luego renombrar
  const tmp = `${target}.tmp`
  await fs.writeFile(tmp, args.text, 'utf8')
  await fs.rename(tmp, target)
  const st = await fs.stat(target)
  return { path: target, size: st.size }
})

ipcMain.handle(
  'file:saveBinary',
  async (_e, args: { suggestedName: string; filterName: string; extensions: string[]; data: Uint8Array }) => {
    if (!win) return null
    const r = await dialog.showSaveDialog(win, {
      title: 'Exportar',
      defaultPath: args.suggestedName,
      filters: [{ name: args.filterName, extensions: args.extensions }]
    })
    if (r.canceled || !r.filePath) return null
    await fs.writeFile(r.filePath, args.data)
    const st = await fs.stat(r.filePath) // comprobamos que el archivo existe realmente
    return { path: r.filePath, size: st.size }
  }
)

ipcMain.handle('shell:showItem', (_e, p: string) => shell.showItemInFolder(p))

const templatesFile = (): string => join(app.getPath('userData'), 'templates.json')
ipcMain.handle('templates:load', async () => {
  try {
    return JSON.parse(await fs.readFile(templatesFile(), 'utf8'))
  } catch {
    return []
  }
})
ipcMain.handle('templates:save', async (_e, list: unknown) => {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(templatesFile(), JSON.stringify(list), 'utf8')
  return true
})

ipcMain.handle('app:info', () => ({
  version: app.getVersion(),
  electron: process.versions.electron,
  chrome: process.versions.chrome,
  gpu: app.getGPUFeatureStatus()
}))

const settingsFile = (): string => join(app.getPath('userData'), 'settings.json')
async function readSettings(): Promise<Record<string, unknown>> {
  try {
    return JSON.parse(await fs.readFile(settingsFile(), 'utf8'))
  } catch {
    return {}
  }
}
async function writeSettings(patch: Record<string, unknown>): Promise<void> {
  const cur = await readSettings()
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(settingsFile(), JSON.stringify({ ...cur, ...patch }), 'utf8')
}

ipcMain.handle('mc:installations', () => findInstallations(app.getPath('appData')))
ipcMain.handle('mc:pickTextureSource', async () => {
  if (!win) return null
  const r = await dialog.showOpenDialog(win, {
    title: 'Elegir el .jar de una versión de Minecraft o un paquete de recursos',
    defaultPath: join(app.getPath('appData'), '.minecraft'),
    properties: ['openFile'],
    filters: [{ name: 'Minecraft (.jar) o paquete de recursos (.zip)', extensions: ['jar', 'zip'] }]
  })
  return r.canceled ? null : (r.filePaths[0] ?? null)
})
// ---- paquetes de texturas instalados (copiados a la carpeta de datos de la app; el primero tiene prioridad)
interface PackEntry { file: string; enabled: boolean }
const packsDir = (): string => join(app.getPath('userData'), 'resourcepacks')
async function getPacks(): Promise<PackEntry[]> {
  const s = await readSettings()
  return Array.isArray(s.packs) ? (s.packs as PackEntry[]) : []
}
const setPacks = (packs: PackEntry[]): Promise<void> => writeSettings({ packs })

/** Texturas de la versión base (si hay) con los paquetes activos aplicados encima, como en Minecraft. */
ipcMain.handle('mc:loadTextures', async (_e, path: string | null) => {
  const merged = new Map<string, Uint8Array>()
  const states: Record<string, unknown> = {}
  const models: Record<string, unknown> = {}
  const addModels = async (src: string): Promise<void> => {
    const m = await readBlockModels(src)
    Object.assign(states, m.states)
    Object.assign(models, m.models)
  }
  if (path) {
    for (const t of await readBlockTextures(path)) merged.set(t.name, t.data)
    await addModels(path)
  }
  const applied: string[] = []
  const active = (await getPacks()).filter((p) => p.enabled)
  for (const p of [...active].reverse()) {
    try {
      const src = join(packsDir(), p.file)
      const tex = await readBlockTextures(src)
      for (const t of tex) merged.set(t.name, t.data)
      await addModels(src) // los paquetes también pueden cambiar modelos y su asignación de texturas
      applied.unshift(p.file) // leído correctamente (aunque solo cambie modelos o la fuente)
    } catch {
      /* paquete dañado: se ignora y se informa abajo */
    }
  }
  if (!merged.size) throw new Error('No se encontraron texturas de bloques (assets/minecraft/textures/block) en las fuentes elegidas')
  if (path) await writeSettings({ texturePath: path })
  return { textures: [...merged].map(([name, data]) => ({ name, data })), faces: buildModelFaces(states, models), applied, failed: active.length - applied.length }
})
ipcMain.handle('mc:savedSource', async () => (await readSettings()).texturePath ?? null)
ipcMain.handle('mc:clearSource', () => writeSettings({ texturePath: null }))

/** Fuente de mapa de bits de Minecraft (ascii.png + su definición de caracteres) desde paquetes o la versión base. */
ipcMain.handle('mc:font', async (_e, path: string | null) => {
  const sources = [...(await getPacks()).filter((x) => x.enabled).map((p) => join(packsDir(), p.file)), ...(path ? [path] : [])]
  // definición de la fuente: proveedores de mapa de bits (ascii, acentos, latín extendido…)
  type Prov = { type?: string; file?: string; chars?: string[]; height?: number; ascent?: number }
  let providers: Prov[] = []
  for (const def of ['assets/minecraft/font/include/default.json', 'assets/minecraft/font/default.json']) {
    for (const src of [...sources].reverse()) {
      const d = await readZipFile(src, def).catch(() => null)
      if (!d) continue
      try {
        const list = (JSON.parse(Buffer.from(d).toString('utf8')).providers ?? []) as Prov[]
        providers = list.filter((p) => p.type === 'bitmap' && p.file && p.chars?.length)
      } catch { /* json no válido */ }
      if (providers.length) break
    }
    if (providers.length) break
  }
  if (!providers.length) providers = [{ type: 'bitmap', file: 'minecraft:font/ascii.png', height: 8, ascent: 7 }]
  const sheets: { png: Uint8Array; chars: string[] | null; height: number; ascent: number }[] = []
  for (const p of providers) {
    const file = `assets/minecraft/textures/${p.file!.replace(/^minecraft:/, '')}`
    for (const src of sources) {
      const png = await readZipFile(src, file).catch(() => null)
      if (png) {
        sheets.push({ png, chars: p.chars ?? null, height: p.height ?? 8, ascent: p.ascent ?? 7 })
        break
      }
    }
  }
  return sheets.length ? sheets : null
})

ipcMain.handle('packs:list', async () => ({
  installed: await getPacks(),
  available: await findMinecraftPacks(app.getPath('appData'))
}))
ipcMain.handle('packs:install', async (_e, src: string | null) => {
  if (!src) {
    if (!win) return null
    const r = await dialog.showOpenDialog(win, {
      title: 'Instalar paquete de texturas',
      defaultPath: join(app.getPath('appData'), '.minecraft', 'resourcepacks'),
      properties: ['openFile'],
      filters: [{ name: 'Paquete de recursos de Minecraft (.zip)', extensions: ['zip'] }]
    })
    if (r.canceled || !r.filePaths[0]) return null
    src = r.filePaths[0]
  }
  const names = await listZipNames(src)
  if (names.some((n) => n.startsWith('shaders/'))) throw new Error('Esto es un shaderpack de OptiFine/Iris, no un paquete de texturas.')
  if (!names.some((n) => n.startsWith('assets/minecraft/textures/'))) throw new Error('El .zip no contiene texturas de Minecraft (assets/minecraft/textures).')
  const file = basename(src)
  await fs.mkdir(packsDir(), { recursive: true })
  await fs.copyFile(src, join(packsDir(), file))
  const packs = (await getPacks()).filter((p) => p.file !== file)
  await setPacks([{ file, enabled: true }, ...packs])
  return { file, blockTextures: names.filter((n) => n.startsWith('assets/minecraft/textures/block/') && n.endsWith('.png')).length }
})
ipcMain.handle('packs:update', async (_e, packs: PackEntry[]) => {
  const prev = await getPacks()
  for (const p of prev) if (!packs.some((x) => x.file === p.file)) await fs.rm(join(packsDir(), p.file), { force: true })
  await setPacks(packs)
  return true
})

// ---- shaders GLSL externos (postprocesado propio de BlockScene; se copian a la carpeta de datos)
interface ShaderEntry { file: string; enabled: boolean; params: Record<string, number> }
const shadersDir = (): string => join(app.getPath('userData'), 'shaders')
async function getShaders(): Promise<ShaderEntry[]> {
  const s = await readSettings()
  return Array.isArray(s.shaders) ? (s.shaders as ShaderEntry[]) : []
}
ipcMain.handle('shaders:list', async () => {
  const out: (ShaderEntry & { source: string | null })[] = []
  for (const sh of await getShaders()) {
    let source: string | null = null
    try {
      source = await fs.readFile(join(shadersDir(), sh.file), 'utf8')
    } catch { /* archivo borrado */ }
    out.push({ ...sh, source })
  }
  return out
})
/** Instala desde una ruta, desde texto (ejemplos incluidos) o pidiendo el archivo. */
ipcMain.handle('shaders:install', async (_e, args: { path?: string; name?: string; text?: string } | null) => {
  let name = args?.name ?? ''
  let text = args?.text ?? ''
  if (!text) {
    let src = args?.path
    if (!src) {
      if (!win) return null
      const r = await dialog.showOpenDialog(win, {
        title: 'Instalar shader GLSL',
        properties: ['openFile'],
        filters: [{ name: 'Shader de BlockScene (.glsl, .frag)', extensions: ['glsl', 'frag', 'fs'] }, { name: 'Shaderpack (.zip)', extensions: ['zip'] }]
      })
      if (r.canceled || !r.filePaths[0]) return null
      src = r.filePaths[0]
    }
    if (src.toLowerCase().endsWith('.zip')) {
      const names = await listZipNames(src)
      if (names.some((n) => n.startsWith('shaders/'))) throw new Error('Es un shaderpack de OptiFine/Iris: no es compatible con BlockScene (está escrito para el motor de Minecraft).')
      throw new Error('El .zip no es un shader de BlockScene. Los shaders externos son archivos .glsl.')
    }
    name = basename(src)
    text = await fs.readFile(src, 'utf8')
  }
  if (!/void\s+main\s*\(/.test(text)) throw new Error('El archivo no contiene una función main(): no parece un shader de fragmentos GLSL.')
  // solo un nombre de archivo, nunca una ruta (evita escribir fuera de la carpeta de shaders)
  name = basename(name.replace(/[\\/]/g, '_')).replace(/[<>:"|?*\u0000-\u001f]/g, '_').replace(/^\.+/, '') || 'shader.glsl'
  if (!name.toLowerCase().endsWith('.glsl')) name = `${name.replace(/\.[^.]+$/, '')}.glsl`
  await fs.mkdir(shadersDir(), { recursive: true })
  await fs.writeFile(join(shadersDir(), name), text, 'utf8')
  const list = (await getShaders()).filter((s) => s.file !== name)
  await writeSettings({ shaders: [...list, { file: name, enabled: true, params: {} }] })
  return { file: name, source: text }
})
ipcMain.handle('shaders:update', async (_e, list: ShaderEntry[]) => {
  for (const s of await getShaders()) if (!list.some((x) => x.file === s.file)) await fs.rm(join(shadersDir(), s.file), { force: true })
  await writeSettings({ shaders: list })
  return true
})
ipcMain.handle('shaders:openFolder', async () => {
  await fs.mkdir(shadersDir(), { recursive: true })
  return shell.openPath(shadersDir())
})

// ---- preferencias de controles y herramientas
ipcMain.handle('prefs:load', async () => (await readSettings()).prefs ?? null)
ipcMain.handle('prefs:save', (_e, prefs: unknown) => writeSettings({ prefs }))

// ---- estilos visuales instalados
const looksFile = (): string => join(app.getPath('userData'), 'looks.json')
ipcMain.handle('looks:load', async () => {
  try {
    return JSON.parse(await fs.readFile(looksFile(), 'utf8'))
  } catch {
    return []
  }
})
ipcMain.handle('looks:save', async (_e, list: unknown) => {
  await fs.mkdir(app.getPath('userData'), { recursive: true })
  await fs.writeFile(looksFile(), JSON.stringify(list), 'utf8')
  return true
})
ipcMain.handle('looks:pick', async () => {
  if (!win) return null
  const r = await dialog.showOpenDialog(win, {
    title: 'Instalar estilo visual',
    properties: ['openFile'],
    filters: [{ name: 'Estilo de BlockScene (.bslook) o shaderpack', extensions: ['bslook', 'json', 'zip'] }]
  })
  if (r.canceled || !r.filePaths[0]) return null
  const p = r.filePaths[0]
  if (p.toLowerCase().endsWith('.zip')) {
    let shader = false
    try {
      shader = (await listZipNames(p)).some((n) => n.startsWith('shaders/'))
    } catch { /* no es zip legible */ }
    return { kind: shader ? 'shaderpack' : 'zip', name: basename(p) }
  }
  return { kind: 'look', name: basename(p).replace(/\.(bslook|json)$/i, ''), text: await fs.readFile(p, 'utf8') }
})

ipcMain.on('app:setDirty', (_e, d: boolean) => {
  dirty = d
})
ipcMain.on('app:setTitle', (_e, t: string) => win?.setTitle(t))

// Abrir proyectos .bscene con doble clic (asociación de archivos del instalador)
const projectArg = (argv: string[]): string | null => argv.slice(1).find((a) => a.toLowerCase().endsWith('.bscene')) ?? null
let pendingProject = projectArg(process.argv)
ipcMain.handle('project:initial', async () => {
  const p = pendingProject
  pendingProject = null
  if (!p) return null
  try {
    return { path: p, text: await fs.readFile(p, 'utf8') }
  } catch (e) {
    return { path: p, error: (e as Error).message }
  }
})
// una sola instancia: si ya hay una abierta, le pasamos el archivo y salimos sin crear ventana
const primary = app.requestSingleInstanceLock()
if (!primary) app.exit(0)
app.on('second-instance', (_e, argv) => {
  if (!win) return
  if (win.isMinimized()) win.restore()
  win.focus()
  const p = projectArg(argv)
  if (p) {
    pendingProject = p
    win.webContents.send('project:openRequested')
  }
})

app.whenReady().then(() => {
  if (!primary) return
  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
