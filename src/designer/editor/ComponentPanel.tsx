import { widgetRegistry, widgetCategories } from '../../data/registry/widgetRegistry'
import type { WidgetType, WidgetMeta } from '../../data/types'

export default function ComponentPanel() {
  const onDragStart = (e: React.DragEvent, type: WidgetType) => {
    e.dataTransfer.setData('widget-type', type)
    e.dataTransfer.effectAllowed = 'copy'
  }
  return (
    <div className="dlp-inner">
      <div style={{ color: '#9aa7b4', fontSize: 12, marginBottom: 10 }}>拖拽组件到画布 →</div>
      {widgetCategories.map((cat) => {
        const items = Object.entries(widgetRegistry).filter(
          ([, v]) => v.category === cat
        ) as [WidgetType, WidgetMeta][]
        if (!items.length) return null
        return (
          <div className="cp-group" key={cat}>
            <h4>{cat}</h4>
            {items.map(([type, def]) => (
              <div className="cp-item" key={type} draggable onDragStart={(e) => onDragStart(e, type)}>
                <span className="ico">{def.icon}</span>
                <span>{def.name}</span>
              </div>
            ))}
          </div>
        )
      })}
    </div>
  )
}
