import { useState, useEffect } from 'react'
import { App, Button, Form, Input, InputNumber, Select, Tabs } from 'antd'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import type { ComponentInstance, RouteConfig, WidgetType } from '../../data/types'
import { api } from '../../mock'
import type { DatasetDTO, DataSourceDTO, TwinSceneDTO } from '../../mock/types'
import type { DataPoint } from '../../data/types'
import type { TwinSceneOption } from './SchemaForm'
import CanvasPanel from './CanvasPanel'
import SchemaForm from './SchemaForm'
import { styleSchemas, dataSchemas } from './propSchemas'

const interactiveTypes: WidgetType[] = ['barChart', 'pieChart', 'table', 'echartLine', 'echartBar', 'echartPie', 'digitalTwin', 'twinAlarm']
/** 支持数据绑定的组件类型 */
const dataTypes: WidgetType[] = [
  'lineChart', 'barChart', 'pieChart', 'metric', 'table',
  'echartLine', 'echartBar', 'echartPie', 'echartGauge', 'echartRadar'
]

export default function PropertyPanel() {
  const { message } = App.useApp()
  const selectedId = useDesignerStore((s) => s.selectedId)
  const route = useDesignerStore(
    (s) => s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0]
  )! as RouteConfig
  const component: ComponentInstance | undefined = route.components.find((c) => c.id === selectedId)
  const updateProps = useDesignerStore((s) => s.updateComponentProps)
  const updateStyle = useDesignerStore((s) => s.updateComponentStyle)
  const removeComponent = useDesignerStore((s) => s.removeComponent)

  const [tab, setTab] = useState<'style' | 'data' | 'event'>('style')
  const [dataText, setDataText] = useState('')
  const [datasets, setDatasets] = useState<DatasetDTO[]>([])
  const [dataSources, setDataSources] = useState<DataSourceDTO[]>([])
  const [twinSceneOptions, setTwinSceneOptions] = useState<TwinSceneOption[]>([])

  useEffect(() => {
    if (component && component.props.data) {
      setDataText(JSON.stringify(component.props.data, null, 2))
    }
  }, [selectedId])

  useEffect(() => {
    let alive = true
    Promise.all([
      api.listDatasets({ pageSize: 50 }),
      api.listDataSources({ pageSize: 50 }),
      api.listTwinScenes({ pageSize: 100 })
    ])
      .then(([dr, dsr, tsr]) => {
        if (!alive) return
        if (dr.code === 0) setDatasets(dr.data.list)
        if (dsr.code === 0) setDataSources(dsr.data.list)
        if (tsr.code === 0) {
          setTwinSceneOptions(
            tsr.data.list.map((s: TwinSceneDTO) => ({
              value: s.id,
              label: `${s.name} · ${s.models.length}个模型`
            }))
          )
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

  // 可作为实时源的数据源（SQL / WebSocket / MQTT / API / Flow）
  const liveSources = dataSources.filter((d) =>
    ['sql', 'websocket', 'mqtt', 'api', 'flow'].includes(d.kind)
  )

  const bindDataset = async (datasetId: string) => {
    if (!datasetId || !component) return
    const r = await api.queryDataset(datasetId, { pageSize: 12 })
    const data: DataPoint[] = r.data.list.map((row) => ({
      name: String((row as Record<string, string>).region ?? (row as Record<string, string>).metric ?? ''),
      value: Number((row as Record<string, number>).value)
    }))
    updateProps(component.id, { data, dataSourceId: datasetId })
  }

  if (!component) {
    return <CanvasPanel />
  }

  const p = component.props
  const hasData = dataTypes.includes(component.type)
  const isInteractive = interactiveTypes.includes(component.type)
  const styleSchema = styleSchemas[component.type]
  const dataSchema = dataSchemas[component.type]

  const applyData = () => {
    try {
      const parsed = JSON.parse(dataText)
      updateProps(component.id, { data: parsed })
    } catch (e) {
      message.error('JSON 解析失败：' + (e as Error).message)
    }
  }

  return (
    <div className="panel-right">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong>属性 · {component.type}</strong>
        <Button danger size="small" onClick={() => removeComponent(component.id)}>
          删除
        </Button>
      </div>

      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as 'style' | 'data' | 'event')}
        items={[
          { key: 'style', label: '样式' },
          { key: 'data', label: '数据' },
          { key: 'event', label: '交互' }
        ]}
      />

      {tab === 'style' && (
        <>
          <div className="row2">
            <Form.Item label="X" colon={false} style={{ marginBottom: 11 }}>
              <InputNumber
                style={{ width: '100%' }}
                value={Math.round(component.style.x)}
                onChange={(v) => updateStyle(component.id, { x: v ?? 0 })}
              />
            </Form.Item>
            <Form.Item label="Y" colon={false} style={{ marginBottom: 11 }}>
              <InputNumber
                style={{ width: '100%' }}
                value={Math.round(component.style.y)}
                onChange={(v) => updateStyle(component.id, { y: v ?? 0 })}
              />
            </Form.Item>
          </div>
          <div className="row2">
            <Form.Item label="宽" colon={false} style={{ marginBottom: 11 }}>
              <InputNumber
                style={{ width: '100%' }}
                value={Math.round(component.style.w)}
                onChange={(v) => updateStyle(component.id, { w: v ?? 0 })}
              />
            </Form.Item>
            <Form.Item label="高" colon={false} style={{ marginBottom: 11 }}>
              <InputNumber
                style={{ width: '100%' }}
                value={Math.round(component.style.h)}
                onChange={(v) => updateStyle(component.id, { h: v ?? 0 })}
              />
            </Form.Item>
          </div>
          {styleSchema && (
            <SchemaForm
              schema={styleSchema}
              value={p}
              onChange={(patch) => updateProps(component.id, patch)}
            />
          )}
        </>
      )}

      {tab === 'data' && (
        <>
          {dataSchema && (
            <SchemaForm
              schema={dataSchema}
              value={p}
              liveSources={liveSources}
              twinSceneOptions={twinSceneOptions}
              onChange={(patch) => updateProps(component.id, patch)}
            />
          )}
          {hasData && (
            <>
              <Form.Item label="数据集绑定（数据源 → 画布）" colon={false} style={{ marginBottom: 11 }}>
                <Select
                  style={{ width: '100%' }}
                  value={p.dataSourceId || ''}
                  onChange={(v) => bindDataset(v)}
                  options={[
                    { value: '', label: '— 手动数据 —' },
                    ...datasets.map((d) => ({ value: d.id, label: d.name }))
                  ]}
                />
              </Form.Item>
              <Form.Item label="数据 (JSON: [{ name, value }])" colon={false} style={{ marginBottom: 11 }}>
                <Input.TextArea
                  style={{ minHeight: 160, fontFamily: 'monospace' }}
                  value={dataText}
                  onChange={(e) => setDataText(e.target.value)}
                  onBlur={applyData}
                />
              </Form.Item>
              {isInteractive && (
                <Form.Item label="联动字段 (filterField)" colon={false} style={{ marginBottom: 11 }}>
                  <Input
                    value={p.filterField}
                    onChange={(e) => updateProps(component.id, { filterField: e.target.value })}
                  />
                </Form.Item>
              )}
            </>
          )}
          {!hasData && !dataSchema && <div className="empty-tip">该组件无可配置数据</div>}
        </>
      )}

      {tab === 'event' && (
        <>
          {isInteractive ? (
            <>
              <Form.Item label="点击行为" colon={false} style={{ marginBottom: 11 }}>
                <Select
                  style={{ width: '100%' }}
                  value={p.interactive ? 'link' : 'none'}
                  onChange={(v) => updateProps(component.id, { interactive: v === 'link' })}
                  options={[
                    { value: 'none', label: '无' },
                    { value: 'link', label: '联动（设置全局筛选）' }
                  ]}
                />
              </Form.Item>
              <Form.Item label="联动字段 (filterField)" colon={false} style={{ marginBottom: 11 }}>
                <Input
                  value={p.filterField}
                  onChange={(e) => updateProps(component.id, { filterField: e.target.value })}
                />
              </Form.Item>
              <div className="empty-tip" style={{ padding: 12 }}>
                点击该组件的数据元素，将把所有「联动字段」相同的组件筛选为该值。
              </div>
            </>
          ) : (
            <div className="empty-tip">该组件暂不支持联动交互</div>
          )}
        </>
      )}
    </div>
  )
}
