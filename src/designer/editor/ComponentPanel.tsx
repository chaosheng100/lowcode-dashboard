import { useEffect, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { api } from '../../mock'
import type { WidgetDefDTO } from '../../mock/types'
import { widgetRegistry, widgetCategories } from '../../data/registry/widgetRegistry'
import type { WidgetType, WidgetMeta } from '../../data/types'

function DraggableItem({ type, def }: { type: WidgetType; def: WidgetMeta }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `widget-${type}`,
    data: { type },
  })
  return (
    <div
      ref={setNodeRef}
      className="cp-item"
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      {...listeners}
      {...attributes}
    >
      <span className="ico">{def.icon}</span>
      <span>{def.name}</span>
    </div>
  )
}

function AiEchartItem({ widget }: { widget: WidgetDefDTO }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id: `ai-echart-${widget.id ?? widget.type}`,
    data: { type: 'echartCustom', optionJson: widget.optionJson },
  })
  return (
    <div
      ref={setNodeRef}
      className="cp-item"
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      {...listeners}
      {...attributes}
    >
      <span className="ico">▤</span>
      <span>{widget.name}</span>
    </div>
  )
}

export default function ComponentPanel() {
  const [echartWidgets, setEchartWidgets] = useState<WidgetDefDTO[]>([])

  useEffect(() => {
    let alive = true
    api.listWidgets({ pageSize: 100 }).then((r) => {
      if (!alive) return
      setEchartWidgets(
        (r.data?.list ?? []).filter((w) => w.kind === 'echarts' || w.optionJson)
      )
    })
    return () => {
      alive = false
    }
  }, [])

  return (
    <div className="dlp-inner">
      <div style={{ color: '#9aa7b4', fontSize: 12, marginBottom: 10 }}>拖拽组件到画布 →</div>
      {echartWidgets.length > 0 && (
        <div className="cp-group">
          <h4>AI ECharts</h4>
          {echartWidgets.map((w) => (
            <AiEchartItem key={w.id ?? w.type} widget={w} />
          ))}
        </div>
      )}
      {widgetCategories.map((cat) => {
        const items = Object.entries(widgetRegistry).filter(
          ([, v]) => v.category === cat
        ) as [WidgetType, WidgetMeta][]
        if (!items.length) return null
        return (
          <div className="cp-group" key={cat}>
            <h4>{cat}</h4>
            {items.map(([type, def]) => (
              <DraggableItem key={type} type={type} def={def} />
            ))}
          </div>
        )
      })}
    </div>
  )
}
