import { create } from 'zustand'
import type {
  CameraView, CompElement, Composition, EnvironmentSettings, Layer, Project, RenderItem, SceneObject, Transform
} from '@shared/types'
import { newProject, uid } from './defaults'

export type Workspace = 'studio' | 'compositor'
export type TransformMode = 'translate' | 'rotate' | 'scale'

export interface Job {
  id: string
  label: string
  progress: number // 0..1, -1 = indeterminado
  stage?: string
}
export interface Toast {
  id: string
  kind: 'info' | 'success' | 'error' | 'warning'
  title: string
  detail?: string
  action?: { label: string; run: () => void }
}
export type AssetStatus = { state: 'loading' | 'ready' | 'error'; message?: string; faces?: number; untextured?: number }

type Snapshot = Pick<Project, 'layers' | 'objects' | 'compositions' | 'cameras' | 'mainCameraId'>

export type ModalState =
  | null
  | { type: 'importReport'; assetIds: string[] }
  | { type: 'formats' }
  | { type: 'render' }
  | { type: 'export' }
  | { type: 'shortcuts' }
  | { type: 'about' }
  | { type: 'renderView'; renderId: string }
  | { type: 'pageSetup' }
  | { type: 'prefs' }

interface State {
  project: Project
  projectPath: string | null
  dirty: boolean
  workspace: Workspace
  selectedId: string | null
  transformMode: TransformMode
  assetStatus: Record<string, AssetStatus>
  jobs: Job[]
  toasts: Toast[]
  modal: ModalState
  undoStack: Snapshot[]
  redoStack: Snapshot[]
  compSelectedId: string | null
  turntable: { playing: boolean; speed: number }
  sunCycle: boolean

  setWorkspace(w: Workspace): void
  setModal(m: ModalState): void
  loadProject(p: Project, path: string | null): void
  markSaved(path: string): void
  setProjectName(n: string): void

  commit(): void
  undo(): void
  redo(): void

  addObject(o: SceneObject, select?: boolean): void
  updateObject(id: string, patch: Partial<SceneObject>, record?: boolean): void
  setParams(id: string, params: Record<string, number | string | boolean>, record?: boolean): void
  setTransform(id: string, t: Transform, record?: boolean): void
  removeObjects(ids: string[]): void
  duplicateObject(id: string): void
  select(id: string | null): void
  setTransformMode(m: TransformMode): void

  addLayer(name?: string): void
  updateLayer(id: string, patch: Partial<Layer>): void
  removeLayer(id: string): void

  setEnv(patch: Partial<EnvironmentSettings>): void
  setEnvSub<K extends 'clouds' | 'fog' | 'material' | 'quality' | 'background' | 'post'>(key: K, patch: Partial<EnvironmentSettings[K]>): void

  addCamera(c: CameraView): void
  updateCamera(id: string, patch: Partial<CameraView>): void
  removeCamera(id: string): void
  setMainCamera(id: string | null): void

  addRender(r: RenderItem): void
  removeRender(id: string): void
  renameRender(id: string, name: string): void

  addComposition(c: Composition, activate?: boolean): void
  updateComposition(id: string, patch: Partial<Composition>, record?: boolean): void
  removeComposition(id: string): void
  setActiveComposition(id: string): void
  addElement(compId: string, el: CompElement): void
  updateElement(compId: string, elId: string, patch: Partial<CompElement>, record?: boolean): void
  removeElement(compId: string, elId: string): void
  reorderElement(compId: string, elId: string, dir: 'up' | 'down' | 'top' | 'bottom'): void
  selectElement(id: string | null): void
  setCustomTemplates(t: Composition[]): void

  setAssetStatus(id: string, s: AssetStatus): void
  startJob(label: string): string
  updateJob(id: string, progress: number, stage?: string): void
  endJob(id: string): void
  toast(t: Omit<Toast, 'id'>, ms?: number): void
  dismissToast(id: string): void
  setTurntable(p: Partial<State['turntable']>): void
  setSunCycle(v: boolean): void
}

const snap = (p: Project): Snapshot =>
  structuredClone({ layers: p.layers, objects: p.objects, compositions: p.compositions, cameras: p.cameras, mainCameraId: p.mainCameraId })

