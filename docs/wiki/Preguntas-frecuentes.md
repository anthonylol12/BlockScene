# Preguntas frecuentes

**Windows dice «Windows protegió su PC» al instalar.**
El instalador no está firmado digitalmente. Pulsa *Más información → Ejecutar de todas formas*.

**Los bloques salen con colores lisos, sin texturas.**
Activa *Render → Bloques de Minecraft → Usar mi Minecraft instalado*. Necesitas tener Minecraft Java Edition instalado; si no lo detecta, usa *Elegir otra versión (.jar)…*.

**¿Puedo usar shaders de OptiFine o Iris (BSL, Complementary…)?**
No. Están escritos para el motor gráfico de Minecraft. Usa los **estilos visuales**, el **postprocesado** y los **shaders GLSL** de BlockScene (ver [[Shaders externos|Shaders-externos]]).

**Un archivo no se importa.**
Lee el mensaje: indica si el archivo está dañado, si es de Bedrock (no compatible) o si supera el tamaño máximo. Los formatos admitidos están en [[Importar construcciones|Importar-construcciones]].

**Algunos bloques se ven simplificados.**
Las escaleras, vallas, muros, paneles, puertas, trampillas, losas, antorchas y plantas tienen su forma. Las esquinas de escalera, los faroles, los cofres y las camas se simplifican.

**El visor va lento.**
Baja la calidad en *Render → Calidad → Visor: Baja*, desactiva *Oclusión amb.* o desactiva los shaders con profundidad. El render final no depende de esa calidad.

**¿Dónde se guardan mis paquetes, estilos y shaders?**
En la carpeta de datos de la aplicación (`%APPDATA%\BlockScene`). Los proyectos `.bscene` se guardan donde tú elijas.

**¿Las texturas de Minecraft se suben con mis proyectos?**
No. Se leen de tu copia del juego y no se guardan en los `.bscene`. Las imágenes que exportas sí las incluyen, como cualquier captura del juego.

**Encontré un error o tengo una idea.**
Abre una incidencia en [Issues](https://github.com/anthonylol12/BlockScene/issues).
