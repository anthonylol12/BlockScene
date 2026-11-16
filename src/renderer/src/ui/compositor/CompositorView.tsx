import { useEffect, useMemo, useRef, useState, type JSX } from 'react'
import type { CompElement, Composition, TextStyle } from '@shared/types'
import { activeComposition, useStore } from '../../state/store'
import { drawComposition, getImage, onImagesLoaded } from '../../compositor/drawPage'
import { MC_FONT, mcFontReady, onMcFont } from '../../compositor/mcFont'
import { TEMPLATES, ROLE_STYLE } from '../../compositor/templates'
import {
  addImageSlot, addRectElement, addTextElement, alignElement, applyCustomTemplate, applyTemplateToNew,
  importImagesToGallery, newComposition, placeRender, saveAsTemplate
} from '../../compositor/compActions'
import { PAGE_PRESETS, QUALITY_INFO, checkCapacity } from '../../compositor/pageFormats'
import { downloadRender } from '../../state/actions'
import { ColorInput, Field, NumInput, Section, Seg, Select, Slider, Toggle } from '../controls'
import { Icon } from '../icons'

export const FONTS = [
  MC_FONT,
  'Segoe UI', 'Segoe UI Light', 'Segoe UI Black', 'Bahnschrift', 'Arial', 'Arial Black', 'Verdana', 'Tahoma', 'Trebuchet MS',
  'Franklin Gothic Medium', 'Corbel', 'Candara', 'Georgia', 'Cambria', 'Constantia', 'Palatino Linotype', 'Times New Roman',
  'Consolas', 'Courier New', 'Impact'
]
const FONT_LABEL = (f: string): string => (f === MC_FONT ? (mcFontReady() ? 'Minecraft (de tu juego)' : 'Minecraft (carga las texturas de tu juego)') : f)
const FONT_OPTIONS_FN = (): { value: string; label: string }[] => FONTS.map((f) => ({ value: f, label: FONT_LABEL(f) }))
const TYPE_STYLES: { id: string; label: string; heading: string; body: string }[] = [
  { id: 'minecraft', label: 'Minecraft', heading: MC_FONT, body: MC_FONT },
  { id: 'modern', label: 'Moderno', heading: 'Segoe UI', body: 'Segoe UI' },
  { id: 'editorial', label: 'Editorial', heading: 'Georgia', body: 'Segoe UI' },
  { id: 'tech', label: 'Técnico', heading: 'Bahnschrift', body: 'Consolas' },
  { id: 'impact', label: 'Impacto', heading: 'Impact', body: 'Arial' },
  { id: 'classic', label: 'Clásico', heading: 'Palatino Linotype', body: 'Cambria' }
]

export function CompositorView(): JSX.Element {
  const comp = useStore(activeComposition)
  return (
    <div className="workspace compositor">
      <CompLeft />
      <div className="comp-stage">
        {comp ? <Stage comp={comp} /> : <NoComposition />}
      </div>
      <CompRight comp={comp} />
    </div>
  )
}

