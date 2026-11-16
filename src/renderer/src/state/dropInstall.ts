// Arrastrar y soltar en la ventana: cada tipo de archivo va a su sitio.
//   .schem .schematic .litematic .nbt .mca → importar construcción
//   .zip                                   → paquete de texturas (o aviso si es un shaderpack de OptiFine/Iris)
//   .glsl .frag .fs                        → shader externo
//   .bslook .json                          → estilo visual
//   .png .jpg .jpeg .webp                  → galería del Compositor
import { useStore } from './store'
import { importFiles } from './importer'
import { installPack } from './textureActions'
import { installShader } from './shaders'
import { installLookText } from './looks'
import { uid } from './defaults'

const BUILD = ['schem', 'schematic', 'litematic', 'nbt', 'mca']
const IMAGE = ['png', 'jpg', 'jpeg', 'webp']
const ext = (n: string): string => n.toLowerCase().split('.').pop() ?? ''

export async function handleDroppedFiles(files: File[]): Promise<void> {
  const st = useStore.getState()
  const builds = files.filter((f) => BUILD.includes(ext(f.name)))
  if (builds.length) await importFiles(await Promise.all(builds.map(async (f) => ({ name: f.name, data: new Uint8Array(await f.arrayBuffer()) }))))
  for (const f of files) {
    const e = ext(f.name)
    if (BUILD.includes(e)) continue
    const path = window.api.pathForFile(f)
    if (e === 'zip') {
      // sin ruta real (p. ej. arrastrado desde el navegador) no se puede copiar: no abrimos un diálogo inesperado
      if (path) await installPack(path)
      else st.toast({ kind: 'warning', title: `No se pudo leer la ubicación de ${f.name}`, detail: 'Guarda el .zip en tu equipo y arrástralo desde el Explorador, o usa «Instalar paquete de texturas (.zip)…».' })
    }
    else if (e === 'glsl' || e === 'frag' || e === 'fs') await installShader({ name: f.name, text: await f.text() })
    else if (e === 'bslook' || e === 'json') {
      try {
        await installLookText(await f.text(), f.name.replace(/\.[^.]+$/, ''))
      } catch (err) {
        st.toast({ kind: 'error', title: `No se pudo instalar ${f.name}`, detail: (err as Error).message })
      }
    } else if (IMAGE.includes(e)) {
      const dataUrl = await new Promise<string>((res, rej) => {
        const fr = new FileReader()
        fr.onload = () => res(fr.result as string)
        fr.onerror = () => rej(fr.error)
        fr.readAsDataURL(f)
      })
      const img = new Image()
      img.src = dataUrl
      try {
        await img.decode()
        st.addRender({ id: uid('render'), name: f.name.replace(/\.[^.]+$/, ''), width: img.naturalWidth, height: img.naturalHeight, createdAt: new Date().toISOString(), dataUrl, source: 'imported' })
        st.toast({ kind: 'success', title: `Imagen añadida a la galería: ${f.name}` }, 2500)
      } catch {
        st.toast({ kind: 'error', title: `${f.name} no es una imagen válida` })
      }
    } else {
      st.toast({ kind: 'warning', title: `Tipo de archivo no reconocido: ${f.name}`, detail: 'Admite construcciones (.schem, .litematic…), paquetes de texturas (.zip), shaders (.glsl), estilos (.bslook) e imágenes.' })
    }
  }
}
