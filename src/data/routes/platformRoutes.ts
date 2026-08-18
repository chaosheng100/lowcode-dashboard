// 平台路由结构（来自产品原型截图识别）
// 一级 11 个 / 二级 25 个，用 path 作为稳定 id，便于父子引用
import { genId } from '../utils/id'
import type { RouteConfig, ComponentInstance, DashboardProject } from '../types'

interface RouteTreeNode {
  name: string
  path: string
  children?: RouteTreeNode[]
}

const platformTree: RouteTreeNode[] = [
  { name: '大屏管理', path: '/dashboard' },
  {
    name: '生态扩展',
    path: '/extension',
    children: [
      { name: '报表管理', path: '/extension/report' },
      { name: '轮播管理', path: '/extension/carousel' },
      { name: '数字孪生', path: '/extension/twin' },
      { name: '独立部署', path: '/extension/deploy' },
      { name: '物联组态', path: '/extension/iot' }
    ]
  },
  {
    name: '数据管理',
    path: '/data',
    children: [
      { name: '数据源配置', path: '/data/source' },
      { name: '数据集管理', path: '/data/dataset' },
      { name: '数据填报', path: '/data/entry' },
      { name: '消息通道', path: '/data/channel' },
      { name: '数据工作流', path: '/data/workflow' }
    ]
  },
  {
    name: '组件中心',
    path: '/components',
    children: [
      { name: '组件库', path: '/components/library' },
      { name: '组件菜单', path: '/components/menu' }
    ]
  },
  {
    name: 'AI智能',
    path: '/ai',
    children: [
      { name: '模型管理', path: '/ai/models' },
      { name: '机器人市场', path: '/ai/market' },
      { name: 'AI助手', path: '/ai/assistant' }
    ]
  },
  {
    name: '开发工具',
    path: '/dev',
    children: [
      { name: '代码仓库', path: '/dev/code' },
      { name: '全局变量', path: '/dev/variables' }
    ]
  },
  {
    name: '资源管理',
    path: '/resources',
    children: [
      { name: '静态资源', path: '/resources/static' },
      { name: '地图资源', path: '/resources/map' }
    ]
  },
  {
    name: '系统管理',
    path: '/system',
    children: [
      { name: '分类标签', path: '/system/tags' },
      { name: '运行配置', path: '/system/runtime' },
      { name: '用户管理', path: '/system/users' },
      { name: '角色权限', path: '/system/roles' },
      { name: '大屏分析', path: '/system/analysis' },
      { name: '系统监控', path: '/system/monitor' }
    ]
  },
  {
    name: '插件管理',
    path: '/plugins',
    children: [
      { name: '我的插件', path: '/plugins/mine' },
      { name: '插件市场', path: '/plugins/market' }
    ]
  },
  { name: '帮助中心', path: '/help' },
  {
    name: '其他系统',
    path: '/others',
    children: [
      { name: 'AI模型平台', path: '/others/ai-platform' },
      { name: '调度任务', path: '/others/scheduler' },
      { name: '数据同步', path: '/others/sync' },
      { name: '通知中心', path: '/others/notify' }
    ]
  }
]

// 本地路由工厂（避免与 store 循环依赖）
function makeRoute(overrides: Partial<RouteConfig> = {}): RouteConfig {
  return {
    id: genId('route'),
    name: '新页面',
    path: '/page',
    parentId: null,
    kind: 'data',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    thumbnail: undefined,
    params: {},
    props: {},
    state: {},
    page: { width: 1920, height: 1080, background: '#f5f5f7', backgroundImage: '', backgroundImageFit: 'stretch', backgroundImageOpacity: 1, scale: 0.42, fit: true },
    components: [],
    links: [],
    ...overrides
  }
}

// 常用入口（默认给一个示例文本组件，避免画布空白）
const commonEntries = new Set<string>(['/dashboard', '/data/dataset', '/components/library', '/system/analysis'])

export function buildPlatformProject(): DashboardProject {
  const routes: RouteConfig[] = []
  const base = Date.UTC(2026, 2, 1) // 2026-03-01
  let i = 0

  const walk = (nodes: RouteTreeNode[], parentId: string | null) => {
    for (const n of nodes) {
      const id = n.path // 用 path 作为稳定 id
      const components: ComponentInstance[] = commonEntries.has(id)
        ? [
            {
              id: genId('text'),
              type: 'text',
              style: { x: 60, y: 60, w: 760, h: 64 },
              props: { content: `${n.name}（${n.path}）`, fontSize: 26 }
            }
          ]
        : []
      const createdAt = new Date(base + i * 5 * 3600_000).toISOString()
      const updatedAt = new Date(base + i * 5 * 3600_000 + 2 * 3600_000).toISOString()
      i += 1
      routes.push(
        makeRoute({
          id,
          name: n.name,
          path: n.path,
          parentId: parentId || null,
          kind: 'data',
          createdAt,
          updatedAt,
          params: { route: n.path },
          props: { title: n.name },
          state: {},
          components
        })
      )
      if (n.children) walk(n.children, id)
    }
  }
  walk(platformTree, null)

  return { version: '1.0', routes }
}

export const DEFAULT_ROUTE_ID = '/dashboard'
