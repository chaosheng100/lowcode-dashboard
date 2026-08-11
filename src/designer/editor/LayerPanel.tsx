import { useMemo } from 'react'
import {
  DndContext,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent
} from '@dnd-kit/core'
import { CSS } from '@dnd-kit/utilities'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import type { ComponentInstance, RouteConfig } from '../../data/types'

function LayerItem({
  component,
  index,
  total,
  selected,
  onSelect
}: {
  component: ComponentInstance
  index: number
  total: number
  selected: boolean
  onSelect: (id: string) => void
}) {
  const { setNodeRef: dropRef, isOver } = useDroppable({ id: component.id })
  const {
    attributes,
    listeners,
    setNodeRef: dragRef,
    transform,
    isDragging
  } = useDraggable({ id: component.id })

  return (
    <div
      ref={dropRef}
      className="layer-item"
      data-layer-id={component.id}
      onClick={() => onSelect(component.id)}
      style={{
        border: `1px solid ${isOver ? '#00d4ff' : selected ? 'rgba(0,212,255,.45)' : 'rgba(42,66,108,.35)'}`,
        background: selected ? 'rgba(0,212,255,.1)' : 'rgba(15,23,42,.55)',
        borderRadius: 6,
        marginBottom: 6,
        opacity: isDragging ? 0.35 : 1,
        cursor: 'grab'
      }}
    >
      <div
        ref={dragRef}
        {...attributes}
        {...listeners}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          padding: '6px 8px',
          transform: CSS.Transform.toString(transform),
          transition: isDragging ? 'none' : 'transform 120ms ease'
        }}
      >
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {component.type} · {component.id.slice(-4)}
        </span>
        <span className="muted2">#{total - index}</span>
      </div>
    </div>
  )
}

export default function LayerPanel() {
  const route = useDesignerStore(
    (s) => s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0]
  )! as RouteConfig
  const selectedId = useDesignerStore((s) => s.selectedId)
  const select = useDesignerStore((s) => s.select)
  const reorderComponent = useDesignerStore((s) => s.reorderComponent)
  const items = useMemo(() => [...route.components].reverse(), [route.components])
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 4 } }))

  const onDragEnd = (e: DragEndEvent) => {
    const { active, over } = e
    if (!over || active.id === over.id) return
    const to = items.findIndex((c) => c.id === over.id)
    if (to < 0) return
    reorderComponent(String(active.id), route.components.length - 1 - to)
  }

  return (
    <div className="rc-block">
      <h4>组件层级（拖拽排序）</h4>
      {items.length === 0 ? (
        <div className="rc-hint">画布还没有组件，先拖入一个组件再排序。</div>
      ) : (
        <DndContext sensors={sensors} onDragEnd={onDragEnd}>
          <div>
            {items.map((c, i) => (
              <LayerItem
                key={c.id}
                component={c}
                index={i}
                total={items.length}
                selected={selectedId === c.id}
                onSelect={select}
              />
            ))}
          </div>
        </DndContext>
      )}
      <div className="rc-hint">列表上方代表更靠前的层级；拖拽后组件数组顺序同步更新。</div>
    </div>
  )
}
