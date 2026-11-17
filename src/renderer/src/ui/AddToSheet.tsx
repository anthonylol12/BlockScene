// «Añadir a lámina»: elige plantilla y abre el render en el Compositor.
import { useState, type JSX } from 'react'
import { addRenderToSheet } from '../compositor/compActions'
import type { TemplateId } from '../compositor/templates'
import { TEMPLATE_OPTIONS } from '../state/wizard'
import { Select } from './controls'

export function AddToSheet({ renderId, transparent, onDone }: { renderId: string; transparent: boolean; onDone: () => void }): JSX.Element {
  // un render con fondo transparente queda mejor recortado sobre la lámina; uno con fondo, a pantalla completa
  const [tpl, setTpl] = useState<TemplateId>(transparent ? 'bundle' : 'showcase')
  return (
    <div className="row" style={{ gap: 6 }}>
      <Select<TemplateId> value={tpl} onChange={setTpl} ariaLabel="Plantilla de la lámina" options={TEMPLATE_OPTIONS.map((t) => ({ value: t.id, label: t.label }))} />
      <button className="btn small primary" onClick={() => addRenderToSheet(renderId, tpl) && onDone()}>Añadir a lámina</button>
    </div>
  )
}
