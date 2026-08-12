import { useState, useEffect } from 'react'
import { App, Button, Form, Input, InputNumber, Select, Tabs } from 'antd'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import type { ComponentInstance, RouteConfig, WidgetType } from '../../data/types'
import type { ComponentDataBinding } from '../../data/types'
import { api } from '../../mock'
import type { DatasetDTO, DataSourceDTO, TwinSceneDTO, IoTDeviceDTO } from '../../mock/types'
import type { DataPoint } from '../../data/types'
import type { TwinSceneOption, IoTDeviceOption } from './SchemaForm'
import CanvasPanel from './CanvasPanel'
import SchemaForm from './SchemaForm'
import { styleSchemas, dataSchemas } from './propSchemas'

const interactiveTypes: WidgetType[] = ['barChart', 'pieChart', 'table', 'echartLine', 'echartBar', 'echartPie', 'digitalTwin', 'twinAlarm']
/** 支持数据绑定的组件类型 */
const dataTypes: WidgetType[] = [
  'lineChart', 'barChart', 'pieChart', 'metric', 'table',
  'echartLine', 'echartBar', 'echartPie', 'echartGauge', 'echartRadar', 'echartCustom'
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
  const updateComponentDataSource = useDesignerStore((s) => s.updateComponentDataSource)
  const removeComponent = useDesignerStore((s) => s.removeComponent)

  const [tab, setTab] = useState<'style' | 'data' | 'event'>('style')
  const [dataText, setDataText] = useState('')
  const [datasets, setDatasets] = useState<DatasetDTO[]>([])
  const [selectedXField, setSelectedXField] = useState('')
  const [selectedYField, setSelectedYField] = useState('')
  const [dataSources, setDataSources] = useState<DataSourceDTO[]>([])
  const [twinSceneOptions, setTwinSceneOptions] = useState<TwinSceneOption[]>([])
  const [iotDeviceOptions, setIotDeviceOptions] = useState<IoTDeviceOption[]>([])

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
      api.listTwinScenes({ pageSize: 100 }),
      api.listIoTDevices({ pageSize: 100 })
    ])
      .then(([dr, dsr, tsr, iotR]) => {
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
        if (iotR.code === 0) {
          setIotDeviceOptions(
            iotR.data.list.map((d: IoTDeviceDTO) => ({
              value: d.id,
              label: `${d.name} · ${d.type}`,
              metrics: Object.keys(d.metrics)
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

  /** 执行数据集查询 + 语义字段映射 + 写入 dataSource */
  const doBind = async (datasetId: string, xField: string, yField: string) => {
    if (!datasetId || !component) return
    const r = await api.queryDataset(datasetId, { pageSize: 12 })
    const rows = Array.isArray(r.data?.list) ? r.data.list : []
    const data: DataPoint[] = rows.map((row) => ({
      name: String((row as Record<string, unknown>)[xField] ?? ''),
      value: Number((row as Record<string, unknown>)[yField]) || 0
    }))
    const ds = datasets.find((d) => d.id === datasetId)
    const binding: ComponentDataBinding = { datasetId, xField, yField, datasetName: ds?.name }
    updateProps(component.id, { data, title: ds?.name, dataSourceId: datasetId, dataSourceName: ds?.name })
    updateComponentDataSource(component.id, binding)
    setDataText(JSON.stringify(data, null, 2))
  }

  /** 选择数据集：自动推断维度/指标字段，查询并写入 */
  const selectDataset = async (datasetId: string) => {
    if (!datasetId || !component) return
    const ds = datasets.find((d) => d.id === datasetId)
    if (!ds) return
    const fields = ds.fields ?? []
    const dimField = fields.find((f) => f.semanticType === 'dimension')
    const metricField = fields.find((f) => f.semanticType === 'metric')
    const xField = dimField?.fieldKey ?? fields[0]?.fieldKey ?? 'name'
    const yField = metricField?.fieldKey ?? fields[1]?.fieldKey ?? 'value'
    setSelectedXField(xField)
    setSelectedYField(yField)
    await doBind(datasetId, xField, yField)
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
              iotDeviceOptions={iotDeviceOptions}
              onChange={(patch) => {
                // 物联设备级联：选设备后自动关联首个指标并同步指标卡标签/数据；
                // 解绑设备时清空指标选择；切换指标时同步标签。
                if ('iotDeviceId' in patch) {
                  const deviceId = patch.iotDeviceId
                  if (!deviceId) {
                    updateProps(component.id, { ...patch, iotMetric: undefined })
                    return
                  }
                  const device = iotDeviceOptions.find((d) => d.value === deviceId)
                  const firstMetric = device?.metrics[0]
                  if (firstMetric) {
                    const deviceName = device?.label.split(' · ')[0] ?? ''
                    updateProps(component.id, {
                      ...patch,
                      iotMetric: firstMetric,
                      label: `${deviceName} · ${firstMetric}`
                    })
                    return
                  }
                }
                if ('iotMetric' in patch && patch.iotMetric) {
                  const deviceName = iotDeviceOptions.find((d) => d.value === p.iotDeviceId)?.label.split(' · ')[0] ?? ''
                  updateProps(component.id, { ...patch, label: `${deviceName} · ${patch.iotMetric}` })
                  return
                }
                updateProps(component.id, patch)
              }}
            />
          )}
          {hasData && (
            <>
              <Form.Item label="数据集绑定（数据源 → 画布）" colon={false} style={{ marginBottom: 11 }}>
                <Select
                  style={{ width: '100%' }}
                  value={p.dataSourceId || ''}
                  onChange={(v) => selectDataset(v)}
                  options={[
                    { value: '', label: '— 手动数据 —' },
                    ...datasets.map((d) => ({ value: d.id, label: d.name }))
                  ]}
                />
              </Form.Item>
              {p.dataSourceId && (() => {
                const ds = datasets.find((d) => d.id === p.dataSourceId)
                const fields = ds?.fields ?? []
                const dimFields = fields.filter((f) => f.semanticType === 'dimension')
                const metricFields = fields.filter((f) => f.semanticType === 'metric')
                return (
                  <>
                    <Form.Item label="维度字段（横轴）" colon={false} style={{ marginBottom: 11 }}>
                      <Select
                        style={{ width: '100%' }}
                        value={selectedXField || undefined}
                        onChange={async (v) => { setSelectedXField(v); await doBind(p.dataSourceId!, v, selectedYField) }}
                        options={dimFields.map((f) => ({ value: f.fieldKey, label: `${f.label} (${f.fieldKey})` }))}
                      />
                    </Form.Item>
                    <Form.Item label="指标字段（纵轴）" colon={false} style={{ marginBottom: 11 }}>
                      <Select
                        style={{ width: '100%' }}
                        value={selectedYField || undefined}
                        onChange={async (v) => { setSelectedYField(v); await doBind(p.dataSourceId!, selectedXField, v) }}
                        options={metricFields.map((f) => ({ value: f.fieldKey, label: `${f.label} (${f.fieldKey})` }))}
                      />
                    </Form.Item>
                  </>
                )
              })()}
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
