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
import type { IoTDeviceDTO, TwinSceneDTO } from '../../mock/types'
import type { TwinWidgetKind } from '../../features/twinWidgetCatalog'
import type { IoTWidgetKind } from '../../features/iotWidgetCatalog'

/** 左侧面板拖拽载荷：标准组件 / 组件中心资产 / 孪生物联资产 */
interface PanelDragData {
  type?: ComponentInstance['type']
  preset?: { type: ComponentInstance['type']; props?: WidgetProps }
  asset?: { key: string; optionJson?: string; sourceCode?: string; sandboxMode?: 'sandbox' | 'trusted'; rendererType?: string }
  twinKind?: TwinWidgetKind
  iotKind?: IoTWidgetKind
  sceneId?: string
  deviceId?: string
}

export default function Editor() {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const data = event.active.data.current as PanelDragData | undefined
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
    // 孪生 / 物联资产：需要先有场景/设备对象
    if (data?.asset && data.twinKind && data.sceneId) {
      const scene = st.twinScenesMeta[data.sceneId] as TwinSceneDTO | undefined
      if (!scene?.id) {
        // 快照缺失（刷新后首次拖入）：从后端拉取完整场景
        import('../../mock/api')
          .then((m) => m.api.getTwinScene(data.sceneId!))
          .then((res) => {
            if (res.code === 0 && res.data) {
              st.addTwinCatalogComponent(res.data, data.twinKind!, position)
            }
          })
          .catch(() => undefined)
        return
      }
      st.addTwinCatalogComponent(scene, data.twinKind, position)
      return
    }
    if (data?.asset && data.iotKind && data.deviceId) {
      const device = st.iotDevicesMeta.find((d) => d.id === data.deviceId) as IoTDeviceDTO | undefined
      if (device?.id) {
        st.addIoTComponent(device, data.iotKind, position)
      }
      return
    }
    // 组件中心资产（AI 生成的 ECharts / 源码组件）：带 optionJson / sourceCode 的预设
    if (data?.asset && !data.twinKind && !data.iotKind) {
      const props: WidgetProps = {}
      if (data.asset.optionJson) props.optionJson = data.asset.optionJson
      if (data.asset.sourceCode) {
        props.sourceCode = data.asset.sourceCode
        props.sandboxMode = data.asset.sandboxMode ?? 'sandbox'
      }
      if (data.asset.rendererType) props.catalogRenderer = data.asset.rendererType
      st.addComponent(type, position, props)
      return
    }
    if (data?.preset) {
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
