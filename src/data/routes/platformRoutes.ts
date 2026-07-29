// 平台路由结构（来自产品原型截图识别）
// 一级 11 个 / 二级 25 个，用 path 作为稳定 id，便于父子引用
import { genId } from '../utils/id'
import { makeThumb } from '../utils/thumb'
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
      { name: '大屏分析', path: '/system/analysis' }
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
    children: [{ name: 'AI模型平台', path: '/others/ai-platform' }]
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
    page: { width: 1920, height: 1080, background: '#0a0e1a', backgroundImage: '', backgroundImageFit: 'stretch', backgroundImageOpacity: 1, scale: 0.42, fit: true },
    components: [],
    links: [],
    ...overrides
  }
}

// 常用入口（默认给一个示例文本组件，避免画布空白）
const commonEntries = new Set<string>(['/dashboard', '/data/dataset', '/components/library', '/system/analysis'])

// 大屏种子：作为「大屏管理」模块的可编辑大屏，与基础数据路由分离
const dashboardSeeds: Array<{ name: string; path: string; title: string }> = [
  { name: '运营总览大屏', path: '/screen/overview', title: '运营总览' },
  { name: '销售分析大屏', path: '/screen/sales', title: '销售分析' },
  { name: '物流监控大屏', path: '/screen/logistics', title: '物流监控' },
  { name: '能源管理大屏', path: '/screen/energy', title: '能源管理' },
  { name: '财务驾驶舱', path: '/screen/finance', title: '财务驾驶舱' },
  { name: '安全生产大屏', path: '/screen/safety', title: '安全生产' }
]

/** 构造大屏种子组件列表；运营总览额外嵌入数字孪生组件以演示「3D+2D 双轨融合」。 */
function buildScreenComponents(path: string, _idx = 0): ComponentInstance[] {
  const base: ComponentInstance[] = [
    {
      id: genId('text'),
      type: 'text',
      style: { x: 60, y: 60, w: 900, h: 70 },
      props: { content: dashboardSeeds.find((d) => d.path === path)?.title ?? '大屏', fontSize: 34, color: '#e6edf3', bold: true }
    },
    {
      id: genId('barChart'),
      type: 'barChart',
      style: { x: 60, y: 200, w: 560, h: 320 },
      props: {
        title: '区域分布',
        data: [
          { name: '华东', value: 320 },
          { name: '华北', value: 210 },
          { name: '华南', value: 260 },
          { name: '西部', value: 150 }
        ]
      }
    },
    {
      id: genId('metric'),
      type: 'metric',
      style: { x: 680, y: 200, w: 320, h: 150 },
      props: { label: '核心指标', data: [{ name: '总量', value: 940 }], unit: '万' }
    }
  ]
  if (path === '/screen/overview') {
    base.push({
      id: genId('digitalTwin'),
      type: 'digitalTwin',
      style: { x: 1040, y: 200, w: 520, h: 360 },
      props: { title: '工厂数字孪生', lighting: 'day', fog: false, showLabels: true, showHud: true, showControl: true, showSim: true, autoRotate: false, interactive: true, filterField: 'entityId', sourceKind: 'simulated' }
    })
    base.push({
      id: genId('twinAlarm'),
      type: 'twinAlarm',
      style: { x: 1040, y: 580, w: 520, h: 260 },
      props: { title: '孪生告警清单', filterField: 'entityId', maxItems: 30 }
    })
  }
  return base
}

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

  // 追加大屏路由（dashboard 类型），供「大屏管理 → 大屏编辑器」独立编辑
  dashboardSeeds.forEach((d, idx) => {
    const components = buildScreenComponents(d.path, idx)
    const createdAt = new Date(base + (i + idx) * 5 * 3600_000).toISOString()
    const updatedAt = new Date(base + (i + idx) * 5 * 3600_000 + (1 + idx) * 3600_000).toISOString()
    routes.push(
      makeRoute({
        id: d.path,
        name: d.name,
        path: d.path,
        parentId: null,
        kind: 'dashboard',
        createdAt,
        updatedAt,
        thumbnail: makeThumb(d.path),
        params: { screen: d.path },
        props: { title: d.title },
        state: {},
        components
      })
    )
  })

  return { version: '1.0', routes }
}

export const DEFAULT_ROUTE_ID = '/dashboard'
