import { useState } from 'react'
import RoutePanel from './data/routes/RoutePanel'
import RouteOperationPanel from './data/routes/RouteOperationPanel'
import DashboardManagement from './management/DashboardManagement'
import { featurePages } from './features/registry'
import { useDesignerStore } from './data/store/useDesignerStore'

interface Props {
  /** 点击大屏卡片进入对应大屏编辑器 */
  onOpenDesigner: (routeId: string) => void
}

// /dashboard 路由即大屏管理列表页
const DASHBOARD_LIST_ROUTE = '/dashboard'

export default function ProjectView({ onOpenDesigner }: Props) {
  const [showRoutes, setShowRoutes] = useState(true) // 移动端抽屉开关
  const [collapsed, setCollapsed] = useState(false) // 折叠为仅图标
  const selectedRouteId = useDesignerStore((s) => s.selectedRouteId)

  const renderPanel = (
    <RoutePanel
      collapsed={collapsed}
      onToggleCollapse={() => setCollapsed((v) => !v)}
      onCloseDrawer={() => setShowRoutes(false)}
    />
  )

  // /dashboard 直接渲染大屏管理列表（名称筛选 / 时间排序 / 缩略图）
  if (selectedRouteId === DASHBOARD_LIST_ROUTE) {
    return (
      <div className={'project-view' + (showRoutes ? ' show-routes' : '')}>
        {renderPanel}
        <main className="operation-area">
          <DashboardManagement onOpen={(id) => onOpenDesigner(id)} />
        </main>
      </div>
    )
  }

  // 命中功能页注册表的路由，渲染真实数据页替代低代码画布
  const FeaturePage = featurePages[selectedRouteId]

  return (
    <div className={'project-view' + (showRoutes ? ' show-routes' : '')}>
      {renderPanel}
      {FeaturePage ? (
        <main className="operation-area">
          <FeaturePage />
        </main>
      ) : (
        <RouteOperationPanel onToggle={() => setShowRoutes((v) => !v)} />
      )}
    </div>
  )
}
