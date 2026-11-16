import { useEffect, useState, type JSX } from 'react'
import { EXAMPLE_SHADERS, installShader, setShaderParam, setShaders, shaderStack } from '../../state/shaders'
import { Field, Section, Slider, Toggle } from '../controls'
import { Icon } from '../icons'

export function ShadersSection(): JSX.Element {
  const [, force] = useState(0)
  const [open, setOpen] = useState<string | null>(null)
  const [example, setExample] = useState('')
  useEffect(() => shaderStack.subscribe(() => force((x) => x + 1)), [])
  const list = shaderStack.get()
  const move = (i: number, d: number): void => {
    const l = [...list]
    const j = i + d
    if (j < 0 || j >= l.length) return
    ;[l[i], l[j]] = [l[j], l[i]]
    setShaders(l)
  }
  const notInstalled = EXAMPLE_SHADERS.filter((e) => !list.some((s) => s.file === e.file))
  return (
    <Section title="Shaders externos (GLSL)">
      {list.length === 0 && <div className="hint">Ningún shader instalado. Prueba uno de los ejemplos o instala tu propio archivo .glsl.</div>}
      <div className="layers-list" style={{ margin: '0 -10px' }}>
        {list.map((s, i) => (
          <div key={s.file}>
            <div className="tree-row" onClick={() => setOpen(open === s.file ? null : s.file)} title={s.meta?.description}>
              <span onClick={(e) => e.stopPropagation()}>
                <Toggle checked={s.enabled} onChange={(v) => setShaders(list.map((x) => (x.file === s.file ? { ...x, enabled: v } : x)))} />
              </span>
              <span className={`name ${s.enabled && !s.error ? '' : 'dim'}`}>{s.meta?.name ?? s.file}</span>
              {s.error && <span className="tag err" title={s.error}>ERROR</span>}
              {s.meta && <span className="tag">{s.meta.stage.toUpperCase()}{s.meta.depth ? '+Z' : ''}</span>}
              <button className="icon-btn" aria-label="Subir" title="Antes en la cadena" onClick={(e) => { e.stopPropagation(); move(i, -1) }}><Icon name="up" size={12} /></button>
              <button className="icon-btn" aria-label="Bajar" title="Después en la cadena" onClick={(e) => { e.stopPropagation(); move(i, 1) }}><Icon name="down" size={12} /></button>
              <button className="icon-btn" aria-label="Desinstalar shader" title="Desinstalar" onClick={(e) => { e.stopPropagation(); if (window.confirm(`¿Desinstalar «${s.meta?.name ?? s.file}»?`)) setShaders(list.filter((x) => x.file !== s.file)) }}><Icon name="trash" size={12} /></button>
            </div>
            {open === s.file && (
              <div style={{ padding: '4px 14px 8px', display: 'flex', flexDirection: 'column', gap: 6 }}>
                {s.meta?.description && <div className="hint">{s.meta.description}</div>}
                {s.error && <pre className="callout err" style={{ whiteSpace: 'pre-wrap', fontSize: 11, margin: 0, userSelect: 'text' }}>{s.error}</pre>}
                {s.meta?.params.map((p) => (
                  <Field key={p.name} label={p.label}>
                    <Slider value={s.params[p.name] ?? p.def} min={p.min} max={p.max} step={(p.max - p.min) / 200} decimals={3} onChange={(v) => setShaderParam(s.file, p.name, v)} />
                  </Field>
                ))}
                {s.meta && !s.meta.params.length && <div className="hint">Este shader no tiene parámetros ajustables.</div>}
              </div>
            )}
          </div>
        ))}
      </div>
      {notInstalled.length > 0 && (
        <div className="row">
          <select className="select" style={{ flex: 1, height: 24 }} aria-label="Shaders de ejemplo" value={example} onChange={(e) => setExample(e.target.value)}>
            <option value="">Ejemplos incluidos…</option>
            {notInstalled.map((e) => <option key={e.file} value={e.file}>{e.meta.name}</option>)}
          </select>
          <button className="btn small" disabled={!example} onClick={async () => {
            const e = EXAMPLE_SHADERS.find((x) => x.file === example)
            if (e) await installShader({ name: e.file, text: e.source })
            setExample('')
          }}>Instalar</button>
        </div>
      )}
      <div className="row">
        <button className="btn small" style={{ flex: 1 }} onClick={() => installShader(null)}>Instalar shader (.glsl)…</button>
        <button className="btn small" onClick={() => window.api.shadersOpenFolder()} title="Abre la carpeta donde se guardan los shaders instalados">Carpeta</button>
      </div>
      <details>
        <summary className="hint" style={{ cursor: 'pointer' }}>Cómo escribir un shader</summary>
        <pre className="callout" style={{ whiteSpace: 'pre-wrap', fontSize: 10.5, margin: '4px 0 0', userSelect: 'text' }}>{`// @name Mi efecto
// @stage ldr        (ldr: tras el tono · hdr: antes)
// @depth            (opcional: usa tDepth)
// @param fuerza 0.5 0 1 Fuerza
uniform sampler2D tDiffuse;  // imagen
uniform sampler2D tDepth;    // profundidad 0..1
uniform vec2 uResolution;
uniform float uTime, uNear, uFar;
uniform float fuerza;
varying vec2 vUv;
void main() {
  vec4 c = texture2D(tDiffuse, vUv);
  gl_FragColor = vec4(c.rgb * (1.0 - fuerza * 0.5), c.a);
}`}</pre>
      </details>
      <div className="hint">Los shaders son archivos GLSL propios de BlockScene: se aplican en el visor y en el render final, en el orden de la lista. Si uno no compila, se muestra el error y se omite. Los shaderpacks de OptiFine/Iris no son compatibles.</div>
    </Section>
  )
}
