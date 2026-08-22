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
import { widgetRegistry } from '../../data/registry/widgetRegistry'
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
    if (!type) return
    const el = document.querySelector('.canvas') as HTMLElement | null
    if (!el) return
    const rect = el.getBoundingClientRect()
    const st = useDesignerStore.getState()
    const route = st.routes.find((r) => r.id === st.selectedRouteId) || st.routes[0]
    if (!route) return
    const pageW = Number.isFinite(route.page.width) ? route.page.width : 1920
    const pageH = Number.isFinite(route.page.height) ? route.page.height : 1080
    const scale = rect.width > 0 ? rect.width / pageW : 0.42

    // 拖拽项当前屏幕位置：优先用 dnd-kit 的 translated rect（跟随鼠标的最终位置），
    // 回退到 activatorEvent（按下点，旧逻辑落点不跟手）。
    const translated = event.active.rect.current.translated
    let cx = 0
    let cy = 0
    if (translated) {
      cx = translated.left + translated.width / 2
      cy = translated.top + translated.height / 2
    } else if (event.activatorEvent) {
      const ev = event.activatorEvent as PointerEvent
      cx = ev.clientX
      cy = ev.clientY
    }
    // 松开点必须在画布内（含轻微容差），否则丢弃，避免误拖到面板上添加组件
    if (
      cx < rect.left - 8 ||
      cx > rect.right + 8 ||
      cy < rect.top - 8 ||
      cy > rect.bottom + 8
    ) {
      return
    }
    // 默认尺寸（用于中心对齐落点）；孪生/物联资产由工厂生成，用工厂默认尺寸
    let halfW = 30
    let halfH = 20
    if (data.preset) {
      const def = widgetRegistry[data.preset.type]
      halfW = (def?.defaultStyle?.w ?? 300) / 2
      halfH = (def?.defaultStyle?.h ?? 160) / 2
    }
    const position = {
      x: Math.max(0, Math.min((cx - rect.left) / scale - halfW, pageW - 40)),
      y: Math.max(0, Math.min((cy - rect.top) / scale - halfH, pageH - 40)),
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
    <DndContext
      sensors={sensors}
      autoScroll={false}
      onDragEnd={onDragEnd}
    >
      <div className="editor">
        <div className="editor-panel-wrap panel-left-wrap">
          <DesignerLeftPanel />
        </div>
        <Canvas />
        <div className="editor-panel-wrap panel-right-wrap">
          <PropertyPanel />
        </div>
      </div>
    </DndContext>
  )
}
