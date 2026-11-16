import { useEffect, useState, type JSX, type ReactNode } from 'react'

export function Section(p: { title: ReactNode; children: ReactNode; open?: boolean; extra?: ReactNode }): JSX.Element {
  return (
    <details className="section" open={p.open ?? true}>
      <summary>
        <span style={{ flex: 1 }}>{p.title}</span>
        {p.extra}
      </summary>
      <div className="section-body">{p.children}</div>
    </details>
  )
}

export function Field(p: { label: string; children: ReactNode; title?: string }): JSX.Element {
  return (
    <div className="field" title={p.title}>
      <span className="lbl">{p.label}</span>
      <div>{p.children}</div>
    </div>
  )
}

/** Campo numérico que confirma al perder el foco o con Enter (evita un paso de deshacer por tecla). */
export function NumInput(p: { value: number; onChange: (v: number) => void; step?: number; min?: number; max?: number; className?: string; ariaLabel?: string; decimals?: number }): JSX.Element {
  const fmt = (v: number): string => String(Math.round(v * 10 ** (p.decimals ?? 3)) / 10 ** (p.decimals ?? 3))
  const [txt, setTxt] = useState(fmt(p.value))
  useEffect(() => setTxt(fmt(p.value)), [p.value])
  const commit = (): void => {
    let v = parseFloat(txt.replace(',', '.'))
    if (!Number.isFinite(v)) return setTxt(fmt(p.value))
    if (p.min != null) v = Math.max(p.min, v)
    if (p.max != null) v = Math.min(p.max, v)
    if (v !== p.value) p.onChange(v)
    else setTxt(fmt(p.value))
  }
  return (
    <input
      className={`input ${p.className ?? ''}`}
      aria-label={p.ariaLabel}
      value={txt}
      inputMode="decimal"
      onChange={(e) => setTxt(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') (e.target as HTMLInputElement).blur()
        if (e.key === 'Escape') {
          setTxt(fmt(p.value))
          ;(e.target as HTMLInputElement).blur()
        }
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const st = (p.step ?? 1) * (e.shiftKey ? 10 : 1) * (e.key === 'ArrowUp' ? 1 : -1)
          let v = p.value + st
          if (p.min != null) v = Math.max(p.min, v)
          if (p.max != null) v = Math.min(p.max, v)
          p.onChange(v)
        }
      }}
    />
  )
}

export function Vec3Input(p: { value: [number, number, number]; onChange: (v: [number, number, number]) => void; step?: number; min?: number }): JSX.Element {
  const axes = [
    ['X', '#ff6b6b'],
    ['Y', '#6cc070'],
    ['Z', '#5aa9ff']
  ]
  return (
    <div className="vec3">
      {axes.map(([a, c], i) => (
        <div className="num" key={a}>
          <span style={{ color: c }}>{a}</span>
          <NumInput
            ariaLabel={a}
            value={p.value[i]}
            step={p.step}
            min={p.min}
            onChange={(v) => {
              const n = [...p.value] as [number, number, number]
              n[i] = v
              p.onChange(n)
            }}
          />
        </div>
      ))}
    </div>
  )
}

export function Slider(p: { value: number; min: number; max: number; step?: number; onChange: (v: number) => void; decimals?: number; ariaLabel?: string }): JSX.Element {
  return (
    <div className="slider">
      <input type="range" aria-label={p.ariaLabel} min={p.min} max={p.max} step={p.step ?? 0.01} value={p.value} onChange={(e) => p.onChange(parseFloat(e.target.value))} />
      <NumInput value={p.value} onChange={p.onChange} min={p.min} max={p.max} step={p.step ?? 0.01} decimals={p.decimals ?? 2} />
    </div>
  )
}

export function ColorInput(p: { value: string; onChange: (v: string) => void; ariaLabel?: string }): JSX.Element {
  const [txt, setTxt] = useState(p.value)
  useEffect(() => setTxt(p.value), [p.value])
  return (
    <div className="color">
      <input type="color" aria-label={p.ariaLabel} value={/^#[0-9a-f]{6}$/i.test(p.value) ? p.value : '#000000'} onChange={(e) => p.onChange(e.target.value)} />
      <input
        className="input"
        value={txt}
        onChange={(e) => setTxt(e.target.value)}
        onBlur={() => (/^#[0-9a-f]{6}$/i.test(txt) ? p.onChange(txt.toLowerCase()) : setTxt(p.value))}
        onKeyDown={(e) => e.key === 'Enter' && (e.target as HTMLInputElement).blur()}
      />
    </div>
  )
}

export function Toggle(p: { checked: boolean; onChange: (v: boolean) => void; label?: string }): JSX.Element {
  return (
    <label className="toggle">
      <input type="checkbox" checked={p.checked} onChange={(e) => p.onChange(e.target.checked)} />
      <span className="track" />
      {p.label && <span>{p.label}</span>}
    </label>
  )
}

export function Select<T extends string>(p: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; ariaLabel?: string }): JSX.Element {
  return (
    <select className="select" aria-label={p.ariaLabel} value={p.value} onChange={(e) => p.onChange(e.target.value as T)}>
      {p.options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

export function Seg<T extends string>(p: { value: T; options: { value: T; label: string; title?: string }[]; onChange: (v: T) => void }): JSX.Element {
  return (
    <div className="seg" role="radiogroup">
      {p.options.map((o) => (
        <button key={o.value} role="radio" aria-checked={p.value === o.value} title={o.title} className={p.value === o.value ? 'on' : ''} onClick={() => p.onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function Modal(p: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }): JSX.Element {
  useEffect(() => {
    const k = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') p.onClose()
    }
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [p.onClose])
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && p.onClose()}>
      <div className={`modal ${p.wide ? 'wide' : ''}`} role="dialog" aria-modal="true">
        <div className="modal-head">
          <h3>{p.title}</h3>
          <button className="icon-btn" aria-label="Cerrar" onClick={p.onClose}>
            ✕
          </button>
        </div>
        <div className="modal-body">{p.children}</div>
        {p.footer && <div className="modal-foot">{p.footer}</div>}
      </div>
    </div>
  )
}

export const fmtInt = (n: number): string => n.toLocaleString('es-ES')
export const fmtBytes = (n: number): string =>
  n > 1048576 ? `${(n / 1048576).toFixed(2)} MB` : n > 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`
