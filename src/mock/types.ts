// ============================================================
// Mock 接口层 —— 统一类型定义
// 用于在前端离线模拟后端 REST 接口返回，支撑设计器各模块的数据流转演示。
// ============================================================

/** 统一响应信封（与后端约定一致）：code=0 表示成功 */
export interface ApiResp<T> {
  code: number
  message: string
  data: T
}

/** 分页查询入参 */
export interface PageQuery {
  page?: number
  pageSize?: number
  keyword?: string
  sort?: string
}

/** 分页结果（列表接口 data 即此结构） */
export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

// ---------------- 认证与权限（RBAC） ----------------
export interface AuthRoleDTO {
  code: string
  name: string
}
export interface AuthUserDTO {
  id: string
  email: string
  name: string
  status: string
  orgId: string | null
  roles: AuthRoleDTO[]
  permissions: string[]
  lastLoginAt?: string
  createdAt?: string
}
export interface RbacRoleDTO {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: string[]
}
export interface RbacUserDTO {
  id: string
  email: string
  name: string
  status: string
  orgId: string | null
  lastLoginAt?: string
  createdAt?: string
  roles: AuthRoleDTO[]
}

// ---------------- 领域实体（与《全量路由功能计划书》数据结构对齐） ----------------

export type DashboardStatus = 'draft' | 'published' | 'archived'
export interface DashboardDTO {
  id: string
  name: string
  slug: string
  status: DashboardStatus
  ownerId: string
  ownerName: string
  updatedAt: string
  componentCount: number
}

// ---------------- 数据源（覆盖规范全部来源类型） ----------------
export type DsKind = 'static' | 'api' | 'sql' | 'websocket' | 'mqtt' | 'flow' | 'crawler'
export type SqlVendor = 'mysql' | 'sqlserver' | 'postgres' | 'starrocks' | 'oracle' | 'other'
export type ParseMode = 'json' | 'xml' | 'html' | 'script' // 数据解析（爬虫 / API）
export type DataSourceStatus = 'connected' | 'error'
export interface DataSourceDTO {
  id: string
  name: string
  kind: DsKind
  vendor?: SqlVendor // kind==='sql' 时：MySQL/SQLServer/PostgreSQL/StarRocks/Oracle，可扩展任意库
  scope: 'public' | 'private' // 公共数据集 / 独立数据集
  endpoint: string
  status: DataSourceStatus
  parseMode?: ParseMode // 爬虫 / API 解析方式
  updatedAt: string
}

// ---------------- 消息推送（企业微信/钉钉/邮件/阿里云短信/腾讯云短信） ----------------
export type ChannelKind = 'wechat' | 'dingtalk' | 'email' | 'sms-aliyun' | 'sms-tencent'
export interface MessageChannelDTO {
  id: string
  name: string
  kind: ChannelKind
  endpoint: string // webhook / smtp / 网关地址
  enabled: boolean
  updatedAt: string
}

// ---------------- 地图资源（EChart/高德/百度/腾讯/三方） ----------------
export type MapProvider = 'echart' | 'gaode' | 'baidu' | 'tencent' | 'custom'
export interface MapResourceDTO {
  id: string
  name: string
  provider: MapProvider
  key?: string
  center: [number, number]
  zoom: number
  updatedAt: string
}

// ---------------- 全局变量 / 函数 / 数据格式化 ----------------
export type VarKind = 'variable' | 'function' | 'formatter'
export interface GlobalVarDTO {
  id: string
  name: string
  kind: VarKind
  value: string // 变量值 / 函数体 / 格式化表达式
  scope: 'global' | 'screen'
  updatedAt: string
}

// ---------------- 代码仓库（源码组件 / Vue / HTML / 组件片段） ----------------
export type CodeLang = 'vue' | 'html' | 'ts' | 'js' | 'sql'
export interface CodeSnippetDTO {
  id: string
  name: string
  lang: CodeLang
  tags: string[]
  code: string
  updatedAt: string
}

// ---------------- 分类标签 ----------------
export interface CategoryDTO {
  id: string
  name: string
  group: string
  color: string
  count: number
}

// ---------------- AI 模型 / 机器人 ----------------
export type AIModelType = 'chat' | 'vision' | 'code' | 'embedding'
export interface AIModelDTO {
  id: string
  name: string
  provider: string // pi-ai provider 规范 id，如 openai / moonshotai-cn
  model?: string // pi-ai 目录内的真实模型标识
  type: AIModelType
  baseUrl: string
  apiKey?: string // 接入密钥（列表接口原样返回，编辑时回填，避免被清空）
  status: 'ready' | 'unset' | 'error'
  updatedAt: string
}

