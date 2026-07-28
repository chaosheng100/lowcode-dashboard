import { useState, useEffect } from 'react'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import type { ComponentInstance, RouteConfig, WidgetType } from '../../data/types'
import { api } from '../../mock'
import type { DatasetDTO, DataSourceDTO } from '../../mock/types'
import type { DataPoint } from '../../data/types'
import CanvasPanel from './CanvasPanel'
import SchemaForm from './SchemaForm'
import { styleSchemas, dataSchemas } from './propSchemas'

const interactiveTypes: WidgetType[] = ['barChart', 'pieChart', 'table', 'echartLine', 'echartBar', 'echartPie']
/** 支持数据绑定的组件类型 */
const dataTypes: WidgetType[] = [
  'lineChart', 'barChart', 'pieChart', 'metric', 'table',
  'echartLine', 'echartBar', 'echartPie', 'echartGauge', 'echartRadar'
]

export default function PropertyPanel() {
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

  useEffect(() => {
    if (component && component.props.data) {
      setDataText(JSON.stringify(component.props.data, null, 2))
    }
  }, [selectedId])

  useEffect(() => {
    let alive = true
    Promise.all([
      api.listDatasets({ pageSize: 50 }),
      api.listDataSources({ pageSize: 50 })
    ])
      .then(([dr, dsr]) => {
        if (!alive) return
        if (dr.code === 0) setDatasets(dr.data.list)
        if (dsr.code === 0) setDataSources(dsr.data.list)
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
      alert('JSON 解析失败：' + (e as Error).message)
    }
  }

  return (
    <div className="panel-right">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <strong>属性 · {component.type}</strong>
        <button className="btn" style={{ padding: '4px 10px' }} onClick={() => removeComponent(component.id)}>
          删除
        </button>
      </div>

      <div className="pp-tabs">
        <div className={'tab' + (tab === 'style' ? ' active' : '')} onClick={() => setTab('style')}>
          样式
        </div>
        <div className={'tab' + (tab === 'data' ? ' active' : '')} onClick={() => setTab('data')}>
          数据
        </div>
        <div className={'tab' + (tab === 'event' ? ' active' : '')} onClick={() => setTab('event')}>
          交互
        </div>
      </div>

      {tab === 'style' && (
        <>
          <div className="row2">
            <div className="field">
              <label>X</label>
              <input
                type="number"
                value={Math.round(component.style.x)}
                onChange={(e) => updateStyle(component.id, { x: +e.target.value })}
              />
            </div>
            <div className="field">
              <label>Y</label>
              <input
                type="number"
                value={Math.round(component.style.y)}
                onChange={(e) => updateStyle(component.id, { y: +e.target.value })}
              />
            </div>
          </div>
          <div className="row2">
            <div className="field">
              <label>宽</label>
              <input
                type="number"
                value={Math.round(component.style.w)}
                onChange={(e) => updateStyle(component.id, { w: +e.target.value })}
              />
            </div>
            <div className="field">
              <label>高</label>
              <input
                type="number"
                value={Math.round(component.style.h)}
                onChange={(e) => updateStyle(component.id, { h: +e.target.value })}
              />
            </div>
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
              onChange={(patch) => updateProps(component.id, patch)}
            />
          )}
          {hasData && (
            <>
              <div className="field">
                <label>数据集绑定（数据源 → 画布）</label>
                <select
                  value={p.dataSourceId || ''}
                  onChange={(e) => bindDataset(e.target.value)}
                >
                  <option value="">— 手动数据 —</option>
                  {datasets.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>数据 (JSON: [{'{ name, value }'}])</label>
                <textarea value={dataText} onChange={(e) => setDataText(e.target.value)} onBlur={applyData} />
              </div>
              {isInteractive && (
                <div className="field">
                  <label>联动字段 (filterField)</label>
                  <input value={p.filterField} onChange={(e) => updateProps(component.id, { filterField: e.target.value })} />
                </div>
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
              <div className="field">
                <label>点击行为</label>
                <select
                  value={p.interactive ? 'link' : 'none'}
                  onChange={(e) => updateProps(component.id, { interactive: e.target.value === 'link' })}
                >
                  <option value="none">无</option>
                  <option value="link">联动（设置全局筛选）</option>
                </select>
              </div>
              <div className="field">
                <label>联动字段 (filterField)</label>
                <input value={p.filterField} onChange={(e) => updateProps(component.id, { filterField: e.target.value })} />
              </div>
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