export const useStore = create<State>((set, get) => {
  const patchProject = (fn: (p: Project) => Partial<Project>, record = false): void => {
    if (record) get().commit()
    set((s) => ({ project: { ...s.project, ...fn(s.project) }, dirty: true }))
  }
  const mapComp = (compId: string, fn: (c: Composition) => Composition, record = false): void =>
    patchProject((p) => ({ compositions: p.compositions.map((c) => (c.id === compId ? fn(c) : c)) }), record)

  return {
    project: newProject(),
    projectPath: null,
    dirty: false,
    workspace: 'studio',
    selectedId: null,
    transformMode: 'translate',
    assetStatus: {},
    jobs: [],
    toasts: [],
    modal: null,
    undoStack: [],
    redoStack: [],
    compSelectedId: null,
    turntable: { playing: false, speed: 0.25 },
    sunCycle: false,

    setWorkspace: (workspace) => set({ workspace }),
    setModal: (modal) => set({ modal }),
    loadProject: (project, projectPath) =>
      set({ project, projectPath, dirty: false, selectedId: null, undoStack: [], redoStack: [], compSelectedId: null, assetStatus: {} }),
    markSaved: (projectPath) => set({ projectPath, dirty: false }),
    setProjectName: (name) => patchProject(() => ({ name })),

    commit: () =>
      set((s) => ({ undoStack: [...s.undoStack.slice(-79), snap(s.project)], redoStack: [] })),
    undo: () => {
      const s = get()
      const prev = s.undoStack[s.undoStack.length - 1]
      if (!prev) return
      set({
        undoStack: s.undoStack.slice(0, -1),
        redoStack: [...s.redoStack, snap(s.project)],
        project: { ...s.project, ...prev },
        dirty: true
      })
    },
    redo: () => {
      const s = get()
      const next = s.redoStack[s.redoStack.length - 1]
      if (!next) return
      set({
        redoStack: s.redoStack.slice(0, -1),
        undoStack: [...s.undoStack, snap(s.project)],
        project: { ...s.project, ...next },
        dirty: true
      })
    },

    addObject: (o, select = true) => {
      patchProject((p) => ({ objects: [...p.objects, o] }), true)
      if (select) set({ selectedId: o.id })
    },
    updateObject: (id, patch, record = true) =>
      patchProject((p) => ({ objects: p.objects.map((o) => (o.id === id ? { ...o, ...patch } : o)) }), record),
    setParams: (id, params, record = true) =>
      patchProject((p) => ({ objects: p.objects.map((o) => (o.id === id ? { ...o, params: { ...o.params, ...params } } : o)) }), record),
    setTransform: (id, transform, record = true) =>
      patchProject((p) => ({ objects: p.objects.map((o) => (o.id === id ? { ...o, transform } : o)) }), record),
    removeObjects: (ids) => {
      // Los recursos sin uso se conservan (para poder deshacer) y se descartan al guardar
      patchProject((p) => ({ objects: p.objects.filter((o) => !ids.includes(o.id)) }), true)
      if (ids.includes(get().selectedId ?? '')) set({ selectedId: null })
    },
    duplicateObject: (id) => {
      const o = get().project.objects.find((x) => x.id === id)
      if (!o) return
      const copy: SceneObject = structuredClone(o)
      copy.id = uid('obj')
      copy.name = `${o.name} (copia)`
      copy.transform.position = [o.transform.position[0] + 4, o.transform.position[1], o.transform.position[2] + 4]
      get().addObject(copy)
    },
    select: (selectedId) => set({ selectedId }),
    setTransformMode: (transformMode) => set({ transformMode }),

    addLayer: (name) =>
      patchProject((p) => ({
        layers: [...p.layers, { id: uid('layer'), name: name ?? `Capa ${p.layers.length + 1}`, visible: true, color: '#b48cff' }]
      }), true),
    updateLayer: (id, patch) => patchProject((p) => ({ layers: p.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)) }), true),
    removeLayer: (id) =>
      patchProject((p) => {
        if (p.layers.length <= 1) return {}
        const layers = p.layers.filter((l) => l.id !== id)
        return { layers, objects: p.objects.map((o) => (o.layerId === id ? { ...o, layerId: layers[0].id } : o)) }
      }, true),

    setEnv: (patch) => patchProject((p) => ({ environment: { ...p.environment, ...patch } })),
    setEnvSub: (key, patch) =>
      patchProject((p) => ({ environment: { ...p.environment, [key]: { ...p.environment[key], ...patch } } })),

    addCamera: (c) => patchProject((p) => ({ cameras: [...p.cameras, c], mainCameraId: p.mainCameraId ?? c.id }), true),
    updateCamera: (id, patch) => patchProject((p) => ({ cameras: p.cameras.map((c) => (c.id === id ? { ...c, ...patch } : c)) }), true),
    removeCamera: (id) =>
      patchProject((p) => ({ cameras: p.cameras.filter((c) => c.id !== id), mainCameraId: p.mainCameraId === id ? null : p.mainCameraId }), true),
    setMainCamera: (id) => patchProject(() => ({ mainCameraId: id }), true),

    addRender: (r) => patchProject((p) => ({ renders: [r, ...p.renders] })),
    removeRender: (id) => patchProject((p) => ({ renders: p.renders.filter((r) => r.id !== id) })),
    renameRender: (id, name) => patchProject((p) => ({ renders: p.renders.map((r) => (r.id === id ? { ...r, name } : r)) })),

    addComposition: (c, activate = true) =>
      patchProject((p) => ({ compositions: [...p.compositions, c], activeCompositionId: activate ? c.id : p.activeCompositionId }), true),
    updateComposition: (id, patch, record = true) => mapComp(id, (c) => ({ ...c, ...patch }), record),
    removeComposition: (id) =>
      patchProject((p) => {
        const compositions = p.compositions.filter((c) => c.id !== id)
        return { compositions, activeCompositionId: p.activeCompositionId === id ? (compositions[0]?.id ?? null) : p.activeCompositionId }
      }, true),
    setActiveComposition: (id) => {
      patchProject(() => ({ activeCompositionId: id }))
      set({ compSelectedId: null })
    },
    addElement: (compId, el) => {
      mapComp(compId, (c) => ({ ...c, elements: [...c.elements, el] }), true)
      set({ compSelectedId: el.id })
    },
    updateElement: (compId, elId, patch, record = true) =>
      mapComp(compId, (c) => ({ ...c, elements: c.elements.map((e) => (e.id === elId ? { ...e, ...patch } : e)) }), record),
    removeElement: (compId, elId) => {
      mapComp(compId, (c) => ({ ...c, elements: c.elements.filter((e) => e.id !== elId) }), true)
      if (get().compSelectedId === elId) set({ compSelectedId: null })
    },
    reorderElement: (compId, elId, dir) =>
      mapComp(compId, (c) => {
        const els = [...c.elements]
        const i = els.findIndex((e) => e.id === elId)
        if (i < 0) return c
        const [el] = els.splice(i, 1)
        const j = dir === 'top' ? els.length : dir === 'bottom' ? 0 : dir === 'up' ? Math.min(els.length, i + 1) : Math.max(0, i - 1)
        els.splice(j, 0, el)
        return { ...c, elements: els }
      }, true),
    selectElement: (compSelectedId) => set({ compSelectedId }),
    setCustomTemplates: (customTemplates) => patchProject(() => ({ customTemplates })),

    setAssetStatus: (id, s) => set((st) => ({ assetStatus: { ...st.assetStatus, [id]: s } })),
    startJob: (label) => {
      const id = uid('job')
      set((s) => ({ jobs: [...s.jobs, { id, label, progress: -1 }] }))
      return id
    },
    updateJob: (id, progress, stage) => set((s) => ({ jobs: s.jobs.map((j) => (j.id === id ? { ...j, progress, stage } : j)) })),
    endJob: (id) => set((s) => ({ jobs: s.jobs.filter((j) => j.id !== id) })),
    toast: (t, ms) => {
      const id = uid('t')
      set((s) => ({ toasts: [...s.toasts.slice(-4), { ...t, id }] }))
      const dur = ms ?? (t.kind === 'error' ? 12000 : 5000)
      if (dur > 0) setTimeout(() => get().dismissToast(id), dur)
    },
    dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
    setTurntable: (p) => set((s) => ({ turntable: { ...s.turntable, ...p } })),
    setSunCycle: (sunCycle) => set({ sunCycle })
  }
})

export const activeComposition = (s: { project: Project }): Composition | null =>
  s.project.compositions.find((c) => c.id === s.project.activeCompositionId) ?? null
