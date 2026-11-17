# Render

Pulsa **F12** (o el menú **Render → Render final…**).

![Diálogo de render](https://raw.githubusercontent.com/anthonylol12/BlockScene/main/docs/images/08-render-final.png)

| Opción | Para qué sirve |
|---|---|
| **Tamaño** | Predefinidos (HD, Full HD, 2K, 4K, cuadrado, vertical) o personalizado |
| **Muestras** | 1 a 64. Más muestras dan bordes y sombras más suaves; 16 es un buen equilibrio |
| **Nitidez** | Normal, Alta 2× o Máxima 3×: se renderiza al doble o al triple de tamaño y se reduce. Las texturas y los bordes quedan más definidos; tarda más. Si la tarjeta gráfica no admite tanto, se usa el máximo posible y se avisa |
| **Cámara** | La vista actual o una cámara guardada (por defecto, la principal ⭐) |
| **Fondo transparente** | PNG sin fondo que conserva la sombra del suelo. Se recorta solo al contenido |
| **Solo la selección** | Renderiza únicamente la construcción seleccionada |

- **Vista previa rápida** hace una imagen de 1 muestra y hasta 960 px de ancho.
- **Render final** usa el tamaño y las muestras elegidos.

![Render terminado](https://raw.githubusercontent.com/anthonylol12/BlockScene/main/docs/images/09-render-resultado.png)

Cada render se añade a la **galería del Compositor** y se guarda con el proyecto. Puedes guardarlo como PNG con **Guardar PNG…**.

**Añadir a lámina**: al terminar un render (y también al abrirlo desde la galería), elige una plantilla y pulsa **Añadir a lámina**. Se crea una lámina con ese render como pieza principal y se abre el Compositor. Si el render tiene fondo transparente se propone *Paquete de construcciones*; si no, *Exhibición*.

## Vídeo y GIF (animaciones)

Pulsa **Vídeo / GIF…** en la barra inferior, *Render → Exportar animación (vídeo o GIF)…* o **Ctrl+Mayús+F12**.

| Opción | Para qué sirve |
|---|---|
| **Animación** | Giro 360° de la cámara, ciclo solar o ambos a la vez |
| **Formato** | MP4 (H.264), WebM (VP9) o GIF animado |
| **Tamaño** | De 854×480 a 4K, cuadrado o vertical (Reels/TikTok) |
| **Duración y fotogramas/s** | De 3 a 15 s, de 15 a 60 fps |
| **Calidad y nitidez** | Muestras y superresolución de cada fotograma |
| **Giro** | 360° (bucle sin saltos), 180° o 90°, en sentido horario o antihorario |
| **Ciclo solar** | Amanecer → atardecer, tarde → noche o día completo |

Cada fotograma es un **render real** de la escena (el mismo motor que el render final), no una grabación de pantalla. El giro rodea el punto al que mira la cámara: encuadra antes con **¾** o una cámara guardada. El GIF pesa mucho más que el vídeo: para redes sociales usa MP4.

También tienes **Render aislado (PNG transparente)** en *Objeto → Datos del archivo*: renderiza una sola construcción con fondo transparente.

> El render es por rasterización (WebGL), no por trazado de rayos. El agua refleja el cielo, no las construcciones. La app avisa si el tamaño pedido supera lo que admite tu tarjeta gráfica.
