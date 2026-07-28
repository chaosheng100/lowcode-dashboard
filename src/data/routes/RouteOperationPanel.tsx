import { Button } from 'antd'
import { MenuOutlined } from '@ant-design/icons'
import { useDesignerStore } from '../store/useDesignerStore'
import RouteConfigPanel from './RouteConfigPanel'
import type { RouteConfig } from '../types'

interface RouteOperationPanelProps {
  onToggle: () => void
}

/**
 * 基础数据路由的操作区：展示选中路由的「页面配置」（params / props / state）。
 * 注意：画布编辑（组件拖拽、属性配置）属于「大屏编辑器」模块，已与基础数据路由分离，
 * 基础数据路由不再承载低代码画布，避免层级混淆。
 */
export default function RouteOperationPanel({ onToggle }: RouteOperationPanelProps) {
  const route = useDesignerStore(
    (s) => s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0]
  )! as RouteConfig

  if (!route) {
    return (
      <main className="operation-area">
        <div className="empty-tip">请选择或新建一个页面</div>
      </main>
    )
  }

  return (
    <main className="operation-area">
      <div className="oa-head">
        {/* oa-menu 类保留：桌面端隐藏、移动端显示的响应式开关 */}
        <Button type="text" className="oa-menu" title="展开路由区" icon={<MenuOutlined />} onClick={onToggle} />
        <div className="oa-crumb">
          <span className="oa-name">{route.name}</span>
          <span className="oa-path">{route.path}</span>
        </div>
        <div className="oa-tags">
          <span className="oa-kind" data-kind={route.kind}>
            {route.kind === 'dashboard' ? '大屏路由' : '基础数据'}
          </span>
        </div>
      </div>
      <RouteConfigPanel route={route} />
    </main>
  )
}
