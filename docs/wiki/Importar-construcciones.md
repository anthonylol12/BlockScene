# Importar construcciones

Pulsa **Importar** (Ctrl+I) o **arrastra los archivos** a la ventana. Puedes importar varios a la vez: cada uno se convierte en un objeto independiente.

![Informe de importación](https://raw.githubusercontent.com/anthonylol12/BlockScene/main/docs/images/02-informe-importacion.png)

Tras importar verás un **informe con los datos leídos del propio archivo**: formato, versión de Minecraft, dimensiones, número de bloques, tipos de bloque, autor… Si un dato no aparece es porque el archivo no lo incluye.

## Formatos compatibles

| Extensión | Formato | Estado |
|---|---|---|
| `.schem` | Sponge Schematic v1, v2 y v3 (WorldEdit 7+, FAWE) | Completo |
| `.litematic` | Litematica (varias regiones) | Completo |
| `.nbt` | Estructura de Minecraft (Structure Block) | Completo |
| `.schematic` | MCEdit / WorldEdit clásico (anterior a 1.13) | Parcial: solo los bloques más comunes |
| `.mca` | Región de mundo (Java 1.13+) | Parcial: se recorta al contenido |

- El formato se detecta por el **contenido**, no solo por la extensión.
- Si un archivo está dañado o no es compatible, la app explica el motivo y no lo importa.
- Límites: 120 millones de vóxeles por construcción y archivos de hasta 512 MB.

## Ver los datos más tarde

Selecciona la construcción y abre la pestaña **Objeto → Datos del archivo**.
