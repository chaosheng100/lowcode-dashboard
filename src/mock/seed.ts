// ============================================================
// Mock 种子数据 —— 各业务域的离线模拟数据
// 结构对齐《全量路由功能计划书》中各路由的数据结构定义。
// ============================================================
import type {
  DashboardDTO,
  DataSourceDTO,
  DatasetDTO,
  UserDTO,
  RoleDTO,
  ExtensionDTO,
  WidgetDefDTO,
  ReportDTO,
  AnalyticsDTO,
  AssetDTO,
  ThemeDTO
} from './types'

// 简易确定性伪随机（保证多次刷新数据一致，便于演示/调试）
function rng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

const OWNERS = ['张敏', '李强', '王芳', '陈晨', '赵磊']
const DASHBOARD_NAMES = [
  '集团经营驾驶舱',
  '生产制造实时监控',
  '城市交通态势大屏',
  '能源双碳监测中心',
  '销售业绩作战室',
  '园区安防态势',
  '物流调度指挥中心',
  '财务风控看板',
  '设备健康预测大屏',
  '应急指挥一张图',
  '零售门店运营屏',
  '政务便民服务大屏'
]

export const dashboards: DashboardDTO[] = DASHBOARD_NAMES.map((name, i) => {
  const r = rng(i + 1)
  const status = (['published', 'published', 'draft', 'archived'] as const)[Math.floor(r() * 4)]
  return {
    id: `dash_${1000 + i}`,
    name,
    slug: name.replace(/[^\w一-龥]/g, '_'),
    status,
    ownerId: `u_${i % OWNERS.length}`,
    ownerName: OWNERS[i % OWNERS.length],
    updatedAt: new Date(Date.now() - Math.floor(r() * 30) * 86400000).toISOString().slice(0, 10),
    componentCount: 8 + Math.floor(r() * 40)
  }
})

const DS_TYPES = ['mysql', 'postgres', 'api', 'kafka', 'file'] as const
const DS_NAMES = [
  '生产业务库',
  '数仓ODS',
  '用户中心API',
  'IoT消息总线',
  '日志文件源',
  '财务系统库',
  '气象数据API',
  '订单交易库'
]
export const dataSources: DataSourceDTO[] = DS_NAMES.map((name, i) => {
  const r = rng(i + 50)
  const status = r() > 0.2 ? 'connected' : 'error'
  return {
    id: `ds_${2000 + i}`,
    name,
    type: DS_TYPES[i % DS_TYPES.length],
    endpoint: `10.20.${i}.${10 + i}:${[3306, 5432, 8080, 9092, 21][i % 5]}`,
    status,
    updatedAt: new Date(Date.now() - Math.floor(r() * 10) * 86400000).toISOString().slice(0, 10)
  }
})

const DATASET_NAMES = [
  '销售日报',
  '设备遥测指标',
  '用户活跃度',
  '能耗明细',
  '工单处理',
  '客流统计',
  '库存周转',
  '财务指标',
  '舆情热度',
  '订单转化'
]
export const datasets: DatasetDTO[] = DATASET_NAMES.map((name, i) => {
  const r = rng(i + 100)
  const src = dataSources[i % dataSources.length]
  return {
    id: `dset_${3000 + i}`,
    name,
    sourceId: src.id,
    sourceName: src.name,
    rowCount: 1000 + Math.floor(r() * 90000),
    updatedAt: new Date(Date.now() - Math.floor(r() * 5) * 86400000).toISOString().slice(0, 10),
    schema: [
      { field: 'dim_date', type: 'date' },
      { field: 'region', type: 'string' },
      { field: 'metric', type: 'string' },
      { field: 'value', type: 'number' },
      { field: 'is_abnormal', type: 'boolean' }
    ]
  }
})

const ORGS = ['总部', '华东大区', '华北大区', '华南大区', '研发中心']
export const users: UserDTO[] = Array.from({ length: 16 }).map((_, i) => {
  const r = rng(i + 200)
  const status = r() > 0.12 ? 'active' : 'disabled'
  const roleKeys = [
    ['super_admin'],
    ['platform_admin'],
    ['data_analyst'],
    ['designer'],
    ['developer'],
    ['operator'],
    ['auditor'],
    ['viewer']
  ][i % 8]
  return {
    id: `u_${i}`,
    name: `${ORGS[i % ORGS.length]}-用户${i + 1}`,
    email: `user${i + 1}@example.com`,
    roles: roleKeys,
    orgId: `org_${i % ORGS.length}`,
    status,
    lastLogin: new Date(Date.now() - Math.floor(r() * 20) * 86400000).toISOString().slice(0, 10)
  }
})

export const roles: RoleDTO[] = [
  { key: 'super_admin', name: '超级管理员', desc: '平台最高权限', perms: ['*:*'] },
  { key: 'platform_admin', name: '平台管理员', desc: '系统配置、用户与资源治理', perms: ['system:*', 'resources:*', 'user:*'] },
  { key: 'data_analyst', name: '数据分析师', desc: '数据源、数据集、填报与分析', perms: ['data:*', 'dashboard:read'] },
  { key: 'designer', name: '大屏设计师', desc: '大屏编排、组件与模板', perms: ['dashboard:*', 'components:*'] },
  { key: 'developer', name: '开发人员', desc: '代码、变量、插件与集成', perms: ['dev:*', 'plugins:*'] },
  { key: 'operator', name: '运营人员', desc: '内容发布与消息运营', perms: ['extension:carousel', 'data:entry', 'report:*'] },
  { key: 'auditor', name: '审计员', desc: '只读查看运行分析', perms: ['system:analysis:read', 'audit:read'] },
  { key: 'viewer', name: '只读访客', desc: '仅查看已授权大屏', perms: ['dashboard:read'] }
]

