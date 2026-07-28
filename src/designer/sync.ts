import { useDesignerStore } from '../data/store/useDesignerStore'
import type { RouteConfig } from '../data/types'

/**
 * 跨窗口消息同步（BroadcastChannel，同源）。
 * 模型：编辑窗口是「唯一数据源」，任何路由改动都防抖广播整条 route 快照；
 * 预览窗口按 routeId 过滤并应用，从而实时反映编辑端修改。
 * 预览窗口加入时发 hello 握手，由任意编辑窗口回包当前 route，避免「后开的预览」拿不到初始状态。
 */

const CHANNEL = 'lowcode-dashboard-sync'

type SyncMsg =
  | { t: 'route'; route: RouteConfig }
  | { t: 'hello'; routeId: string }
  | { t: 'bye' }

let ch: BroadcastChannel | null = null
function channel(): BroadcastChannel | null {
  if (!ch && typeof BroadcastChannel !== 'undefined') {
    ch = new BroadcastChannel(CHANNEL)
  }
  return ch
}

/** 编辑窗口：广播选中路由 + 响应预览的 hello 握手 */
export function startEditorSync(getSelectedRoute: () => RouteConfig | undefined): () => void {
  const c = channel()
  if (!c) return () => {}

  c.onmessage = (e: MessageEvent) => {
    const m = e.data as SyncMsg
    if (m.t === 'route') {
      const selectedRouteId = useDesignerStore.getState().selectedRouteId
      if (m.route.id === selectedRouteId) useDesignerStore.getState().upsertRoute(m.route)
    }
    if (m.t === 'hello') {
      const r = getSelectedRoute()
      if (r && r.id === m.routeId) c.postMessage({ t: 'route', route: r } as SyncMsg)
    }
  }

  let last = ''
  let timer: ReturnType<typeof setTimeout> | null = null
  const unsub = useDesignerStore.subscribe((s) => {
    const r = s.routes.find((x) => x.id === s.selectedRouteId) || s.routes[0]
    if (!r) return
    const ser = JSON.stringify(r)
    if (ser === last) return // 仅当选中路由内容真正变化时才广播
    last = ser
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      c.postMessage({ t: 'route', route: r } as SyncMsg)
    }, 120)
  })

  return () => {
    unsub()
    if (timer) clearTimeout(timer)
    c.onmessage = null
  }
}

/** 从主工作台向已打开的编辑/预览页签推送完整路由快照。 */
export function broadcastRoute(route: RouteConfig): void {
  channel()?.postMessage({ t: 'route', route } as SyncMsg)
}

/** 预览窗口：按 routeId 接收并应用；加入时发 hello 拉取初始状态 */
export function startPreviewSync(routeId: string, apply: (r: RouteConfig) => void): () => void {
  const c = channel()
  if (!c) return () => {}

  c.onmessage = (e: MessageEvent) => {
    const m = e.data as SyncMsg
    if (m.t === 'route' && m.route.id === routeId) apply(m.route)
  }
  c.postMessage({ t: 'hello', routeId } as SyncMsg)

  return () => {
    c.onmessage = null
    c.postMessage({ t: 'bye' } as SyncMsg)
  }
}