function NoComposition(): JSX.Element {
  return (
    <div className="vp-empty">
      <div className="card">
        <h2>Crea tu primera lámina</h2>
        <p>Empieza con una página en blanco o con una plantilla. Los renders del Estudio 3D aparecen en la galería de la izquierda; arrástralos a la página.</p>
        <div className="row wrap" style={{ justifyContent: 'center' }}>
          <button className="btn primary" onClick={newComposition}>Lámina en blanco</button>
          {TEMPLATES.map((t) => (
            <button key={t.id} className="btn" onClick={() => applyTemplateToNew(t.id)}>{t.name}</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------------------- panel izquierdo
function CompLeft(): JSX.Element {
  const project = useStore((s) => s.project)
  const st = useStore.getState()
  const [userTpls, setUserTpls] = useState<Composition[]>([])
  useEffect(() => {
    window.api.loadTemplates().then((l) => setUserTpls(l as Composition[])).catch(() => setUserTpls([]))
  }, [project.customTemplates.length])
  const custom = [...project.customTemplates, ...userTpls.filter((u) => !project.customTemplates.some((p) => p.name === u.name))]
  return (
    <div className="panel comp-left">
      <div className="panel-head"><Icon name="layers" size={13} /> <span className="grow">Láminas y recursos</span></div>
      <div className="panel-body">
        <Section title="Láminas" extra={<button className="icon-btn" aria-label="Nueva lámina" title="Nueva lámina" onClick={(e) => { e.preventDefault(); newComposition() }}><Icon name="plus" size={13} /></button>}>
          {project.compositions.length === 0 && <div className="hint">Aún no hay láminas.</div>}
          <div className="page-tabs">
            {project.compositions.map((c) => (
              <span key={c.id} className={`page-tab ${c.id === project.activeCompositionId ? 'on' : ''}`}>
                <button style={{ background: 'none', border: 0, padding: 0 }} onClick={() => st.setActiveComposition(c.id)}>{c.name}</button>
                <button className="icon-btn" style={{ width: 16, height: 16 }} aria-label={`Eliminar ${c.name}`} title="Eliminar lámina" onClick={() => window.confirm(`¿Eliminar la lámina "${c.name}"?`) && st.removeComposition(c.id)}><Icon name="close" size={10} /></button>
              </span>
            ))}
          </div>
        </Section>
        <Section title="Plantillas">
          {TEMPLATES.map((t) => (
            <div key={t.id} className="tpl-card" role="button" tabIndex={0} onClick={() => applyTemplateToNew(t.id)} onKeyDown={(e) => e.key === 'Enter' && applyTemplateToNew(t.id)}>
              <b>{t.name}</b>
              <span className="hint">{t.desc} Usa los renders de la galería.</span>
            </div>
          ))}
          {custom.length > 0 && <div className="hint" style={{ marginTop: 4 }}>Tus plantillas</div>}
          {custom.map((t) => (
            <div key={t.id} className="tpl-card" role="button" tabIndex={0} onClick={() => applyCustomTemplate(t)}>
              <b>{t.name}</b>
              <span className="hint">{t.page.width}×{t.page.height} · {t.elements.length} elementos</span>
            </div>
          ))}
        </Section>
        <Section title="Añadir a la lámina">
          <div className="grid2" style={{ gap: 6 }}>
            <button className="btn small" onClick={() => addTextElement('title')}><Icon name="text" size={12} /> Título</button>
            <button className="btn small" onClick={() => addTextElement('subtitle')}>Subtítulo</button>
            <button className="btn small" onClick={() => addTextElement('label')}>Etiqueta</button>
            <button className="btn small" onClick={() => addTextElement('body')}>Texto</button>
            <button className="btn small" onClick={() => addTextElement('credits')}>Créditos</button>
            <button className="btn small" onClick={() => addTextElement('watermark')}>Marca de agua</button>
            <button className="btn small" onClick={addRectElement}><Icon name="rect" size={12} /> Marco</button>
            <button className="btn small" onClick={addImageSlot}><Icon name="image" size={12} /> Hueco imagen</button>
          </div>
        </Section>
        <Section title={`Galería (${project.renders.length})`} extra={<button className="icon-btn" aria-label="Añadir imágenes" title="Añadir imágenes desde disco" onClick={(e) => { e.preventDefault(); importImagesToGallery() }}><Icon name="plus" size={13} /></button>}>
          {project.renders.length === 0 && (
            <div className="hint">
              La galería está vacía. Genera renders en el Estudio 3D (<b>Render final</b> o <b>Render aislado</b>) o añade imágenes desde disco.
            </div>
          )}
        </Section>
        <div className="gallery" style={{ paddingTop: 0 }}>
          {project.renders.map((r) => (
            <div
              key={r.id}
              className="thumb"
              draggable
              onDragStart={(e) => e.dataTransfer.setData('text/x-render-id', r.id)}
              onDoubleClick={() => placeRender(r)}
              title={`${r.name} · ${r.width}×${r.height}${r.buildInfo ? ` · ${r.buildInfo.blockCount} bloques` : ''}\nArrastra a la página o doble clic para añadir`}
            >
              <img src={r.dataUrl} alt={r.name} draggable={false} />
              <span className="badge">
                <span className={`tag ${r.source === 'imported' ? '' : 'ok'}`}>{r.source === 'isolated' ? 'AISLADO' : r.source === 'scene' ? 'ESCENA' : 'IMAGEN'}</span>
              </span>
              <span className="del row" style={{ gap: 0 }}>
                <button className="icon-btn" aria-label="Guardar PNG" title="Guardar como PNG" onClick={() => downloadRender(r)}><Icon name="download" size={12} /></button>
                <button className="icon-btn" aria-label="Quitar de la galería" title="Quitar de la galería" onClick={() => window.confirm(`¿Quitar "${r.name}" de la galería?`) && useStore.getState().removeRender(r.id)}><Icon name="trash" size={12} /></button>
              </span>
              <div className="cap">{r.name}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: 10 }}>
          <button className="btn small block" onClick={() => {
            const name = window.prompt('Nombre de la plantilla', activeComposition(useStore.getState())?.name ?? 'Mi plantilla')
            if (name) saveAsTemplate(name)
          }} disabled={!project.activeCompositionId}>Guardar lámina actual como plantilla</button>
        </div>
      </div>
    </div>
  )
}

// ------------------------------------------------------------------------------------- escenario
type Drag =
  | { mode: 'move'; id: string; px: number; py: number; ox: number; oy: number; w: number; h: number }
  | { mode: 'resize'; id: string; handle: string; px: number; py: number; o: { x: number; y: number; w: number; h: number }; aspect: number }

function Stage({ comp }: { comp: Composition }): JSX.Element {
  const wrap = useRef<HTMLDivElement>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const [size, setSize] = useState({ w: 800, h: 600 })
  const [zoom, setZoom] = useState<'fit' | number>('fit')
  const [tick, setTick] = useState(0)
  const [guides, setGuides] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] })
  const drag = useRef<Drag | null>(null)
  const renders = useStore((s) => s.project.renders)
  const selId = useStore((s) => s.compSelectedId)
  const st = useStore.getState()
  const W = comp.page.width, H = comp.page.height
  const fit = Math.min((size.w - 60) / W, (size.h - 60) / H)
  const scale = zoom === 'fit' ? Math.max(0.02, fit) : zoom
  const innerW = Math.max(size.w, W * scale + 60), innerH = Math.max(size.h, H * scale + 60)
  const left = (innerW - W * scale) / 2, top = (innerH - H * scale) / 2

  useEffect(() => {
    if (!wrap.current) return
    const ro = new ResizeObserver(() => wrap.current && setSize({ w: wrap.current.clientWidth, h: wrap.current.clientHeight }))
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [])
  useEffect(() => onImagesLoaded(() => setTick((t) => t + 1)), [])
  useEffect(() => onMcFont(() => setTick((t) => t + 1)), [])

  const renderMap = useMemo(() => new Map(renders.map((r) => [r.id, r])), [renders])
  useEffect(() => {
    const cv = canvas.current
    if (!cv) return
    const dpr = window.devicePixelRatio || 1
    cv.width = Math.max(1, Math.round(W * scale * dpr))
    cv.height = Math.max(1, Math.round(H * scale * dpr))
    const ctx = cv.getContext('2d')!
    ctx.clearRect(0, 0, cv.width, cv.height)
    drawComposition(ctx, comp, scale * dpr, { editor: true, resolve: (id) => getImage(id, renderMap.get(id)?.dataUrl) })
  }, [comp, scale, renderMap, tick, W, H])

  const toPage = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const r = canvas.current!.getBoundingClientRect()
    return { x: (e.clientX - r.left) / scale, y: (e.clientY - r.top) / scale }
  }
  const hit = (p: { x: number; y: number }): CompElement | undefined =>
    [...comp.elements].reverse().find((e) => e.visible && p.x >= e.x && p.x <= e.x + e.w && p.y >= e.y && p.y <= e.y + e.h)

  const snap = (id: string, x: number, y: number, w: number, h: number): { x: number; y: number; gv: number[]; gh: number[] } => {
    if (!comp.snap) return { x, y, gv: [], gh: [] }
    const thr = 7 / scale
    const vx = [0, W, W / 2, comp.margin, W - comp.margin, comp.safeZone, W - comp.safeZone]
    const hy = [0, H, H / 2, comp.margin, H - comp.margin, comp.safeZone, H - comp.safeZone]
    for (const e of comp.elements) if (e.id !== id && e.visible) {
      vx.push(e.x, e.x + e.w, e.x + e.w / 2)
      hy.push(e.y, e.y + e.h, e.y + e.h / 2)
    }
    const best = (pos: number, size2: number, lines: number[]): { d: number; line: number | null } => {
      let bd = thr, bl: number | null = null, delta = 0
      for (const off of [0, size2 / 2, size2]) for (const l of lines) {
        const d = Math.abs(pos + off - l)
        if (d < bd) { bd = d; bl = l; delta = l - (pos + off) }
      }
      return { d: delta, line: bl }
    }
    const sx = best(x, w, vx), sy = best(y, h, hy)
    return { x: x + sx.d, y: y + sy.d, gv: sx.line != null ? [sx.line] : [], gh: sy.line != null ? [sy.line] : [] }
  }

  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.button !== 0) return
    const p = toPage(e)
    const handle = (e.target as HTMLElement).dataset.handle
    const sel = comp.elements.find((x) => x.id === selId)
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    if (handle && sel && !sel.locked) {
      st.commit()
      drag.current = { mode: 'resize', id: sel.id, handle, px: p.x, py: p.y, o: { x: sel.x, y: sel.y, w: sel.w, h: sel.h }, aspect: sel.w / sel.h }
      return
    }
    const h = hit(p)
    st.selectElement(h?.id ?? null)
    if (h && !h.locked) {
      st.commit()
      drag.current = { mode: 'move', id: h.id, px: p.x, py: p.y, ox: h.x, oy: h.y, w: h.w, h: h.h }
    }
  }
  const onPointerMove = (e: React.PointerEvent): void => {
    const d = drag.current
    if (!d) return
    const p = toPage(e)
    if (d.mode === 'move') {
      const r = snap(d.id, d.ox + p.x - d.px, d.oy + p.y - d.py, d.w, d.h)
      setGuides({ v: r.gv, h: r.gh })
      st.updateElement(comp.id, d.id, { x: Math.round(r.x), y: Math.round(r.y) }, false)
    } else {
      const dx = p.x - d.px, dy = p.y - d.py
      let { x, y, w, h } = d.o
      if (d.handle.includes('e')) w = Math.max(8, d.o.w + dx)
      if (d.handle.includes('s')) h = Math.max(8, d.o.h + dy)
      if (d.handle.includes('w')) { w = Math.max(8, d.o.w - dx); x = d.o.x + d.o.w - w }
      if (d.handle.includes('n')) { h = Math.max(8, d.o.h - dy); y = d.o.y + d.o.h - h }
      if (e.shiftKey && d.handle.length === 2) {
        h = w / d.aspect
        if (d.handle.includes('n')) y = d.o.y + d.o.h - h
      }
      st.updateElement(comp.id, d.id, { x: Math.round(x), y: Math.round(y), w: Math.round(w), h: Math.round(h) }, false)
    }
  }
  const onPointerUp = (): void => {
    drag.current = null
    setGuides({ v: [], h: [] })
  }

  const onDrop = (e: React.DragEvent): void => {
    e.preventDefault()
    const id = e.dataTransfer.getData('text/x-render-id')
    const r = renders.find((x) => x.id === id)
    if (!r) return
    const p = toPage(e)
    const target = hit(p)
    placeRender(r, p, target?.type === 'image' ? target : undefined)
  }

  const sel = comp.elements.find((x) => x.id === selId)
  const cap = checkCapacity(W, H, comp.page.quality)
  const handles = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w']
  const hpos = (h: string, el: CompElement): { left: number; top: number } => ({
    left: (h.includes('w') ? el.x : h.includes('e') ? el.x + el.w : el.x + el.w / 2) * scale,
    top: (h.includes('n') ? el.y : h.includes('s') ? el.y + el.h : el.y + el.h / 2) * scale
  })

  return (
    <>
      <div className="comp-toolbar">
        <b style={{ fontSize: 12.5 }}>{comp.name}</b>
        <span className="muted small">{W}×{H} px · {QUALITY_INFO[comp.page.quality].label}</span>
        <span className={`tag ${cap.level === 'ok' ? 'ok' : cap.level === 'warn' ? 'warn' : 'err'}`} title={cap.message}>{cap.level === 'ok' ? 'CAPACIDAD OK' : cap.level === 'warn' ? 'AVISO' : 'EXCEDE EL EQUIPO'}</span>
        <span style={{ flex: 1 }} />
        <button className="btn small" onClick={() => st.setModal({ type: 'pageSetup' })}>Formato…</button>
        <Seg value={zoom === 'fit' ? 'fit' : String(zoom)} onChange={(v) => setZoom(v === 'fit' ? 'fit' : parseFloat(v))} options={[{ value: 'fit', label: 'Ajustar' }, { value: '0.25', label: '25%' }, { value: '0.5', label: '50%' }, { value: '1', label: '100%' }]} />
        <span className="muted small" style={{ width: 40 }}>{Math.round(scale * 100)}%</span>
        <button className="btn small primary" onClick={() => st.setModal({ type: 'export' })} title="Ctrl+E"><Icon name="download" size={12} /> Exportar</button>
      </div>
      <div className="comp-canvas-wrap" ref={wrap} style={{ overflow: zoom === 'fit' ? 'hidden' : 'auto' }}>
        <div style={{ position: 'relative', width: innerW, height: innerH }} onPointerDown={(e) => e.target === e.currentTarget && st.selectElement(null)}>
          <div
            className="page-holder"
            style={{ left, top, width: W * scale, height: H * scale }}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            onDoubleClick={() => sel?.type === 'text' && window.dispatchEvent(new Event('bs-focus-text'))}
          >
            <canvas ref={canvas} aria-label="Vista previa de la lámina" />
            {sel && sel.visible && (
              <>
                <div className="sel-frame" style={{ left: sel.x * scale, top: sel.y * scale, width: sel.w * scale, height: sel.h * scale, borderStyle: sel.locked ? 'dashed' : 'solid' }} />
                {!sel.locked && handles.map((h) => <div key={h} className="handle" data-handle={h} style={{ ...hpos(h, sel), cursor: `${h}-resize` }} />)}
              </>
            )}
            {guides.v.map((g, i) => <div key={`v${i}`} className="guide-line" style={{ left: g * scale, top: 0, width: 1, height: H * scale }} />)}
            {guides.h.map((g, i) => <div key={`h${i}`} className="guide-line" style={{ top: g * scale, left: 0, height: 1, width: W * scale }} />)}
          </div>
        </div>
      </div>
    </>
  )
}

// ------------------------------------------------------------------------------------- panel derecho
function CompRight({ comp }: { comp: Composition | null }): JSX.Element {
  const selId = useStore((s) => s.compSelectedId)
  const renders = useStore((s) => s.project.renders)
  const st = useStore.getState()
  const textRef = useRef<HTMLTextAreaElement>(null)
  useEffect(() => {
    const f = (): void => textRef.current?.focus()
    window.addEventListener('bs-focus-text', f)
    return () => window.removeEventListener('bs-focus-text', f)
  }, [])
  if (!comp) return <div className="panel comp-right"><div className="panel-head">Propiedades</div><div className="empty">Sin lámina activa.</div></div>
  const el = comp.elements.find((e) => e.id === selId)
  const upC = (p: Partial<Composition>, rec = true): void => st.updateComposition(comp.id, p, rec)
  const upE = (p: Partial<CompElement>, rec = true): void => el && st.updateElement(comp.id, el.id, p, rec)
  const upS = (p: Partial<TextStyle>): void => el?.style && upE({ style: { ...el.style, ...p } })
  return (
    <div className="panel comp-right">
      <div className="panel-head"><span className="grow">Propiedades</span></div>
      <div className="panel-body">
        {el && (
          <>
            <Section title={`Elemento · ${el.type === 'text' ? 'Texto' : el.type === 'image' ? 'Imagen' : 'Marco'}`}>
              <Field label="Nombre"><input className="input" value={el.name} onChange={(e) => upE({ name: e.target.value }, false)} /></Field>
              <Field label="Posición"><div className="row"><NumInput value={el.x} onChange={(v) => upE({ x: v })} decimals={0} /><NumInput value={el.y} onChange={(v) => upE({ y: v })} decimals={0} /></div></Field>
              <Field label="Tamaño"><div className="row"><NumInput value={el.w} min={4} onChange={(v) => upE({ w: v })} decimals={0} /><NumInput value={el.h} min={4} onChange={(v) => upE({ h: v })} decimals={0} /></div></Field>
              <Field label="Rotación °"><Slider value={el.rotation} min={-180} max={180} step={1} decimals={0} onChange={(v) => upE({ rotation: v })} /></Field>
              <Field label="Opacidad"><Slider value={el.opacity} min={0} max={1} onChange={(v) => upE({ opacity: v })} /></Field>
              <div className="row">
                <Toggle checked={el.visible} onChange={(v) => upE({ visible: v })} label="Visible" />
                <Toggle checked={el.locked} onChange={(v) => upE({ locked: v })} label="Bloqueado" />
              </div>
              <div className="lbl small muted">Alinear con la página {comp.margin > 0 && '(Alt: con márgenes)'}</div>
              <div className="row">
                {(['l', 'ch', 'r', 't', 'cv', 'b'] as const).map((a) => (
                  <button key={a} className="icon-btn" aria-label={`Alinear ${a}`} title={{ l: 'Izquierda', ch: 'Centro horizontal', r: 'Derecha', t: 'Arriba', cv: 'Centro vertical', b: 'Abajo' }[a]} onClick={(e) => alignElement(comp.id, el, a, e.altKey)}>
                    <Icon name={{ l: 'alignL', ch: 'alignCH', r: 'alignR', t: 'alignT', cv: 'alignCV', b: 'alignB' }[a]} />
                  </button>
                ))}
                <span style={{ flex: 1 }} />
                <button className="icon-btn" aria-label="Traer al frente" title="Traer al frente" onClick={() => st.reorderElement(comp.id, el.id, 'top')}><Icon name="up" /></button>
                <button className="icon-btn" aria-label="Enviar al fondo" title="Enviar al fondo" onClick={() => st.reorderElement(comp.id, el.id, 'bottom')}><Icon name="down" /></button>
                <button className="icon-btn" aria-label="Eliminar elemento" title="Eliminar (Supr)" onClick={() => st.removeElement(comp.id, el.id)}><Icon name="trash" /></button>
              </div>
            </Section>
            {el.type === 'text' && el.style && (
              <Section title="Texto">
                <textarea ref={textRef} className="input" aria-label="Contenido del texto" value={el.text ?? ''} onChange={(e) => upE({ text: e.target.value }, false)} onBlur={() => st.commit()} />
                <Field label="Rol">
                  <Select value={el.style.role} onChange={(role) => {
                    const r = ROLE_STYLE[role]
                    upS({ role, weight: r.weight, color: r.color, letterSpacing: r.letterSpacing, uppercase: r.uppercase, font: r.heading ? comp.fonts.heading : comp.fonts.body })
                  }} options={[{ value: 'title', label: 'Título' }, { value: 'subtitle', label: 'Subtítulo' }, { value: 'label', label: 'Etiqueta' }, { value: 'body', label: 'Texto' }, { value: 'credits', label: 'Créditos' }, { value: 'watermark', label: 'Marca de agua' }]} />
                </Field>
                <Field label="Fuente"><Select value={el.style.font} options={FONT_OPTIONS_FN()} onChange={(v) => upS({ font: v })} /></Field>
                <Field label="Tamaño px"><NumInput value={el.style.size} min={4} step={2} decimals={0} onChange={(v) => upS({ size: v })} /></Field>
                <Field label="Peso"><Seg value={String(el.style.weight)} onChange={(v) => upS({ weight: +v })} options={[{ value: '300', label: 'Fino' }, { value: '400', label: 'Normal' }, { value: '600', label: 'Semi' }, { value: '700', label: 'Negrita' }]} /></Field>
                <Field label="Color"><ColorInput value={el.style.color} onChange={(v) => upS({ color: v })} /></Field>
                <Field label="Alineación"><Seg value={el.style.align} onChange={(v) => upS({ align: v })} options={[{ value: 'left', label: 'Izq.' }, { value: 'center', label: 'Centro' }, { value: 'right', label: 'Der.' }]} /></Field>
                <Field label="Espaciado"><Slider value={el.style.letterSpacing} min={-2} max={20} step={0.5} decimals={1} onChange={(v) => upS({ letterSpacing: v })} /></Field>
                <Field label="Interlineado"><Slider value={el.style.lineHeight} min={0.8} max={2.4} onChange={(v) => upS({ lineHeight: v })} /></Field>
                <div className="row">
                  <Toggle checked={el.style.italic} onChange={(v) => upS({ italic: v })} label="Cursiva" />
                  <Toggle checked={el.style.uppercase} onChange={(v) => upS({ uppercase: v })} label="Mayúsculas" />
                  <Toggle checked={!!el.shadow} onChange={(v) => upE({ shadow: v })} label="Sombra" />
                </div>
              </Section>
            )}
            {el.type === 'image' && (
              <Section title="Imagen">
                <Field label="Render">
                  <Select value={el.imageId ?? ''} options={[{ value: '', label: '(hueco vacío)' }, ...renders.map((r) => ({ value: r.id, label: r.name }))]} onChange={(v) => upE({ imageId: v || null })} />
                </Field>
                <Field label="Ajuste"><Seg value={el.fit ?? 'contain'} onChange={(v) => upE({ fit: v })} options={[{ value: 'contain', label: 'Contener' }, { value: 'cover', label: 'Recortar' }]} /></Field>
                <Field label="Sombra"><Toggle checked={!!el.shadow} onChange={(v) => upE({ shadow: v })} /></Field>
                <Field label="Esquinas"><Slider value={el.radius ?? 0} min={0} max={200} step={1} decimals={0} onChange={(v) => upE({ radius: v })} /></Field>
                {(() => {
                  const r = renders.find((x) => x.id === el.imageId)
                  if (!r) return null
                  const eff = Math.min(r.width / el.w, r.height / el.h)
                  return eff < 0.75 ? <div className="hint warn">La imagen ({r.width}×{r.height}) es más pequeña que el hueco: se verá ampliada. Haz un render a mayor resolución.</div> : <div className="hint">Origen: {r.width}×{r.height} px</div>
                })()}
              </Section>
            )}
            {el.type === 'rect' && (
              <Section title="Marco">
                <Field label="Relleno"><ColorInput value={el.fill ?? '#000000'} onChange={(v) => upE({ fill: v })} /></Field>
                <Field label="Esquinas"><Slider value={el.radius ?? 0} min={0} max={300} step={1} decimals={0} onChange={(v) => upE({ radius: v })} /></Field>
                <Field label="Borde"><ColorInput value={el.stroke ?? '#ffffff'} onChange={(v) => upE({ stroke: v })} /></Field>
                <Field label="Grosor borde"><Slider value={el.strokeWidth ?? 0} min={0} max={40} step={1} decimals={0} onChange={(v) => upE({ strokeWidth: v })} /></Field>
              </Section>
            )}
          </>
        )}
        <Section title="Página" open={!el}>
          <Field label="Nombre"><input className="input" value={comp.name} onChange={(e) => upC({ name: e.target.value }, false)} /></Field>
          <div className="row"><span className="muted small" style={{ flex: 1 }}>{comp.page.width}×{comp.page.height} px · calidad {QUALITY_INFO[comp.page.quality].label.toLowerCase()}</span><button className="btn small" onClick={() => st.setModal({ type: 'pageSetup' })}>Cambiar…</button></div>
          <Field label="Fondo"><Seg value={comp.background.type} onChange={(v) => upC({ background: { ...comp.background, type: v } })} options={[{ value: 'solid', label: 'Liso' }, { value: 'linear', label: 'Lineal' }, { value: 'radial', label: 'Radial' }]} /></Field>
          <Field label="Color 1"><ColorInput value={comp.background.color1} onChange={(v) => upC({ background: { ...comp.background, color1: v } })} /></Field>
          {comp.background.type !== 'solid' && <Field label="Color 2"><ColorInput value={comp.background.color2} onChange={(v) => upC({ background: { ...comp.background, color2: v } })} /></Field>}
          {comp.background.type === 'linear' && <Field label="Ángulo"><Slider value={comp.background.angle} min={0} max={360} step={1} decimals={0} onChange={(v) => upC({ background: { ...comp.background, angle: v } })} /></Field>}
        </Section>
        <Section title="Estilo tipográfico" open={!el}>
          <div className="row wrap">
            {TYPE_STYLES.map((t) => (
              <button key={t.id} className={`btn small ${comp.fonts.heading === t.heading && comp.fonts.body === t.body ? 'primary' : ''}`} style={{ fontFamily: t.heading }} onClick={() => upC({
                fonts: { heading: t.heading, body: t.body },
                elements: comp.elements.map((e) => e.style ? { ...e, style: { ...e.style, font: ROLE_STYLE[e.style.role].heading ? t.heading : t.body } } : e)
              })}>{t.label}</button>
            ))}
          </div>
          <Field label="Títulos"><Select value={comp.fonts.heading} options={FONT_OPTIONS_FN()} onChange={(v) => upC({ fonts: { ...comp.fonts, heading: v } })} /></Field>
          <Field label="Texto"><Select value={comp.fonts.body} options={FONT_OPTIONS_FN()} onChange={(v) => upC({ fonts: { ...comp.fonts, body: v } })} /></Field>
          <div className="hint">Se usan fuentes instaladas en el sistema (Windows). Si falta una, se sustituye por Segoe UI.</div>
        </Section>
        <Section title="Guías y márgenes" open={!el}>
          <Field label="Mostrar guías"><Toggle checked={comp.showGuides} onChange={(v) => upC({ showGuides: v })} /></Field>
          <Field label="Ajustar a guías"><Toggle checked={comp.snap} onChange={(v) => upC({ snap: v })} /></Field>
          <Field label="Margen px"><NumInput value={comp.margin} min={0} decimals={0} onChange={(v) => upC({ margin: v })} /></Field>
          <Field label="Zona segura px"><NumInput value={comp.safeZone} min={0} decimals={0} onChange={(v) => upC({ safeZone: v })} /></Field>
          <div className="hint">Azul: márgenes · Naranja: zona segura (recorte de impresión o pantallas). Las guías no se exportan.</div>
        </Section>
        <Section title={`Elementos (${comp.elements.length})`}>
          <div className="layers-list" style={{ margin: '0 -10px' }}>
            {[...comp.elements].reverse().map((e) => (
              <div key={e.id} className={`tree-row ${e.id === selId ? 'sel' : ''}`} onClick={() => st.selectElement(e.id)}>
                <span className="kind"><Icon name={e.type === 'text' ? 'text' : e.type === 'image' ? 'image' : 'rect'} size={13} /></span>
                <span className={`name ${e.visible ? '' : 'dim'}`}>{e.type === 'text' ? (e.text || e.name).slice(0, 40) : e.name}</span>
                <button className="icon-btn" aria-label={e.locked ? 'Desbloquear' : 'Bloquear'} onClick={(ev) => { ev.stopPropagation(); st.updateElement(comp.id, e.id, { locked: !e.locked }) }}><Icon name={e.locked ? 'lock' : 'unlock'} size={12} /></button>
                <button className="icon-btn" aria-label={e.visible ? 'Ocultar' : 'Mostrar'} onClick={(ev) => { ev.stopPropagation(); st.updateElement(comp.id, e.id, { visible: !e.visible }) }}><Icon name={e.visible ? 'eye' : 'eyeOff'} size={12} /></button>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}

export { PAGE_PRESETS }
