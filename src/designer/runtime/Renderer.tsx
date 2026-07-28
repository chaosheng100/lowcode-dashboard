import { useRef } from 'react'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import WidgetRenderer from '../widgets/WidgetRenderer'
import { useFitScale } from '../editor/useFitScale'
import { bgImageStyle } from '../editor/background'
import type { ComponentInstance, Filter } from '../../data/types'

/**
 * 联动引擎（简化声明式）：
 * 交互组件点击数据元素 -> emit({ field, value }) -> 全局 filter
 * 同 filterField 的组件自动按 filter 过滤/高亮。
 * 后续可替换为设计书中的「links 规则表」驱动（源事件 -> 目标动作）。
 */
function LinkageFrame({ component, filter, onPick }: { component: ComponentInstance; filter: Filter | null; onPick: (f: Filter) => void }) {
  return (
    <div
      className="comp-frame"
      style={{
        left: component.style.x,
        top: component.style.y,
        width: component.style.w,
        height: component.style.h,
        border: 'none',
        pointerEvents: 'auto'
      }}
    >
      <WidgetRenderer component={component} filter={filter} onPick={onPick} />
    </div>
  )
}

export default function Renderer() {
  const route = useDesignerStore(
    (s) => s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0]
  )!
  const components = route.components
  const page = route.page
  const filter = useDesignerStore((s) => s.filter)
  const setFilter = useDesignerStore((s) => s.setFilter)
  const clearFilter = useDesignerStore((s) => s.clearFilter)
  const areaRef = useRef<HTMLDivElement>(null)

  // 自适应：fit=true 时按容器尺寸自动缩放；否则使用手动 scale
  const fitScale = useFitScale(areaRef, page)
  const scale = page.fit ? fitScale : page.scale

  const onPick = ({ field, value }: Filter) => {
    if (filter && filter.field === field && filter.value === value) clearFilter()
    else setFilter({ field, value })
  }

  return (
    <div className="canvas-area">
      <div className="canvas-scroll preview-scroll" ref={areaRef}>
        <div
          className="canvas-viewport preview-viewport"
          style={{
            width: Math.round(page.width * scale),
            height: Math.round(page.height * scale)
          }}
        >
          <div
            className="canvas"
            style={{
              width: page.width,
              height: page.height,
              background: page.background,
              transform: `scale(${scale})`
            }}
          >
            {page.backgroundImage && <div className="canvas-bg-img" style={bgImageStyle(page)} />}
            {components.map((c) => (
              <LinkageFrame key={c.id} component={c} filter={filter} onPick={onPick} />
            ))}
          </div>
        </div>
      </div>
      {filter && (
        <div className="filter-banner">
          <span>
            联动筛选：{filter.field} = {filter.value}
          </span>
          <span className="clear" onClick={clearFilter}>
            清除
          </span>
        </div>
      )}
    </div>
  )
}