/** pi-ai 支持的 provider 目录（来自后端 /aiProviderCatalog） */
export interface ProviderCatalogModel {
  id: string
  name: string
  contextWindow: number
  maxTokens: number
  reasoning: boolean
  input: string[]
}
export interface ProviderCatalogItem {
  key: string       // 规范 id，入库用
  name: string      // 显示名
  aliases: string[] // 兼容别名
  models: ProviderCatalogModel[]
}
export interface AIBotDTO {
  id: string
  name: string
  modelId: string
  prompt: string
  enabled: boolean
  updatedAt: string
}

// ---------------- 数字孪生 3D：模型库 + 场景 ----------------
export type TwinCategory = '建筑' | '设备' | '交通' | '自然' | '人物' | '其他'
export interface TwinModelDTO {
  id: string
  name: string
  category: TwinCategory
  builtin: boolean // 预置 91 种 / 用户上传
  thumbnail: string
}
export type TwinGeometryType = 'box' | 'cylinder' | 'sphere' | 'cone' | 'torus' | 'plane'
export interface TwinSceneModel {
  id: string
  modelId: string
  name: string
  geoType: TwinGeometryType
  color: string
  x: number
  y: number
  z: number
  rx: number
  ry: number
  rz: number
  scale: number
}
export interface TwinKeyframeDTO {
  time: number
  x: number
  z: number
  rotationY: number
}
export type TwinSceneStatus = 'online' | 'maintenance' | 'offline'
export interface TwinSceneDTO {
  id: string
  name: string
  models: TwinSceneModel[]
  lighting: 'day' | 'night'
  fog: boolean
  status: TwinSceneStatus
  dashboardId?: string
  lastSyncAt?: string
  keyframes?: Record<string, TwinKeyframeDTO[]>
  duration?: number
  updatedAt: string
}

// ---------------- 物联组态：设备 + 告警规则 ----------------
export type IoTDeviceStatus = 'online' | 'offline' | 'alarm'
export interface IoTDeviceDTO {
  id: string
  name: string
  type: string
  status: IoTDeviceStatus
  metrics: Record<string, number>
  updatedAt: string
}
export type AlarmLevel = 'info' | 'warning' | 'critical'
export interface IoTAlarmRuleDTO {
  id: string
  deviceId: string
  deviceName: string
  metric: string
  op: '>' | '<' | '==' | '!='
  threshold: number
  level: AlarmLevel
  channels: ChannelKind[]
  enabled: boolean
}

// ---------------- 数据填报 / 工作流 / 轮播 / 插件 ----------------
export interface DataEntryDTO {
  id: string
  name: string
  fields: { name: string; type: 'text' | 'number' | 'date' | 'select'; options?: string[] }[]
  rows: Record<string, string | number>[]
}
export interface WorkflowDTO {
  id: string
  name: string
  trigger: string
  nodes: string[]
  status: 'draft' | 'running'
}
export interface CarouselDTO {
  id: string
  name: string
  slides: string[]
  intervalSec: number
  enabled: boolean
  updatedAt: string
}
export interface PluginDTO {
  id: string
  name: string
  author: string
  version: string
  installed: boolean
  desc: string
  rating: number
}

export interface DatasetField {
  field: string
  type: 'string' | 'number' | 'date' | 'boolean'
}
export interface DatasetDTO {
  id: string
  name: string
  sourceId: string
  sourceName: string
  rowCount: number
  updatedAt: string
  schema: DatasetField[]
}

export interface DatasetRow {
  [key: string]: string | number | boolean
}

export type UserStatus = 'active' | 'disabled'

// ---------------- 独立部署（企业级）----------------
export type DeployEnvKind = 'dev' | 'test' | 'prod'
export interface DeployEnvDTO {
  id: string
  name: string
  kind: DeployEnvKind
  /** 部署目标基础地址，如 https://bi.example.com（产物内数据/资源请求根） */
  baseUrl: string
  description?: string
  createdAt: string
}

export type DeployPackageStatus = 'draft' | 'built' | 'deployed'
export interface DeployPackageDTO {
  id: string
  name: string
  /** 语义化版本，如 1.0.0 */
  version: string
  /** 纳入部署的大屏路由 id 列表（来自 Zustand routes 中 kind==='dashboard'） */
  screenIds: string[]
  /** 目标环境 id */
  envId: string
  /** 目标环境名称（冗余存储，避免联表） */
  envName: string
  /** 数据源环境级绑定：dsId -> 该环境下 endpoint（覆盖默认，实现多环境一套大屏多套配置） */
  datasourceBindings: Record<string, string>
  /** 是否将全局变量打包进产物（实现模块间数据互通） */
  includeGlobalVars: boolean
  status: DeployPackageStatus
  createdAt: string
  createdBy: string
}

export type DeployStatus = 'building' | 'success' | 'failed'
export interface DeployRecordDTO {
  id: string
  packageId: string
  packageName: string
  version: string
  envId: string
  envName: string
  screenName?: string
  status: DeployStatus
  deployedAt: string
  deployedBy: string
  /** 产物地址（企业场景通常为 CDN / 对象存储 / 静态站点 URL） */
  artifactUrl?: string
  log: string[]
}
export interface UserDTO {
  id: string
  name: string
  email: string
  roles: string[]
  orgId: string
  status: UserStatus
  lastLogin: string
}

