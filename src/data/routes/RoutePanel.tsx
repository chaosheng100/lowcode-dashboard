import { useState } from 'react'
import { useDesignerStore } from '../store/useDesignerStore'
import type { RouteConfig } from '../types'

// 一级路由分类图标
const ICONS: Record<string, string> = {
  '/dashboard': '🖥️',
  '/extension': '🔌',
  '/data': '🗄️',
  '/components': '🧩',
  '/ai': '🤖',
  '/dev': '🛠️',
  '/resources': '📦',
  '/system': '⚙️',
  '/plugins': '🔧',
  '/help': '❓',
  '/others': '🔗'
}
const FALLBACK_ICON = '📄'

interface RoutePanelProps {
  /** 是否折叠为仅图标状态 */
  collapsed: boolean
  /** 切换折叠 / 展开 */
  onToggleCollapse: () => void
  /** 移动端关闭抽屉（收起整个路由区） */
  onCloseDrawer: () => void
}

/**
 * 左侧路由区（只读）
 * - 路由列表不可编辑：无新增 / 删除 / 添加子页面操作
 * - 支持树形结构的展开与收起（点击 ▾/▸，默认全展开）
 * - 支持整体折叠为「仅图标」状态（点击 ‹ / › 切换）
 * - 点击节点仅用于路由导航（选中并联动右侧操作区）
 */
export default function RoutePanel({ collapsed, onToggleCollapse, onCloseDrawer }: RoutePanelProps) {
  // 基础数据路由区：仅展示 kind !== 'dashboard' 的路由，大屏路由交由「大屏管理」模块管理
  const routes = useDesignerStore((s) => s.routes.filter((r) => r.kind !== 'dashboard'))
  const selectedRouteId = useDesignerStore((s) => s.selectedRouteId)
  const selectRoute = useDesignerStore((s) => s.selectRoute)

  const [closedNodes, setClosedNodes] = useState<Set<string>>(() => new Set<string>())

  const childrenOf = (pid: string | null) => routes.filter((r) => r.parentId === pid)
  const roots = childrenOf(null)
  const toggle = (id: string) =>
    setClosedNodes((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const renderNode = (route: RouteConfig, depth: number) => {
    const kids = childrenOf(route.id)
    const hasKids = kids.length > 0
    const isOpen = !closedNodes.has(route.id)
    const isActive = route.id === selectedRouteId
    const icon = ICONS[route.id] || FALLBACK_ICON
    return (
      <div key={route.id} className="rt-subtree">
        <div
          className={'route-node' + (isActive ? ' active' : '') + (depth === 0 ? ' lvl1' : ' lvl2')}
          onClick={() => selectRoute(route.id)}
        >
          {hasKids ? (
            <span
              className="rt-caret"
              onClick={(e) => {
                e.stopPropagation()
                toggle(route.id)
              }}
            >
              {isOpen ? '▾' : '▸'}
            </span>
          ) : (
            <span className="rt-caret placeholder" />
          )}
          <span className="rt-ico">{icon}</span>
          <span className="rt-name" title={route.name}>
            {route.name}
          </span>
          {hasKids && <span className="rt-badge">{kids.length}</span>}
        </div>
        {hasKids && isOpen && (
          <div className="rt-children">{kids.map((c) => renderNode(c, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <aside className={'route-area' + (collapsed ? ' collapsed' : '')}>
      <div className="ra-head">
        <span className="ra-title">路由区</span>
        <div className="ra-head-actions">
          <button
            className="btn icon-btn collapse-btn"
            title={collapsed ? '展开路由区' : '收起为仅图标'}
            onClick={onToggleCollapse}
          >
            {collapsed ? '›' : '‹'}
          </button>
          <button className="btn icon-btn close-btn" title="关闭" onClick={onCloseDrawer}>
            ✕
          </button>
        </div>
      </div>
      <div className="route-tree">
        {roots.map((r) => renderNode(r, 0))}
        {!roots.length && <div className="empty-tip">暂无页面</div>}
      </div>
    </aside>
  )
}
