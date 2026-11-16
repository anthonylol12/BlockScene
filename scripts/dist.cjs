// Genera el instalador de Windows. NSIS no admite rutas de más de 260 caracteres: si la carpeta
// del proyecto es muy larga, se monta temporalmente en una unidad virtual (subst) y se desmonta al acabar.
const { execSync } = require('node:child_process')
const fs = require('node:fs')
const root = require('node:path').resolve(__dirname, '..')
const run = (cmd, cwd) => execSync(cmd, { cwd, stdio: 'inherit' })

let drive = null
try {
  if (process.platform === 'win32' && root.length > 100) {
    drive = ['Q', 'W', 'V', 'R', 'T', 'P'].find((d) => !fs.existsSync(`${d}:\\`))
    if (!drive) throw new Error('No hay letras de unidad libres para acortar la ruta')
    execSync(`subst ${drive}: "${root}"`)
    console.log(`Ruta larga: compilando desde la unidad temporal ${drive}:`)
  }
  run('npx electron-builder --win --x64', drive ? `${drive}:\\` : root)
} finally {
  if (drive) execSync(`subst ${drive}: /d`)
}
