# Texturas y paquetes de texturas

BlockScene **no incluye** las texturas de Minecraft, que son de Mojang: las lee de tu copia del juego y no las copia a tus proyectos.

## Usar tu Minecraft

Ve a **Render → Bloques de Minecraft → Usar mi Minecraft instalado**. Se detecta la versión más reciente de `%APPDATA%\.minecraft\versions`; con **Elegir otra versión (.jar)…** puedes usar otra. La app recuerda tu elección.

Cada bloque recibe su textura exacta leyendo los **modelos del propio juego**. En Minecraft 26.3, los 1279 bloques visibles tienen textura.

## Paquetes de texturas (resource packs)

- Para instalar un paquete puedes:
  - pulsar **Instalar paquete de texturas (.zip)…**;
  - elegir uno de tu carpeta `resourcepacks` en la lista;
  - **arrastrar el .zip** a la ventana.
- Se aplican **por encima** de tu versión, como en el juego, y el de arriba tiene prioridad. Puedes activarlos, ordenarlos y desinstalarlos.
- Admite paquetes **HD de hasta 64 px**.
- Del paquete se usan las texturas de bloque, los modelos y la fuente. Los efectos de OptiFine (texturas conectadas, etc.) se ignoran.

Sin texturas, cada bloque se dibuja con una textura pixelada genérica y su color aproximado.
