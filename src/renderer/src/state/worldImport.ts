// Importa un área de un mundo de Minecraft como una construcción más (guardada como .schem en el proyecto).
import { useStore } from './store'
import { importFiles } from './importer'
import { extractArea, regionsForArea, writeSchem, type LevelInfo, type WorldArea } from '../core/world'

export async function importWorldArea(worldPath: string, level: LevelInfo, dimDir: string, area: WorldArea, onProgress?: (f: number, label: string) => void): Promise<string[]> {
  const st = useStore.getState()
  const job = st.startJob(`Mundo «${level.name}»`)
  const progress = (f: number, label: string): void => {
    useStore.getState().updateJob(job, f, label)
    onProgress?.(f, label)
  }
  try {
    progress(0, 'Leyendo archivos de región')
    const files = regionsForArea(area).map((r) => r.file)
    const regions = await window.api.worldReadRegions({ worldPath, dimDir, files })
    const { model, warnings, dataVersion } = await extractArea(regions, area, progress)
    progress(0.96, 'Creando la construcción')
    const label = `${level.name} (${Math.round(area.cx)}, ${Math.round(area.cz)})`
    const bytes = await writeSchem(model, { name: label, dataVersion: dataVersion ?? level.dataVersion })
    const ids = await importFiles([{ name: `${label.replace(/[\\/:*?"<>|]/g, '_')}.schem`, data: bytes }])
    if (ids.length && warnings.length) useStore.getState().toast({ kind: 'info', title: 'Mundo importado con avisos', detail: warnings.join(' ') })
    return ids
  } catch (err) {
    useStore.getState().toast({ kind: 'error', title: 'No se pudo importar el mundo', detail: (err as Error).message })
    return []
  } finally {
    useStore.getState().endJob(job)
  }
}
