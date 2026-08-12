import { useEffect, useMemo, useRef } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useDesignerStore } from '../data/store/useDesignerStore'
import { featurePages } from '../features/registry'
import ScreenListPage from '../api/ScreenListPage'
import RouteOperationPanel from '../data/routes/RouteOperationPanel'
import KeepAliveOutlet from './KeepAliveOutlet'
import type { RouteConfig } from '../data/types'

/**
 * 基于 react-router 的动态路由 + 路由缓存（KeepAlive）。
 *
 * 路由来源（优先级从高到低）：
 * 1. 固定功能页（featurePages）
 * 2. /dashboard —— 大屏管理列表
 * 3. 用户自定义路由（useDesignerStore.routes）
 *
 * 双向同步：
 * - URL 变化 → 同步更新 store.selectedRouteId
 * - store.selectedRouteId 变化 → 同步更新 URL（replace 方式）
 *
 * 缓存：
 * - 已访问过的页面通过 display:none 保留 DOM 与组件状态
 * - 最大 10 个，超出 LRU 淘汰
 */

const DASHBOARD_PATH = '/dashboard'

interface Props {
  onOpenDesigner: (id: string) => void
  onOpenPreview?: (id: string) => void
  onToggleSidebar?: () => void
  /** 最大缓存页面数，默认 10 */
  maxKeepAlive?: number
  /** 是否启用路由缓存，默认 true */
  keepAlive?: boolean
}

export default function AppRouter({
  onOpenDesigner: _onOpenDesigner,
  onOpenPreview: _onOpenPreview,
  onToggleSidebar,
  maxKeepAlive = 10,
  keepAlive = true,
}: Props) {
  const routes = useDesignerStore((s) => s.routes)
  const selectedRouteId = useDesignerStore((s) => s.selectedRouteId)
  const selectRoute = useDesignerStore((s) => s.selectRoute)
  const location = useLocation()
  const navigate = useNavigate()

  // 用 ref 持有 routes，避免 keepAlive 里不必要的重渲染
  const routesRef = useRef(routes)
  routesRef.current = routes

  // URL → routeId 映射
  const matchedRouteId = useMemo(() => {
    const path = location.pathname
    if (!path || path === '/') return null
    if (featurePages[path]) return path
    if (path === DASHBOARD_PATH) return DASHBOARD_PATH
    const found = routes.find((r) => r.path === path)
    return found?.id || null
  }, [location.pathname, routes])

  // URL → store
  useEffect(() => {
    if (matchedRouteId && matchedRouteId !== selectedRouteId) {
      selectRoute(matchedRouteId)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [matchedRouteId])

  // store → URL
  useEffect(() => {
    if (!selectedRouteId) return
    const targetPath = getRoutePath(selectedRouteId, routes)
    if (targetPath && targetPath !== location.pathname) {
      navigate(targetPath, { replace: true })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRouteId])

  // 根路径 → 默认页
  if (location.pathname === '/' || !location.pathname) {
    const defaultPath = routes.length > 0 ? routes[0].path : DASHBOARD_PATH
    return <Navigate to={defaultPath} replace />
  }

  // 未匹配 → 跳默认页
  if (!matchedRouteId) {
    const defaultPath = routes.length > 0 ? routes[0].path : DASHBOARD_PATH
    return <Navigate to={defaultPath} replace />
  }

  return (
    <KeepAliveOutlet max={maxKeepAlive} enabled={keepAlive}>
      {(pathname) => (
        <RouteContent
          pathname={pathname}
          routesRef={routesRef}
          onToggleSidebar={onToggleSidebar}
        />
      )}
    </KeepAliveOutlet>
  )
}

/** 根据 pathname 渲染对应页面内容（每次都是当前 pathname 的） */
function RouteContent({
  pathname,
  routesRef,
  onToggleSidebar,
}: {
  pathname: string
  routesRef: React.MutableRefObject<RouteConfig[]>
  onToggleSidebar?: () => void
}) {
  // 大屏管理
  if (pathname === DASHBOARD_PATH) {
    return (
      <main className="operation-area">
        <ScreenListPage />
      </main>
    )
  }

  // 功能页
  const FeatureComp = featurePages[pathname]
  if (FeatureComp) {
    return (
      <main className="operation-area">
        <FeatureComp />
      </main>
    )
  }

  // 自定义路由
  const route = routesRef.current.find((r) => r.path === pathname)
  if (route) {
    return <RouteOperationPanel onToggle={onToggleSidebar || (() => {})} />
  }

  return (
    <main className="operation-area">
      <div className="empty-tip">页面不存在</div>
    </main>
  )
}

/** routeId → path */
function getRoutePath(id: string, routes: RouteConfig[]): string | null {
  if (featurePages[id]) return id
  if (id === DASHBOARD_PATH) return DASHBOARD_PATH
  return routes.find((r) => r.id === id)?.path || null
}
