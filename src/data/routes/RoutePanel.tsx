import { useState } from 'react'
import type { ReactNode } from 'react'
import { Button, Tree } from 'antd'
import type { TreeDataNode } from 'antd'
import {
  CloseOutlined, MenuFoldOutlined, MenuUnfoldOutlined,
  DesktopOutlined, ApiOutlined, DatabaseOutlined, AppstoreOutlined,
  RobotOutlined, ToolOutlined, InboxOutlined, SettingOutlined,
  ThunderboltOutlined, QuestionCircleOutlined, LinkOutlined, FileOutlined,
} from '@ant-design/icons'
import { useDesignerStore } from '../store/useDesignerStore'
import type { RouteConfig } from '../types'
import UserMenu from '../../auth/UserMenu'

// 一级路由分类图标（SVG，保持 16px 一致）
const ICONS: Record<string, ReactNode> = {
  '/dashboard': <DesktopOutlined />,
  '/extension': <ApiOutlined />,
  '/data': <DatabaseOutlined />,
  '/components': <AppstoreOutlined />,
  '/ai': <RobotOutlined />,
  '/dev': <ToolOutlined />,
  '/resources': <InboxOutlined />,
  '/system': <SettingOutlined />,
  '/plugins': <ThunderboltOutlined />,
  '/help': <QuestionCircleOutlined />,
  '/others': <LinkOutlined />
}
const FALLBACK_ICON = <FileOutlined />

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
 * - 树形结构由 antd Tree 接管（默认全展开，可逐节点收起）
 * - 支持整体折叠为「仅图标」状态（Tree 不支持该模式，保留自绘图标列）
 * - 点击节点仅用于路由导航（选中并联动右侧操作区）
 */
export default function RoutePanel({ collapsed, onToggleCollapse, onCloseDrawer }: RoutePanelProps) {
  // 基础数据路由区：仅展示 kind !== 'dashboard' 的路由，大屏路由交由「大屏管理」模块管理
  const routes = useDesignerStore((s) => s.routes.filter((r) => r.kind !== 'dashboard'))
  const selectedRouteId = useDesignerStore((s) => s.selectedRouteId)
  const selectRoute = useDesignerStore((s) => s.selectRoute)

  // 默认全展开：仅记录被手动收起的节点
  const [closedNodes, setClosedNodes] = useState<Set<string>>(() => new Set<string>())

  const childrenOf = (pid: string | null) => routes.filter((r) => r.parentId === pid)
  const roots = childrenOf(null)
  // 全部可展开节点（有子节点的路由），展开态 = 全部父节点减去被收起的
  const parentIds = routes.filter((r) => childrenOf(r.id).length > 0).map((r) => r.id)
  const expandedKeys = parentIds.filter((id) => !closedNodes.has(id))

  // 递归映射为 Tree 数据：标题保留 图标 + 名称 + 子节点数角标
  const toTreeData = (list: RouteConfig[]): TreeDataNode[] =>
    list.map((route) => {
      const kids = childrenOf(route.id)
      return {
        key: route.id,
        title: (
          <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0 }}>
            <span className="rt-ico">{ICONS[route.id] || FALLBACK_ICON}</span>
            <span className="rt-name" title={route.name}>
              {route.name}
            </span>
            {kids.length > 0 && <span className="rt-badge">{kids.length}</span>}
          </span>
        ),
        children: kids.length > 0 ? toTreeData(kids) : undefined
      }
    })

  return (
    <aside className={'route-area' + (collapsed ? ' collapsed' : '')}>
      <div className="ra-head">
        <div className="ra-brand" title="低代码大屏设计器">
          <img src="/logo.png" alt="logo" className="ra-logo" />
          {!collapsed && <span className="ra-title">低代码大屏设计器</span>}
        </div>
        <UserMenu compact={collapsed} />
        <div className="ra-head-actions">
          <Button
            type="text"
            className="collapse-btn"
            title={collapsed ? '展开路由区' : '收起为仅图标'}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={onToggleCollapse}
          />
          {/* icon-btn 类保留：桌面端隐藏、移动端显示的响应式开关由它控制 */}
          <Button
            type="text"
            className="icon-btn close-btn"
            title="关闭"
            icon={<CloseOutlined />}
            onClick={onCloseDrawer}
          />
        </div>
      </div>
      <div className="route-tree">
        {collapsed ? (
          // 仅图标模式：只展示一级路由图标，点击选中
          roots.map((r) => (
            <div
              key={r.id}
              className={'route-node lvl1' + (r.id === selectedRouteId ? ' active' : '')}
              title={r.name}
              onClick={() => selectRoute(r.id)}
            >
              <span className="rt-ico">{ICONS[r.id] || FALLBACK_ICON}</span>
            </div>
          ))
        ) : (
          <Tree
            blockNode
            treeData={toTreeData(roots)}
            selectedKeys={[selectedRouteId]}
            expandedKeys={expandedKeys}
            onExpand={(keys) => setClosedNodes(new Set(parentIds.filter((id) => !keys.includes(id))))}
            onSelect={(keys) => {
              // 点击已选中节点时 keys 为空，忽略以保持选中
              if (keys.length > 0) selectRoute(String(keys[0]))
            }}
          />
        )}
        {!roots.length && <div className="empty-tip">暂无页面</div>}
      </div>
    </aside>
  )
}
