import { useEffect, useMemo, useRef } from 'react'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import WidgetRenderer from '../widgets/WidgetRenderer'
import { useFitScale } from '../editor/useFitScale'
import { bgImageStyle } from '../editor/background'
import { createEventBus, dispatchLinks } from './LinkageEngine'
import { api } from '../../mock'
import { useApi } from '../../features/useApi'
import type { ComponentInstance, Filter, LinkageEvent, RouteConfig, WidgetProps } from '../../data/types'
import type { GlobalVarDTO } from '../../mock/types'

const ANALYTICS_URL = import.meta.env.VITE_API_BASE_URL || '/api'

function trackEvent(event: Record<string, unknown>) {
  try {
    const body = { ...event, occurredAt: new Date().toISOString(), sessionHash: `s-${Date.now().toString(36)}` }
    void fetch(`${ANALYTICS_URL.replace(/\/$/, '')}/analytics/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => undefined)
  } catch {
    /* 采集失败不能影响大屏渲染 */
  }
}

/**
 * 全局变量占位解析：将组件文本类属性中的 ${G.name} 替换为全局变量值，
 * 实现「全局变量 ↔ 大屏组件」的模块间数据互通（全局变量来自 /dev/variables 模块）。
 */
function resolveVars(props: WidgetProps, vars: Record<string, string>): WidgetProps {
  if (!vars || Object.keys(vars).length === 0) return props
  const apply = (v: unknown): unknown => {
    if (typeof v !== 'string') return v
    return v.replace(/\$\{G\.([A-Za-z0-9_]+)\}/g, (_, k) => (k in vars ? vars[k] : '${G.' + k + '}'))
  }
  const next: WidgetProps = { ...props }
  for (const key of Object.keys(props) as (keyof WidgetProps)[]) {
    // 仅替换字符串型属性（content/title/label/src 等）
    const val = props[key]
    if (typeof val === 'string') (next as Record<string, unknown>)[key] = apply(val)
  }
  return next
}

/**
 * 联动引擎（声明式规则表）：
 * 交互组件点击 -> emit({ componentId, type:'pick', payload:{field,value} }) ->
 * 事件总线分发 route.links 中命中「源组件+事件」的规则 -> 对目标执行动作。
 * 支持动作：setFilter(全局筛选) / clearFilter(清除筛选)。
 * 同时保留原有「全局 Filter」联动（同 filterField 的组件自动过滤/高亮）。
 */
function LinkageFrame({
  component,
  filter,
  onPick,
  vars,
  bus
}: {
  component: ComponentInstance
  filter: Filter | null
  onPick: (f: Filter) => void
  vars: Record<string, string>
  bus: ReturnType<typeof createEventBus>
}) {
  const resolved = useMemo(() => ({ ...component, props: resolveVars(component.props, vars) }), [component, vars])
  const handlePick = (f: Filter) => {
    onPick(f)
    // 同时向事件总线广播，触发声明式 links 联动
    bus.emit('pick', { componentId: component.id, type: 'pick', payload: { field: f.field, value: f.value } } as LinkageEvent)
  }
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
      <WidgetRenderer component={resolved} filter={filter} onPick={handlePick} />
    </div>
  )
}

/** 按指定路由渲染完整大屏，供独立预览与轮播播放器复用。 */
export function RouteRenderer({ route }: { route: RouteConfig }) {
  const filter = useDesignerStore((state) => state.filter)
  const setFilter = useDesignerStore((state) => state.setFilter)
  const clearFilter = useDesignerStore((state) => state.clearFilter)
  const areaRef = useRef<HTMLDivElement>(null)
  const busRef = useRef<ReturnType<typeof createEventBus>>()
  if (!busRef.current) busRef.current = createEventBus()

  // 加载全局变量（来自 /dev/variables 模块），供 ${G.x} 占位解析
  const { data: gvData } = useApi(() => api.listVars(), [])
  const vars = useMemo<Record<string, string>>(() => {
    const list = (gvData?.list ?? []) as GlobalVarDTO[]
    const m: Record<string, string> = {}
    for (const v of list) if (v.kind === 'variable') m[v.name] = v.value
    return m
  }, [gvData])

  const scale = useFitScale(areaRef, route.page)
  const onPick = ({ field, value }: Filter) => {
    if (filter && filter.field === field && filter.value === value) clearFilter()
    else setFilter({ field, value })
  }

  useEffect(() => {
    const painted = performance.now()
    trackEvent({ screenId: route.id, eventType: 'screen_view', durationMs: Math.round(painted), status: 'success' })
    const componentRender = window.setTimeout(() => {
      for (const component of route.components) {
        trackEvent({ screenId: route.id, eventType: 'component_render', componentId: component.id, durationMs: Math.round(performance.now() - painted), status: 'success' })
      }
    }, 120)
    return () => window.clearTimeout(componentRender)
  }, [route.id])

  // 声明式联动：监听事件总线，分发 route.links 规则
  useEffect(() => {
    const bus = busRef.current!
    const off = bus.on('pick', (payload) => {
      const event = payload as LinkageEvent
      const actions = dispatchLinks(route.links, event)
      for (const a of actions) {
        if (a.action === 'setFilter') {
          const p = (a.params || {}) as { field?: string; value?: string }
          if (p.field != null && p.value != null) setFilter({ field: p.field, value: String(p.value) })
        } else if (a.action === 'clearFilter') {
          clearFilter()
        }
      }
    })
    return off
  }, [route.links, setFilter, clearFilter])

  return (
    <div className="canvas-area">
      <div className="canvas-scroll preview-scroll" ref={areaRef}>
        <div
          className="canvas-viewport preview-viewport"
          style={{
            width: Math.round(route.page.width * scale),
            height: Math.round(route.page.height * scale)
          }}
        >
          <div
            className="canvas"
            style={{
              width: route.page.width,
              height: route.page.height,
              background: route.page.background,
              transform: `scale(${scale})`
            }}
          >
            {route.page.backgroundImage && <div className="canvas-bg-img" style={bgImageStyle(route.page)} />}
            {route.components.map((component) => (
              <LinkageFrame key={component.id} component={component} filter={filter} onPick={onPick} vars={vars} bus={busRef.current!} />
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
