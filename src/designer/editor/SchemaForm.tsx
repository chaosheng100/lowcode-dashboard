import type { PropField } from './propSchemas'
import type { WidgetProps } from '../../data/types'

/** 实时数据源动态选项（由 PropertyPanel 从 api.listDataSources 注入） */
export interface LiveSourceOption {
  id: string
  kind: string
  name: string
}

interface Props {
  schema: PropField[]
  value: WidgetProps
  onChange: (patch: Partial<WidgetProps>) => void
  liveSources?: LiveSourceOption[]
}

/**
 * Schema 驱动的属性表单（对齐 Avue AvueForm）。
 * 根据 propSchemas 自动渲染对应类型的输入控件，统一写回 updateComponentProps。
 */
export default function SchemaForm({ schema, value, onChange, liveSources }: Props) {
  return (
    <>
      {schema.map((f) => {
        if (f.show && !f.show(value)) return null
        const v = value[f.key]
        const key = String(f.key)

        if (f.type === 'boolean') {
          return (
            <div className="field" key={key}>
              <label>{f.label}</label>
              <select className="inp" value={v ? 'yes' : 'no'} onChange={(e) => onChange({ [f.key]: e.target.value === 'yes' } as Partial<WidgetProps>)}>
                <option value="no">否</option>
                <option value="yes">是</option>
              </select>
            </div>
          )
        }

        if (f.type === 'select') {
          const opts =
            f.dynamicOptions === 'liveSources'
              ? (liveSources ?? []).map((d) => ({ value: `${d.kind}:${d.id}`, label: `${d.kind} · ${d.name}` }))
              : f.options ?? []
          return (
            <div className="field" key={key}>
              <label>{f.label}</label>
              <select className="inp" value={v != null ? String(v) : ''} onChange={(e) => onChange({ [f.key]: (e.target.value || undefined) as never } as Partial<WidgetProps>)}>
                {f.dynamicOptions && <option value="">— 不启用实时 —</option>}
                {opts.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
                {f.dynamicOptions && !opts.length && (
                  <>
                    <option value="sql:orders">SQL · 订单量轮询</option>
                    <option value="ws:metrics">WebSocket · 系统指标流</option>
                    <option value="mqtt:sensors">MQTT · 传感器主题</option>
                  </>
                )}
              </select>
            </div>
          )
        }

        if (f.type === 'textarea') {
          return (
            <div className="field" key={key}>
              <label>{f.label}</label>
              <textarea
                className="inp"
                style={{ minHeight: 200, fontFamily: 'monospace' }}
                value={(v as string) ?? ''}
                onChange={(e) => onChange({ [f.key]: e.target.value } as Partial<WidgetProps>)}
              />
            </div>
          )
        }

        if (f.type === 'color') {
          return (
            <div className="field" key={key}>
              <label>{f.label}</label>
              <input type="color" value={(v as string) || '#4f8cff'} onChange={(e) => onChange({ [f.key]: e.target.value } as Partial<WidgetProps>)} />
            </div>
          )
        }

        if (f.type === 'number') {
          return (
            <div className="field" key={key}>
              <label>{f.label}</label>
              <input type="number" value={(v as number) ?? 0} min={f.min} step={f.step} onChange={(e) => onChange({ [f.key]: +e.target.value } as Partial<WidgetProps>)} />
            </div>
          )
        }

        // text
        return (
          <div className="field" key={key}>
            <label>{f.label}</label>
            <input className="inp" value={(v as string) ?? ''} placeholder={f.placeholder} onChange={(e) => onChange({ [f.key]: e.target.value } as Partial<WidgetProps>)} />
          </div>
        )
      })}
    </>
  )
}
