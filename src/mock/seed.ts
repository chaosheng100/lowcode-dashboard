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
  ThemeDTO,
  MessageChannelDTO,
  MapResourceDTO,
  GlobalVarDTO,
  CodeSnippetDTO,
  CategoryDTO,
  AIModelDTO,
  AIBotDTO,
  TwinModelDTO,
  TwinSceneDTO,
  IoTDeviceDTO,
  IoTAlarmRuleDTO,
  DataEntryDTO,
  WorkflowDTO,
  CarouselDTO,
  PluginDTO,
  DeployEnvDTO,
  DeployPackageDTO,
  DeployRecordDTO,
  DsKind,
  SqlVendor,
  ChannelKind,
  MapProvider,
  TwinCategory
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

// 数据源：覆盖规范全部来源（静态/API/SQL[多库]/WebSocket/MQTT/Flow/爬虫解析）
const DS_DEFS: Array<{ name: string; kind: DsKind; vendor?: SqlVendor; scope: 'public' | 'private'; endpoint: string; parseMode?: 'json' | 'xml' | 'html' | 'script' }> = [
  { name: '静态示例数据', kind: 'static', scope: 'public', endpoint: '内置数据集' },
  { name: '用户中心 API', kind: 'api', scope: 'public', endpoint: 'https://api.example.com/v1', parseMode: 'json' },
  { name: '生产业务库 MySQL', kind: 'sql', vendor: 'mysql', scope: 'public', endpoint: '10.20.1.10:3306' },
  { name: '数仓 ODS PostgreSQL', kind: 'sql', vendor: 'postgres', scope: 'public', endpoint: '10.20.1.11:5432' },
  { name: '报表库 SQLServer', kind: 'sql', vendor: 'sqlserver', scope: 'private', endpoint: '10.20.2.20:1433' },
  { name: '实时分析 StarRocks', kind: 'sql', vendor: 'starrocks', scope: 'public', endpoint: '10.20.2.21:9030' },
  { name: '财务库 Oracle', kind: 'sql', vendor: 'oracle', scope: 'private', endpoint: '10.20.3.30:1521' },
  { name: 'IoT 实时流 WebSocket', kind: 'websocket', scope: 'public', endpoint: 'wss://stream.example.com/device' },
  { name: '设备消息 MQTT', kind: 'mqtt', scope: 'public', endpoint: 'mqtt://broker.example.com:1883' },
  { name: '订单 Flow 流程', kind: 'flow', scope: 'public', endpoint: 'flow://engine/order' },
  { name: '舆情爬虫源', kind: 'crawler', scope: 'private', endpoint: 'https://news.example.com', parseMode: 'html' }
]
export const dataSources: DataSourceDTO[] = DS_DEFS.map((d, i) => {
  const r = rng(i + 50)
  const status = r() > 0.2 ? 'connected' : 'error'
  return {
    id: `ds_${2000 + i}`,
    name: d.name,
    kind: d.kind,
    vendor: d.vendor,
    scope: d.scope,
    endpoint: d.endpoint,
    parseMode: d.parseMode,
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
    dataSourceId: src.id,
    sourceName: src.name,
    type: 'static',
    rowCount: 1000 + Math.floor(r() * 90000),
    updatedAt: new Date(Date.now() - Math.floor(r() * 5) * 86400000).toISOString().slice(0, 10),
    fields: [
      { fieldKey: 'dim_date', label: '日期', fieldType: 'date', semanticType: 'dimension', format: 'yyyy-MM' },
      { fieldKey: 'region', label: '区域', fieldType: 'string', semanticType: 'dimension' },
      { fieldKey: 'metric', label: '指标', fieldType: 'string', semanticType: 'dimension' },
      { fieldKey: 'value', label: '数值', fieldType: 'number', semanticType: 'metric', aggregation: 'sum' },
      { fieldKey: 'is_abnormal', label: '是否异常', fieldType: 'boolean', semanticType: 'dimension' }
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
  const dataset = datasets[i % datasets.length]
  const values = [320, 210, 260, 150, 180, 95]
  return {
    id: `rpt_${4000 + i}`,
    name,
    sourceId: dataset.id,
    sourceName: dataset.name,
    format: i % 2 === 0 ? ['pdf', 'xlsx'] : ['xlsx'],
    schedule: ['每日 08:00', '每周一 09:00', '每月 1 日', '每季度首月 1 日'][i % 4],
    status: i === 4 ? 'paused' : 'enabled',
    delivery: i % 2 === 0 ? ['邮件'] : ['企业微信'],
    lastRunAt: new Date(Date.now() - Math.floor(r() * 3) * 86400000).toISOString(),
    lastRunStatus: i === 3 ? 'failed' : 'success',
    design: {
      title: name,
      subtitle: '经营数据概览',
      columns: ['区域', '指标', '数值'],
      rows: ['华东', '华北', '华南', '西部', '华中', '东北'].map((region, index) => [region, dataset.name, String(values[index])])
    },
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

// ====================== 扩展域：消息推送 ======================
const CHANNEL_DEFS: Array<{ name: string; kind: ChannelKind; endpoint: string }> = [
  { name: '企业微信应用', kind: 'wechat', endpoint: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=***' },
  { name: '钉钉机器人', kind: 'dingtalk', endpoint: 'https://oapi.dingtalk.com/robot/send?access_token=***' },
  { name: '系统邮件网关', kind: 'email', endpoint: 'smtp://mail.example.com:465' },
  { name: '阿里云短信', kind: 'sms-aliyun', endpoint: 'dysmsapi.aliyuncs.com' },
  { name: '腾讯云短信', kind: 'sms-tencent', endpoint: 'sms.tencentcloudapi.com' }
]
export const messageChannels: MessageChannelDTO[] = CHANNEL_DEFS.map((c, i) => ({
  id: `ch_${7000 + i}`,
  name: c.name,
  kind: c.kind,
  endpoint: c.endpoint,
  enabled: i % 3 !== 0,
  updatedAt: new Date(Date.now() - Math.floor(rng(i + 700)() * 8) * 86400000).toISOString().slice(0, 10)
}))

// ====================== 扩展域：地图资源 ======================
const MAP_DEFS: Array<{ name: string; provider: MapProvider; center: [number, number]; zoom: number }> = [
  { name: '全国 EChart 地图', provider: 'echart', center: [104, 35], zoom: 1.2 },
  { name: '高德底图-华东', provider: 'gaode', center: [121, 31], zoom: 10 },
  { name: '百度底图-华北', provider: 'baidu', center: [116, 39], zoom: 11 },
  { name: '腾讯底图-华南', provider: 'tencent', center: [113, 23], zoom: 10 },
  { name: '自定义GeoJSON', provider: 'custom', center: [0, 0], zoom: 1 }
]
export const mapResources: MapResourceDTO[] = MAP_DEFS.map((m, i) => ({
  id: `map_${8000 + i}`,
  name: m.name,
  provider: m.provider,
  key: m.provider === 'custom' ? undefined : '****',
  center: m.center,
  zoom: m.zoom,
  updatedAt: new Date(Date.now() - Math.floor(rng(i + 800)() * 6) * 86400000).toISOString().slice(0, 10)
}))

// ====================== 扩展域：全局变量 / 函数 / 格式化 ======================
export const globalVars: GlobalVarDTO[] = [
  { id: 'gv_1', name: 'g_now', kind: 'variable', value: '2026-07-28', scope: 'global', updatedAt: '2026-07-20' },
  { id: 'gv_2', name: 'fmtMoney', kind: 'formatter', value: "v => '¥' + (v/10000).toFixed(2) + '万'", scope: 'global', updatedAt: '2026-07-21' },
  { id: 'gv_3', name: 'calcGrowth', kind: 'function', value: '(a, b) => ((b - a) / a * 100).toFixed(1) + "%"', scope: 'screen', updatedAt: '2026-07-22' }
]

// ====================== 扩展域：代码仓库 ======================
const SNIPPET_SQL = 'SELECT region, SUM(value) AS total\nFROM sales\nGROUP BY region\nORDER BY total DESC;'
const SNIPPET_VUE = '<template>\n  <div class="card">{{ title }}</div>\n</template>\n<script setup>\nconst props = defineProps({ title: String })\n</script>'
const SNIPPET_HTML = '<div class="marquee"><span>实时滚动播报内容</span></div>'
export const codeSnippets: CodeSnippetDTO[] = [
  { id: 'cs_1', name: '区域销售汇总', lang: 'sql', tags: ['sql', '销售'], code: SNIPPET_SQL, updatedAt: '2026-07-18' },
  { id: 'cs_2', name: '指标卡组件', lang: 'vue', tags: ['vue', '组件'], code: SNIPPET_VUE, updatedAt: '2026-07-19' },
  { id: 'cs_3', name: '滚动播报条', lang: 'html', tags: ['html', '动效'], code: SNIPPET_HTML, updatedAt: '2026-07-20' }
]

// ====================== 扩展域：分类标签 ======================
export const categories: CategoryDTO[] = [
  { id: 'cat_1', name: '经营类', group: '大屏分类', color: '#4f8cff', count: 18 },
  { id: 'cat_2', name: '监控类', group: '大屏分类', color: '#22d3ee', count: 12 },
  { id: 'cat_3', name: '地理类', group: '大屏分类', color: '#a855f7', count: 7 },
  { id: 'cat_4', name: '金融', group: '行业', color: '#e0b15a', count: 9 },
  { id: 'cat_5', name: '政务', group: '行业', color: '#4ade80', count: 5 }
]

// ====================== 扩展域：AI 模型 / 机器人 ======================
export const aiModels: AIModelDTO[] = [
  { id: 'ai_1', name: 'GPT-4o 通义千问', provider: '通义', type: 'chat', baseUrl: 'https://dashscope.aliyuncs.com', status: 'ready', updatedAt: '2026-07-10' },
  { id: 'ai_2', name: '文心一言', provider: '文心', type: 'chat', baseUrl: 'https://aip.baidubce.com', status: 'ready', updatedAt: '2026-07-11' },
  { id: 'ai_3', name: 'CodeLlama 本地', provider: '本地', type: 'code', baseUrl: 'http://localhost:11434', status: 'unset', updatedAt: '2026-07-12' },
  { id: 'ai_4', name: '视觉识别模型', provider: 'openai', type: 'vision', baseUrl: 'https://api.openai.com', status: 'error', updatedAt: '2026-07-13' }
]
export const aiBots: AIBotDTO[] = [
  { id: 'bot_1', name: '大屏编排助手', modelId: 'ai_1', prompt: '你是一个数据大屏编排专家，帮助用户生成组件与配色。', enabled: true, updatedAt: '2026-07-14' },
  { id: 'bot_2', name: 'SQL 助手', modelId: 'ai_3', prompt: '将自然语言转为 SQL。', enabled: false, updatedAt: '2026-07-15' }
]

// ====================== 扩展域：数字孪生 3D（91 种预置模型） ======================
const TWIN_CATS: TwinCategory[] = ['建筑', '设备', '交通', '自然', '人物', '其他']
export const twinModels: TwinModelDTO[] = Array.from({ length: 91 }).map((_, i) => {
  const cat = TWIN_CATS[i % TWIN_CATS.length]
  return {
    id: `tm_${i}`,
    name: `${cat}模型${i + 1}`,
    category: cat,
    builtin: true,
    thumbnail: `https://picsum.photos/seed/tm${i}/120/120`
  }
})
export const twinScenes: TwinSceneDTO[] = [
  {
    id: 'tsc_1', name: '智慧园区孪生', lighting: 'day', fog: false, status: 'online', duration: 10, updatedAt: '2026-07-16',
    models: [{ id: 'obj_seed_1', modelId: 'tm_0', name: '园区主楼', geoType: 'box', color: '#4f8cff', x: 0, y: 0.6, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }]
  },
  {
    id: 'tsc_2', name: '工厂产线孪生', lighting: 'night', fog: true, status: 'maintenance', duration: 10, updatedAt: '2026-07-17',
    models: [{ id: 'obj_seed_2', modelId: 'tm_6', name: '一号厂房', geoType: 'box', color: '#64748b', x: 2, y: 0.6, z: -1, rx: 0, ry: 0.5, rz: 0, scale: 1 }]
  }
]

// ====================== 扩展域：物联组态 ======================
const IOT_TYPES = ['PLC', '传感器', '摄像头', '电表', '阀门']
export const iotDevices: IoTDeviceDTO[] = Array.from({ length: 14 }).map((_, i) => {
  const r = rng(i + 900)
  const status = (['online', 'online', 'offline', 'alarm'] as const)[Math.floor(r() * 4)]
  return {
    id: `iot_${i}`,
    name: `${IOT_TYPES[i % IOT_TYPES.length]}-${String(i + 1).padStart(2, '0')}`,
    type: IOT_TYPES[i % IOT_TYPES.length],
    status,
    metrics: { 温度: Math.round(r() * 80), 压力: Math.round(r() * 10), 流量: Math.round(r() * 100) },
    updatedAt: new Date(Date.now() - Math.floor(r() * 3) * 86400000).toISOString().slice(0, 10)
  }
})
export const iotAlarms: IoTAlarmRuleDTO[] = [
  { id: 'al_1', deviceId: 'iot_0', deviceName: 'PLC-01', metric: '温度', op: '>', threshold: 60, level: 'critical', channels: ['wechat', 'sms-tencent'], enabled: true },
  { id: 'al_2', deviceId: 'iot_3', deviceName: '电表-04', metric: '流量', op: '<', threshold: 5, level: 'warning', channels: ['dingtalk'], enabled: true }
]

// ====================== 扩展域：填报 / 工作流 / 轮播 / 插件 ======================
export const dataEntries: DataEntryDTO[] = [
  { id: 'de_1', name: '每日经营填报表', fields: [{ name: '日期', type: 'date' }, { name: '营收(万)', type: 'number' }, { name: '区域', type: 'select', options: ['华东', '华北', '华南'] }], rows: [{ 日期: '2026-07-27', '营收(万)': 320, 区域: '华东' }] },
  { id: 'de_2', name: '设备巡检记录', fields: [{ name: '设备', type: 'text' }, { name: '状态', type: 'select', options: ['正常', '异常'] }], rows: [] }
]
export const workflows: WorkflowDTO[] = [
  { id: 'wf_1', name: '订单实时同步流', trigger: 'MQTT:order/topic', nodes: ['解析', '清洗', '入库', '大屏推送'], status: 'running' },
  { id: 'wf_2', name: '日报生成流', trigger: 'Cron:0 8 * * *', nodes: ['抽取', '聚合', '导出'], status: 'draft' }
]
export const carousels: CarouselDTO[] = [
  { id: 'cl_1', name: '首页轮播方案', slides: ['/screen/overview', '/screen/sales', '/screen/finance'], intervalSec: 8, enabled: true, updatedAt: '2026-07-25' },
  { id: 'cl_2', name: '大屏巡播', slides: ['/screen/safety', '/screen/energy', '/screen/logistics'], intervalSec: 12, enabled: false, updatedAt: '2026-07-21' }
]
export const plugins: PluginDTO[] = [
  { id: 'pl_1', name: '3D 地球', author: '官方', version: '1.4.0', installed: true, desc: '自带纹理的三维地球组件', rating: 4.8 },
  { id: 'pl_2', name: '瀑布图', author: '社区', version: '0.9.2', installed: false, desc: '瀑布式占比分析图', rating: 4.2 },
  { id: 'pl_3', name: '词云', author: '社区', version: '1.1.0', installed: true, desc: '文本词频可视化', rating: 4.5 }
]

// ====================== 独立部署（企业级）：环境 / 包 / 记录 ======================
export const deployEnvs: DeployEnvDTO[] = [
  { id: 'env_dev', name: '开发环境', kind: 'dev', baseUrl: 'https://dev-bi.example.com', description: '研发联调与功能验证', createdAt: '2026-07-01' },
  { id: 'env_test', name: '测试环境', kind: 'test', baseUrl: 'https://test-bi.example.com', description: '预发验证与回归', createdAt: '2026-07-05' },
  { id: 'env_prod', name: '生产环境', kind: 'prod', baseUrl: 'https://bi.example.com', description: '对外正式发布环境', createdAt: '2026-07-08' }
]
export const deployPackages: DeployPackageDTO[] = []
export const deployRecords: DeployRecordDTO[] = []
