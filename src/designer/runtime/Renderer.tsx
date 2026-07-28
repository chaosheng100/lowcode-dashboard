import { useRef } from 'react'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import WidgetRenderer from '../widgets/WidgetRenderer'
import { useFitScale } from '../editor/useFitScale'
import { bgImageStyle } from '../editor/background'
import type { ComponentInstance, Filter, RouteConfig } from '../../data/types'

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

/** 按指定路由渲染完整大屏，供独立预览与轮播播放器复用。 */
export function RouteRenderer({ route }: { route: RouteConfig }) {
  const filter = useDesignerStore((state) => state.filter)
  const setFilter = useDesignerStore((state) => state.setFilter)
  const clearFilter = useDesignerStore((state) => state.clearFilter)
  const areaRef = useRef<HTMLDivElement>(null)
  const { page, components } = route

  const scale = useFitScale(areaRef, page)
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
            {components.map((component) => (
              <LinkageFrame key={component.id} component={component} filter={filter} onPick={onPick} />
            ))}
          </div>
        </div>
      </div>
      {filter && (
        <div className="filter-banner">
          <span>联动筛选：{filter.field} = {filter.value}</span>
          <button className="clear" onClick={clearFilter}>清除</button>
        </div>
      )}
    </div>
  )
}

export default function Renderer() {
  const route = useDesignerStore(
    (state) => state.routes.find((item) => item.id === state.selectedRouteId) || state.routes[0]
  )!

  return <RouteRenderer route={route} />
}
