import { useState } from 'react'
import RoutePanel from './data/routes/RoutePanel'
import AppRouter from './router/AppRouter'
import { useDesignerStore } from './data/store/useDesignerStore'

interface Props {
  /** 点击大屏卡片在新页签打开对应大屏编辑器 */
  onOpenDesigner: (routeId: string) => void
  /** 在新页签打开对应大屏预览 */
  onOpenPreview?: (routeId: string) => void
}

/**
 * 主应用布局：左侧路由面板 + 右侧内容区（由 react-router 管理）。
 *
 * 路由切换：
 * - 左侧菜单点击 → store.selectRoute → URL 变化 → AppRouter 渲染对应页面
 * - 浏览器前进/后退 / 直接访问 URL → AppRouter 匹配 → store 同步
 */
export default function ProjectView({ onOpenDesigner, onOpenPreview }: Props) {
  const [showRoutes, setShowRoutes] = useState(true) // 移动端抽屉开关
  const [collapsed, setCollapsed] = useState(false) // 折叠为仅图标

  // 订阅 routes 变化，触发重渲染（路由列表增删时 AppRouter 要重新生成）
  useDesignerStore((s) => s.routes.length)

  const handleToggleSidebar = () => setShowRoutes((v) => !v)

  return (
    <div className={'project-view' + (showRoutes ? ' show-routes' : '')}>
      <RoutePanel
        collapsed={collapsed}
        onToggleCollapse={() => setCollapsed((v) => !v)}
        onCloseDrawer={() => setShowRoutes(false)}
      />
      {/* 右侧内容区：子页面各自包含 <main class="operation-area">，这里只做路由容器 */}
      <AppRouter
        onOpenDesigner={onOpenDesigner}
        onOpenPreview={onOpenPreview}
        onToggleSidebar={handleToggleSidebar}
      />
    </div>
  )
}