export const extensions: ExtensionDTO[] = [
  { key: 'report', name: '报表管理', enabled: true, health: 'healthy', quota: '500 报表/月' },
  { key: 'carousel', name: '轮播管理', enabled: true, health: 'healthy', quota: '20 方案' },
  { key: 'twin', name: '数字孪生', enabled: true, health: 'degraded', quota: '5 场景' },
  { key: 'deploy', name: '独立部署', enabled: false, health: 'down', quota: '—' },
  { key: 'iot', name: '物联组态', enabled: true, health: 'healthy', quota: '1000 点位' }
]

export const widgets: WidgetDefDTO[] = [
  { type: 'text', name: '文本', icon: 'T', category: '基础', version: '1.2.0', desc: '标题、说明等静态文本展示' },
  { type: 'image', name: '图片', icon: '🖼', category: '基础', version: '1.1.3', desc: '支持封面、背景图展示' },
  { type: 'lineChart', name: '折线图', icon: '📈', category: '图表', version: '2.0.1', desc: '趋势类时序数据' },
  { type: 'barChart', name: '柱状图', icon: '📊', category: '图表', version: '2.0.1', desc: '分类对比数据' },
  { type: 'pieChart', name: '饼图', icon: '🥧', category: '图表', version: '2.0.0', desc: '占比构成分析' },
  { type: 'metric', name: '指标卡', icon: '🔢', category: '指标', version: '1.4.2', desc: '关键 KPI 数字展示' },
  { type: 'table', name: '表格', icon: '▦', category: '指标', version: '1.5.0', desc: '明细数据列表' },
  { type: 'container', name: '容器', icon: '▢', category: '布局', version: '1.0.0', desc: '分组与布局容器' }
]

const REPORT_NAMES = ['周销售简报', '月度经营分析', '设备健康月报', '能耗季度报告', '客流周报', '财务风控日报']
export const reports: ReportDTO[] = REPORT_NAMES.map((name, i) => {
  const r = rng(i + 300)
  return {
    id: `rpt_${4000 + i}`,
    name,
    sourceName: datasets[i % datasets.length].name,
    format: i % 2 === 0 ? ['pdf', 'excel'] : ['excel'],
    schedule: ['每日 08:00', '每周一 09:00', '每月 1 日', '每季度首月 1 日'][i % 4],
    updatedAt: new Date(Date.now() - Math.floor(r() * 7) * 86400000).toISOString().slice(0, 10)
  }
})

export const analytics: AnalyticsDTO[] = dashboards.slice(0, 8).map((d, i) => {
  const r = rng(i + 400)
  return {
    dashboardId: d.id,
    name: d.name,
    pv: 200 + Math.floor(r() * 9800),
    durationSec: 30 + Math.floor(r() * 240),
    perfP95: 200 + Math.floor(r() * 1500),
    errorRate: Math.round(r() * 100) / 100
  }
})

// 静态资源（画布素材来源：背景图 / 地图底图 / 图标）
const ASSET_DEFS: Array<{ name: string; type: AssetDTO['type']; url: string }> = [
  { name: '城市夜景背景', type: 'image', url: 'https://picsum.photos/seed/city/1200/700' },
  { name: '科技蓝网格', type: 'image', url: 'https://picsum.photos/seed/grid/1200/700' },
  { name: '数据光斑', type: 'image', url: 'https://picsum.photos/seed/glow/1200/700' },
  { name: '全国地图底图', type: 'map', url: 'https://picsum.photos/seed/china-map/1200/800' },
  { name: '世界地图底图', type: 'map', url: 'https://picsum.photos/seed/world-map/1200/800' },
  { name: '园区俯瞰图', type: 'map', url: 'https://picsum.photos/seed/park/1200/800' },
  { name: '告警图标', type: 'icon', url: 'https://picsum.photos/seed/alarm/200/200' },
  { name: '设备图标', type: 'icon', url: 'https://picsum.photos/seed/device/200/200' }
]
export const assets: AssetDTO[] = ASSET_DEFS.map((a, i) => ({
  id: `asset_${5000 + i}`,
  name: a.name,
  type: a.type,
  url: a.url,
  sizeKb: 120 + Math.floor(rng(i + 600)() * 880),
  updatedAt: new Date(Date.now() - Math.floor(rng(i + 610)() * 12) * 86400000).toISOString().slice(0, 10)
}))

// 运行配置主题（画布主题来源）
export const themes: ThemeDTO[] = [
  { id: 'theme_dark', name: '深空蓝', background: '#0a0e1a', accent: '#4f8cff', desc: '默认深色科技风' },
  { id: 'theme_cyan', name: '青绿极光', background: '#06141a', accent: '#22d3ee', desc: '冷色极光主题' },
  { id: 'theme_purple', name: '紫魅夜', background: '#120a1f', accent: '#a855f7', desc: '紫调夜间主题' },
  { id: 'theme_ink', name: '墨金', background: '#0d0b07', accent: '#e0b15a', desc: '商务墨金主题' }
]
