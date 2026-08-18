import { useMemo } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { api } from '../../mock/api'
import { useApi } from '../../features/useApi'
import { widgetRegistry, widgetCategories } from '../../data/registry/widgetRegistry'
import type { WidgetType, WidgetMeta, WidgetProps } from '../../data/types'

function DraggableItem({
  type,
  def,
  preset,
}: {
  type: WidgetType
  def?: WidgetMeta
  preset?: { type: WidgetType; props?: WidgetProps }
}) {
  const id = preset ? `registered-${preset.props?.catalogSourceId || type}` : `widget-${type}`
  const { attributes, listeners, setNodeRef, transform } = useDraggable({
    id,
    data: preset ? { type: preset.type, preset } : { type },
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
      <span className="ico">{def ? def.icon : '◆'}</span>
      <span>{def ? def.name : (preset?.props?.catalogName as string) || '自定义组件'}</span>
    </div>
  )
}

export default function ComponentPanel() {
  const { data } = useApi(() => api.listWidgets({ pageSize: 100 }), [])
  const registeredByCategory = useMemo(() => {
    const map = new Map<string, Array<{ type: WidgetType; props?: WidgetProps }>>()
    for (const w of data?.list ?? []) {
      if (w.status !== 'published' || !w.optionJson) continue
      const list = map.get(w.category) || []
      list.push({
        type: 'echartCustom',
        props: {
          optionJson: w.optionJson,
          title: w.name,
          catalogKey: `registered:${w.type}`,
          catalogName: w.name,
          catalogSourceId: `catalog:registered:${w.type}`,
          businessType: 'general',
        },
      })
      map.set(w.category, list)
    }
    return map
  }, [data])
  const categories = Array.from(new Set([...widgetCategories, ...Array.from(registeredByCategory.keys())]))

  return (
    <div className="dlp-inner">
      <div style={{ color: '#86868b', fontSize: 12, marginBottom: 10 }}>拖拽组件到画布 →</div>
      {categories.map((cat) => {
        const items = Object.entries(widgetRegistry).filter(
          ([, v]) => v.category === cat
        ) as [WidgetType, WidgetMeta][]
        const registered = registeredByCategory.get(cat) || []
        if (!items.length && !registered.length) return null
        return (
          <div className="cp-group" key={cat}>
            <h4>{cat}</h4>
            {items.map(([type, def]) => (
              <DraggableItem key={type} type={type} def={def} />
            ))}
            {registered.map((preset, idx) => (
              <DraggableItem
                key={preset.props?.catalogSourceId || `reg-${idx}`}
                type={preset.type}
                preset={preset}
              />
            ))}
          </div>
        )
      })}
    </div>
  )
}
