import { contextBridge, ipcRenderer, webUtils } from 'electron'

const api = {
  openBuilds: (): Promise<{ path: string; name: string; data: Uint8Array | null; error?: string }[]> =>
    ipcRenderer.invoke('dialog:openBuilds'),
  openImages: (): Promise<{ name: string; data: Uint8Array; mime: string }[]> => ipcRenderer.invoke('dialog:openImages'),
  openProject: (): Promise<{ path: string; text: string } | null> => ipcRenderer.invoke('project:open'),
  saveProject: (args: { path: string | null; text: string; suggestedName: string }): Promise<{ path: string; size: number } | null> =>
    ipcRenderer.invoke('project:save', args),
  saveBinary: (args: {
    suggestedName: string
    filterName: string
    extensions: string[]
    data: Uint8Array
  }): Promise<{ path: string; size: number } | null> => ipcRenderer.invoke('file:saveBinary', args),
  showItem: (p: string): Promise<void> => ipcRenderer.invoke('shell:showItem', p),
  loadTemplates: (): Promise<unknown[]> => ipcRenderer.invoke('templates:load'),
  saveTemplates: (list: unknown[]): Promise<boolean> => ipcRenderer.invoke('templates:save', list),
  appInfo: (): Promise<{ version: string; electron: string; chrome: string; gpu: Record<string, string> }> =>
    ipcRenderer.invoke('app:info'),
  mcInstallations: (): Promise<{ version: string; path: string }[]> => ipcRenderer.invoke('mc:installations'),
  mcPickTextureSource: (): Promise<string | null> => ipcRenderer.invoke('mc:pickTextureSource'),
  mcLoadTextures: (path: string | null): Promise<{ textures: { name: string; data: Uint8Array }[]; faces: Record<string, [string, string, string]>; applied: string[]; failed: number }> =>
    ipcRenderer.invoke('mc:loadTextures', path),
  mcFont: (path: string | null): Promise<{ png: Uint8Array; chars: string[] | null; height: number; ascent: number }[] | null> => ipcRenderer.invoke('mc:font', path),
  packsList: (): Promise<{ installed: { file: string; enabled: boolean }[]; available: { name: string; path: string }[] }> => ipcRenderer.invoke('packs:list'),
  packsInstall: (src: string | null): Promise<{ file: string; blockTextures: number } | null> => ipcRenderer.invoke('packs:install', src),
  packsUpdate: (packs: { file: string; enabled: boolean }[]): Promise<boolean> => ipcRenderer.invoke('packs:update', packs),
  shadersList: (): Promise<{ file: string; enabled: boolean; params: Record<string, number>; source: string | null }[]> => ipcRenderer.invoke('shaders:list'),
  shadersInstall: (args: { path?: string; name?: string; text?: string } | null): Promise<{ file: string; source: string } | null> =>
    ipcRenderer.invoke('shaders:install', args),
  shadersUpdate: (list: { file: string; enabled: boolean; params: Record<string, number> }[]): Promise<boolean> => ipcRenderer.invoke('shaders:update', list),
  shadersOpenFolder: (): Promise<string> => ipcRenderer.invoke('shaders:openFolder'),
  prefsLoad: (): Promise<unknown> => ipcRenderer.invoke('prefs:load'),
  prefsSave: (prefs: unknown): Promise<void> => ipcRenderer.invoke('prefs:save', prefs),
  /** ruta real de un archivo arrastrado a la ventana */
  pathForFile: (f: File): string => webUtils.getPathForFile(f),
  looksLoad: (): Promise<unknown[]> => ipcRenderer.invoke('looks:load'),
  looksSave: (list: unknown[]): Promise<boolean> => ipcRenderer.invoke('looks:save', list),
  looksPick: (): Promise<{ kind: 'look' | 'shaderpack' | 'zip'; name: string; text?: string } | null> => ipcRenderer.invoke('looks:pick'),
  mcSavedSource: (): Promise<string | null> => ipcRenderer.invoke('mc:savedSource'),
  mcClearSource: (): Promise<void> => ipcRenderer.invoke('mc:clearSource'),
  initialProject: (): Promise<{ path: string; text?: string; error?: string } | null> => ipcRenderer.invoke('project:initial'),
  onOpenRequested: (fn: () => void): void => {
    ipcRenderer.on('project:openRequested', () => fn())
  },
  setDirty: (d: boolean): void => ipcRenderer.send('app:setDirty', d),
  worldList: (): Promise<{ path: string; folder: string; modified: number }[]> => ipcRenderer.invoke('world:list'),
  worldPick: (): Promise<string | { error: string } | null> => ipcRenderer.invoke('world:pick'),
  worldInfo: (worldPath: string): Promise<{ level: Uint8Array; dims: Record<string, { dir: string; count: number }>; folder: string } | { error: string }> => ipcRenderer.invoke('world:info', worldPath),
  worldReadRegions: (args: { worldPath: string; dimDir: string; files: string[] }): Promise<{ file: string; data: Uint8Array | null }[]> => ipcRenderer.invoke('world:readRegions', args),
  setTitle: (t: string): void => ipcRenderer.send('app:setTitle', t)
}

export type BlockSceneApi = typeof api
contextBridge.exposeInMainWorld('api', api)
