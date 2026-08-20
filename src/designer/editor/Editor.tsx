import DesignerLeftPanel from './DesignerLeftPanel'
import Canvas from './Canvas'
import PropertyPanel from './PropertyPanel'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import type { ComponentInstance, WidgetProps } from '../../data/types'
import type { ComponentMetaDTO } from '../../mock/types'

export default function Editor() {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as
      | {
          type?: ComponentInstance['type']
          preset?: { type: ComponentInstance['type']; props?: WidgetProps }
          meta?: ComponentMetaDTO
        }
      | undefined
    const type = data?.type
    if (!type || !event.activatorEvent) return
    const el = document.querySelector('.canvas') as HTMLElement | null
    if (!el) return
    const rect = el.getBoundingClientRect()
    const ev = event.activatorEvent as PointerEvent
    const st = useDesignerStore.getState()
    const route = st.routes.find((r) => r.id === st.selectedRouteId) || st.routes[0]
    if (!route) return
    const pageW = Number.isFinite(route.page.width) ? route.page.width : 1920
    const pageH = Number.isFinite(route.page.height) ? route.page.height : 1080
    const scale = rect.width > 0 ? rect.width / pageW : 0.42
    const position = {
      x: Math.max(0, Math.min((ev.clientX - rect.left) / scale - 30, pageW - 40)),
      y: Math.max(0, Math.min((ev.clientY - rect.top) / scale - 20, pageH - 40)),
    }
    if (data?.meta) {
      st.addComponent(data.meta.type as ComponentInstance['type'], position, undefined, undefined, data.meta)
    } else if (data?.preset) {
      st.addComponent(data.preset.type, position, undefined, {
        type: data.preset.type,
        props: data.preset.props,
      })
    } else {
      st.addComponent(type, position)
    }
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
      <div className="editor">
        <DesignerLeftPanel />
        <Canvas />
        <PropertyPanel />
      </div>
    </DndContext>
  )
}
