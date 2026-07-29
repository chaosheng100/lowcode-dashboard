import type { PropField } from './propSchemas'
import type { WidgetProps } from '../../data/types'
import type { ReactNode } from 'react'
import { ColorPicker, Form, Input, InputNumber, Select, Switch } from 'antd'

/** 实时数据源动态选项（由 PropertyPanel 从 api.listDataSources 注入） */
export interface LiveSourceOption {
  id: string
  kind: string
  name: string
}

/** 孪生场景动态选项 */
export interface TwinSceneOption {
  value: string
  label: string
}

interface Props {
  schema: PropField[]
  value: WidgetProps
  onChange: (patch: Partial<WidgetProps>) => void
  liveSources?: LiveSourceOption[]
  twinSceneOptions?: TwinSceneOption[]
}

/**
 * Schema 驱动的属性表单（对齐 Avue AvueForm）。
 * 根据 propSchemas 自动渲染对应类型的输入控件，统一写回 updateComponentProps。
 */
export default function SchemaForm({ schema, value, onChange, liveSources, twinSceneOptions }: Props) {
  return (
    <>
      {schema.map((f) => {
        if (f.show && !f.show(value)) return null
        const v = value[f.key]
        const key = String(f.key)
        const item = (control: ReactNode) => (
          <Form.Item key={key} label={f.label} colon={false} style={{ marginBottom: 11 }}>
            {control}
          </Form.Item>
        )

        if (f.type === 'boolean') {
          return item(<Switch checked={!!v} onChange={(c) => onChange({ [f.key]: c } as Partial<WidgetProps>)} />)
        }

        if (f.type === 'select') {
          const opts =
            f.dynamicOptions === 'liveSources'
              ? (liveSources ?? []).map((d) => ({ value: `${d.kind}:${d.id}`, label: `${d.kind} · ${d.name}` }))
              : f.dynamicOptions === 'twinScenes'
              ? (twinSceneOptions ?? [])
              : f.options ?? []
          const options = [
            ...(f.dynamicOptions === 'liveSources' ? [{ value: '', label: '— 不启用实时 —' }] : []),
            ...(f.dynamicOptions === 'twinScenes' ? [{ value: 'main', label: '示范工厂（默认）' }] : []),
            ...opts,
            ...(f.dynamicOptions === 'liveSources' && !opts.length
              ? [
                  { value: 'sql:orders', label: 'SQL · 订单量轮询' },
                  { value: 'ws:metrics', label: 'WebSocket · 系统指标流' },
                  { value: 'mqtt:sensors', label: 'MQTT · 传感器主题' },
                ]
              : []),
          ]
          return item(
            <Select
              style={{ width: '100%' }}
              value={v != null ? String(v) : ''}
              options={options}
              onChange={(val) => onChange({ [f.key]: (val || undefined) as never } as Partial<WidgetProps>)}
            />
          )
        }

        if (f.type === 'textarea') {
          return item(
            <Input.TextArea
              style={{ minHeight: 200, fontFamily: 'monospace' }}
              value={(v as string) ?? ''}
              onChange={(e) => onChange({ [f.key]: e.target.value } as Partial<WidgetProps>)}
            />
          )
        }

        if (f.type === 'color') {
          return item(
            <ColorPicker
              value={(v as string) || '#4f8cff'}
              onChange={(c) => onChange({ [f.key]: c.toHexString() } as Partial<WidgetProps>)}
            />
          )
        }

        if (f.type === 'number') {
          return item(
            <InputNumber
              style={{ width: '100%' }}
              value={(v as number) ?? 0}
              min={f.min}
              step={f.step}
              onChange={(num) => onChange({ [f.key]: num ?? 0 } as Partial<WidgetProps>)}
            />
          )
        }

        // text
        return item(
          <Input
            value={(v as string) ?? ''}
            placeholder={f.placeholder}
            onChange={(e) => onChange({ [f.key]: e.target.value } as Partial<WidgetProps>)}
          />
        )
      })}
    </>
  )
}
