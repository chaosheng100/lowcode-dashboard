import { useState, useEffect } from 'react'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import type { ComponentInstance, RouteConfig, WidgetType } from '../../data/types'
import { api } from '../../mock'
import type { DatasetDTO } from '../../mock/types'
import type { DataPoint } from '../../data/types'
import CanvasPanel from './CanvasPanel'

const interactiveTypes: WidgetType[] = ['barChart', 'pieChart', 'table']

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

  useEffect(() => {
    if (component && component.props.data) {
      setDataText(JSON.stringify(component.props.data, null, 2))
    }
  }, [selectedId])

  useEffect(() => {
    let alive = true
    api
      .listDatasets({ pageSize: 50 })
      .then((r) => alive && setDatasets(r.data.list))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [])

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
  const hasData = ['lineChart', 'barChart', 'pieChart', 'metric', 'table'].includes(component.type)
  const isInteractive = interactiveTypes.includes(component.type)

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
          {component.type === 'text' && (
            <>
              <div className="field">
                <label>文本内容</label>
                <input value={p.content} onChange={(e) => updateProps(component.id, { content: e.target.value })} />
              </div>
              <div className="row2">
                <div className="field">
                  <label>字号</label>
                  <input
                    type="number"
                    value={p.fontSize}
                    onChange={(e) => updateProps(component.id, { fontSize: +e.target.value })}
                  />
                </div>
                <div className="field">
                  <label>颜色</label>
                  <input type="color" value={p.color} onChange={(e) => updateProps(component.id, { color: e.target.value })} />
                </div>
              </div>
              <div className="field">
                <label>对齐</label>
                <select value={p.align} onChange={(e) => updateProps(component.id, { align: e.target.value as 'left' | 'center' | 'right' })}>
                  <option value="left">左</option>
                  <option value="center">中</option>
                  <option value="right">右</option>
                </select>
              </div>
            </>
          )}
          {component.type === 'image' && (
            <>
              <div className="field">
                <label>图片地址</label>
                <input value={p.src} onChange={(e) => updateProps(component.id, { src: e.target.value })} />
              </div>
              <div className="field">
                <label>填充</label>
                <select value={p.fit} onChange={(e) => updateProps(component.id, { fit: e.target.value as 'cover' | 'contain' | 'fill' })}>
                  <option value="cover">cover</option>
                  <option value="contain">contain</option>
                  <option value="fill">fill</option>
                </select>
              </div>
            </>
          )}
          {component.type === 'container' && (
            <>
              <div className="field">
                <label>标题</label>
                <input value={p.label} onChange={(e) => updateProps(component.id, { label: e.target.value })} />
              </div>
              <div className="field">
                <label>背景色</label>
                <input value={p.background} onChange={(e) => updateProps(component.id, { background: e.target.value })} />
              </div>
            </>
          )}
        </>
      )}

      {tab === 'data' && (
        <>
          {['lineChart', 'barChart', 'pieChart'].includes(component.type) && (
            <div className="field">
              <label>标题</label>
              <input value={p.title} onChange={(e) => updateProps(component.id, { title: e.target.value })} />
            </div>
          )}
          {['lineChart', 'barChart'].includes(component.type) && (
            <div className="field">
              <label>主色</label>
              <input type="color" value={p.color} onChange={(e) => updateProps(component.id, { color: e.target.value })} />
            </div>
          )}
          {component.type === 'metric' && (
            <>
              <div className="field">
                <label>指标名</label>
                <input value={p.label} onChange={(e) => updateProps(component.id, { label: e.target.value })} />
              </div>
              <div className="field">
                <label>单位</label>
                <input value={p.unit} onChange={(e) => updateProps(component.id, { unit: e.target.value })} />
              </div>
            </>
          )}
          {component.type === 'table' && (
            <div className="field">
              <label>标题</label>
              <input value={p.title} onChange={(e) => updateProps(component.id, { title: e.target.value })} />
            </div>
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
          {!hasData && <div className="empty-tip">该组件无可配置数据</div>}
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