export interface RoleDTO {
  key: string
  name: string
  desc: string
  perms: string[]
}

export type ExtensionHealth = 'healthy' | 'degraded' | 'down'
export interface ExtensionDTO {
  key: string
  name: string
  enabled: boolean
  health: ExtensionHealth
  quota: string
}

export type WidgetLifecycleStatus = 'draft' | 'published' | 'deprecated' | 'offline'
export interface WidgetDefDTO {
  id?: string
  type: string
  name: string
  icon: string
  category: string
  version: string
  desc: string
  /** 后端组件生命周期状态（可选，老定义兼容） */
  status?: WidgetLifecycleStatus
}

/** 组件版本 */
export interface WidgetVersionDTO {
  id: string
  widgetId: string
  version: string
  changelog: string
  createdAt: string
}

/** 组件中心统计：按状态 / 按分类聚合 */
export interface WidgetStatsDTO {
  byStatus: Record<string, number>
  byCategory: Record<string, number>
}

/** 通知 / 消息 */
export type NotificationLevel = 'info' | 'warning' | 'error' | 'success'
export interface NotificationDTO {
  id: string
  title: string
  content: string
  level: NotificationLevel
  read: boolean
  createdAt: string
}

/** 调度任务 */
export interface SchedulerJobDTO {
  id: string
  name: string
  cron: string
  enabled: boolean
  lastRunAt?: string
  lastResult?: string
  durationMs?: number
  updatedAt?: string
}

/** 数据同步任务 */
export interface SyncTaskDTO {
  id: string
  name: string
  source?: string
  target?: string
  enabled?: boolean
  lastRows?: number
  lastStatus?: string
  lastRunAt?: string
  updatedAt?: string
}

/** 组织 */
export interface OrgDTO {
  id: string
  name: string
  parentId?: string
  desc?: string
  createdAt?: string
}

/** 告警规则 */
export interface AlertRuleDTO {
  id: string
  name: string
  metric?: string
  op?: string
  threshold?: number
  level?: string
  enabled?: boolean
  updatedAt?: string
}

/** 系统参数 */
export interface SysParamDTO {
  key: string
  value: string
  desc?: string
}

/** 系统运行指标 */
export interface SystemMetricsDTO {
  uptimeSec: number
  memory: number | string
  counts: Record<string, number>
  [key: string]: unknown
}

/** 审计 / 系统日志 */
export interface AuditLogDTO {
  id: string
  level?: string
  action?: string
  operator?: string
  detail?: string
  createdAt?: string
  [key: string]: unknown
}

/** 静态资源引用关系 */
export interface AssetRefDTO {
  assetId: string
  count: number
  screens: { id: string; name: string }[]
}

// —— AI 智能结果 ——
export interface AIPredictResultDTO {
  forecast: number[]
  trend: string
  confidence: number
}
export interface AIRecommendResultDTO {
  widgets: string[]
  layout: string
  reason: string
}
export interface AIAnalyzeResultDTO {
  insights: string[]
}

// —— 开发工具 ——
export interface CodeGenResultDTO {
  code: string
  files: string[]
}
export type DevEnvDTO = Record<string, unknown>

// —— 资源统计 ——
export type AssetStatsDTO = Record<string, unknown>

// —— 开放能力注册表 ——
export interface CapabilityResourceDTO {
  kind: string
  name: string
  basePath: string
  ops: string[]
  actions: string[]
  count: number
  consumableBy: string[]
}
export interface CapabilityModuleDTO {
  key: string
  name: string
  resources: CapabilityResourceDTO[]
}
export interface CapabilityRegistryDTO {
  version: string
  generatedAt: string
  modules: CapabilityModuleDTO[]
}

export type ReportStatus = 'enabled' | 'paused'
export type ReportRunStatus = 'success' | 'failed' | 'never'

export interface ReportDesignDTO {
  title: string
  subtitle: string
  columns: string[]
  rows: string[][]
}

export interface ReportDTO {
  id: string
  name: string
  sourceId: string
  sourceName: string
  format: string[]
  schedule: string
  status: ReportStatus
  delivery: string[]
  lastRunAt: string
  lastRunStatus: ReportRunStatus
  design: ReportDesignDTO
  dashboardId?: string
  lastSyncAt?: string
  updatedAt: string
}

export interface AnalyticsDTO {
  dashboardId: string
  name: string
  pv: number
  durationSec: number
  perfP95: number
  errorRate: number
}

// 静态资源（画布素材来源）
export type AssetType = 'image' | 'map' | 'icon'
export interface AssetDTO {
  id: string
  name: string
  type: AssetType
  url: string
  sizeKb: number
  updatedAt: string
}

// 运行配置主题（画布主题来源）
export interface ThemeDTO {
  id: string
  name: string
  background: string
  accent: string
  desc: string
}
