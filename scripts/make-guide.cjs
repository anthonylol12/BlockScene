// Genera la guía descargable en PDF (docs/BlockScene-Guia.pdf) a partir de las páginas de la wiki.
// Uso: npx electron scripts/make-guide.cjs
const { app, BrowserWindow, nativeImage } = require('electron')
const path = require('node:path')
const fs = require('node:fs')
const { pathToFileURL } = require('node:url')

const root = path.resolve(__dirname, '..')
const wiki = path.join(root, 'docs', 'wiki')
const images = path.join(root, 'docs', 'images')
const ORDER = ['Home', 'Instalación', 'Primeros-pasos', 'Importar-construcciones', 'Texturas-y-paquetes', 'Estudio-3D', 'Ambiente-y-estilos', 'Shaders-externos', 'Render', 'Compositor', 'Preferencias-y-atajos', 'Preguntas-frecuentes']
const version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
function inline(t) {
  return esc(t)
    .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (_m, alt, src) => `<img alt="${alt}" src="${localImg(src)}">`)
    .replace(/\[\[([^\]|]+)(\|[^\]]+)?\]\]/g, '<b>$1</b>')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/\*([^*]+)\*/g, '<i>$1</i>')
}
// copias JPEG para que el PDF pese poco (las capturas originales son PNG)
const jpgDir = path.join(root, 'out', 'guia-img')
function localImg(src) {
  const name = src.split('/').pop()
  const p = path.join(images, name)
  if (!fs.existsSync(p)) return src
  fs.mkdirSync(jpgDir, { recursive: true })
  const dest = path.join(jpgDir, name.replace(/.png$/i, '.jpg'))
  if (!fs.existsSync(dest)) fs.writeFileSync(dest, nativeImage.createFromPath(p).resize({ width: 1400, quality: 'best' }).toJPEG(82))
  return pathToFileURL(dest).href
}

/** Conversor de Markdown suficiente para la wiki (títulos, párrafos, listas, tablas, código, citas, imágenes). */
function md(text, chapter) {
  const lines = text.replace(/\r/g, '').split('\n')
  const out = []
  let i = 0
  while (i < lines.length) {
    const l = lines[i]
    if (l.startsWith('```')) {
      const code = []
      i++
      while (i < lines.length && !lines[i].startsWith('```')) code.push(lines[i++])
      i++
      out.push(`<pre>${esc(code.join('\n'))}</pre>`)
      continue
    }
    const h = /^(#{1,3})\s+(.*)$/.exec(l)
    if (h) {
      const lvl = h[1].length
      out.push(lvl === 1 ? `<h1 id="c${chapter}">${inline(h[2])}</h1>` : `<h${lvl}>${inline(h[2])}</h${lvl}>`)
      i++
      continue
    }
    if (l.startsWith('|')) {
      const rows = []
      while (i < lines.length && lines[i].startsWith('|')) rows.push(lines[i++])
      const cells = (r) => r.replace(/^\||\|$/g, '').split('|').map((c) => c.trim())
      const head = cells(rows[0])
      const body = rows.slice(2).map(cells)
      const th = head.some(Boolean) ? `<thead><tr>${head.map((c) => `<th>${inline(c)}</th>`).join('')}</tr></thead>` : ''
      out.push(`<table>${th}<tbody>${body.map((r) => `<tr>${r.map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`)
      continue
    }
    if (/^(\s*)([-*]|\d+\.)\s+/.test(l)) {
      const ordered = /^\s*\d+\./.test(l)
      const items = []
      while (i < lines.length && /^(\s*)([-*]|\d+\.)\s+/.test(lines[i])) items.push(lines[i++].replace(/^\s*([-*]|\d+\.)\s+/, ''))
      out.push(`<${ordered ? 'ol' : 'ul'}>${items.map((x) => `<li>${inline(x)}</li>`).join('')}</${ordered ? 'ol' : 'ul'}>`)
      continue
    }
    if (l.startsWith('>')) {
      const q = []
      while (i < lines.length && lines[i].startsWith('>')) q.push(lines[i++].replace(/^>\s?/, ''))
      out.push(`<blockquote>${inline(q.join(' '))}</blockquote>`)
      continue
    }
    if (!l.trim()) {
      i++
      continue
    }
    const para = []
    while (i < lines.length && lines[i].trim() && !/^(#|\||```|>|\s*[-*]\s|\s*\d+\.\s)/.test(lines[i])) para.push(lines[i++])
    const html = inline(para.join(' '))
    out.push(/^<img [^>]+>$/.test(html) ? `<figure>${html}</figure>` : `<p>${html}</p>`)
  }
  return out.join('\n')
}

let chapters = []
const buildChapters = () => ORDER.map((name, i) => {
  const text = fs.readFileSync(path.join(wiki, `${name}.md`), 'utf8')
  const title = /^#\s+(.*)$/m.exec(text)[1]
  // la portada de la wiki sirve de introducción; quitamos sus enlaces de descarga e índice
  const body = name === 'Home' ? text.replace(/## Descargar[\s\S]*?(?=## Qué puedes hacer)/, '').replace(/^# BlockScene/m, '# Introducción') : text
  return { title: name === 'Home' ? 'Introducción' : title, html: md(body, i) }
})

const iconPath = () => pathToFileURL(path.join(root, 'build', 'icon.png')).href
const buildHtml = () => `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Guía de BlockScene</title><style>
@page { size: A4; margin: 16mm 15mm 18mm; }
body { font: 10.5pt/1.5 "Segoe UI", system-ui, sans-serif; color: #1d2230; }
h1 { font-size: 21pt; margin: 0 0 8pt; color: #1b4f99; page-break-before: always; border-bottom: 2px solid #d6e2f3; padding-bottom: 4pt; }
h2 { font-size: 14pt; margin: 14pt 0 5pt; color: #20304d; }
h3 { font-size: 11.5pt; margin: 10pt 0 4pt; }
p, li { margin: 4pt 0; }
code { font: 9pt Consolas, monospace; background: #eef2f8; padding: 0 3px; border-radius: 3px; }
pre { font: 8.6pt/1.4 Consolas, monospace; background: #f3f6fb; border: 1px solid #dbe3ef; border-radius: 6px; padding: 8pt; white-space: pre-wrap; page-break-inside: avoid; }
table { border-collapse: collapse; width: 100%; margin: 6pt 0; font-size: 9.5pt; page-break-inside: avoid; }
th, td { border: 1px solid #d5dce8; padding: 4pt 6pt; text-align: left; vertical-align: top; }
th { background: #eef3fa; }
figure { margin: 8pt 0; text-align: center; page-break-inside: avoid; }
img { max-width: 100%; max-height: 112mm; border-radius: 6px; border: 1px solid #d5dce8; }
blockquote { margin: 8pt 0; padding: 6pt 10pt; background: #fff8e6; border-left: 3px solid #f0b44c; border-radius: 4px; }
a { color: #1b5fc0; text-decoration: none; }
.cover { height: 250mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
.cover img { width: 46mm; border: 0; }
.cover h1 { page-break-before: avoid; border: 0; font-size: 34pt; margin: 10pt 0 2pt; color: #14213a; }
.cover .sub { font-size: 14pt; color: #4a5872; }
.cover .meta { margin-top: 28pt; color: #6a7486; font-size: 10pt; }
.toc { page-break-before: always; }
.toc h2 { font-size: 18pt; color: #1b4f99; }
.toc ol { font-size: 12pt; line-height: 2; }
</style></head><body>
<section class="cover"><img src="${iconPath()}" alt=""><h1>BlockScene</h1><div class="sub">Guía de uso</div>
<div class="meta">Versión ${version} · github.com/anthonylol12/BlockScene<br>Escenas 3D y láminas de presentación para construcciones de Minecraft</div></section>
<section class="toc"><h2>Contenido</h2><ol>${chapters.map((c, i) => `<li><a href="#c${i}">${esc(c.title)}</a></li>`).join('')}</ol></section>
${chapters.map((c) => c.html).join('\n')}
<p style="margin-top:20pt;color:#6a7486;font-size:9pt">BlockScene no incluye ni redistribuye texturas ni recursos de Minecraft; los lee de la copia del juego del usuario. Minecraft es una marca de Mojang Studios / Microsoft. BlockScene no está afiliado ni respaldado por ellos. Licencia MIT.</p>
</body></html>`

app.whenReady().then(async () => {
  chapters = buildChapters()
  const html = buildHtml()
  const tmp = path.join(root, 'out', 'guia.html')
  fs.mkdirSync(path.dirname(tmp), { recursive: true })
  fs.writeFileSync(tmp, html)
  const win = new BrowserWindow({ show: false, webPreferences: { offscreen: true } })
  await win.loadFile(tmp)
  await win.webContents.executeJavaScript('Promise.all([...document.images].map(i => i.decode().catch(() => null))).then(() => document.images.length)')
  const pdf = await win.webContents.printToPDF({
    pageSize: 'A4',
    printBackground: true,
    displayHeaderFooter: true,
    headerTemplate: '<span></span>',
    footerTemplate: '<div style="font-size:8px;width:100%;text-align:center;color:#888">BlockScene · Guía de uso · <span class="pageNumber"></span> / <span class="totalPages"></span></div>',
    margins: { top: 0.6, bottom: 0.7, left: 0.6, right: 0.6 }
  })
  const dest = path.join(root, 'docs', 'BlockScene-Guia.pdf')
  fs.writeFileSync(dest, pdf)
  console.log('PDF:', dest, (pdf.length / 1048576).toFixed(1), 'MB')
  app.exit(0)
})
