// Component hub, system operations, reporting, analytics, asset, and theme contracts.
export type WidgetLifecycleStatus = 'draft' | 'published' | 'deprecated' | 'offline'
export interface WidgetDefDTO {
  id?: string
  type: string
  name: string
  icon: string
  category: string
  version: string
  desc: string
  /** 组件资产类型：'echarts' 表示 AI 生成的可投放 ECharts 图表 */
  kind?: 'echarts' | string
  /** 组件中心标记：true 表示该组件允许 AI 调整 */
  widget?: boolean
  /** ECharts option JSON（echarts 资产专用） */
  optionJson?: string
  /** AI 生成的源码资产源码（html/react） */
  sourceCode?: string
  /** 源码运行模式 */
  sandboxMode?: 'sandbox' | 'trusted'
  /** 数据字段契约，用于投放后绑定数据集/实时源 */
  dataSchema?: Record<string, unknown>
  /** 组件目录渲染原语，如 htmlComponent / reactComponent */
  renderer?: string
  /** 组件 Schema：渲染器类型 + 默认 props */
  schema?: {
    type?: string
    optionJson?: string
    sourceCode?: string
    sandboxMode?: string
    defaultProps?: Record<string, unknown>
  }
  /** 后端组件生命周期状态（可选，老定义兼容） */
  status?: WidgetLifecycleStatus
}

/** 组件目录元信息：与后端 GET /api/ai/components 的 listComponentsMeta 返回一致 */
export interface ComponentPropOptionDTO {
  value: string
  label: string
}

export interface ComponentPropShowDTO {
  key: string
  value?: unknown
  not?: boolean
}

export interface ComponentPropDefDTO {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  required?: boolean
  default?: unknown
  label?: string
  ui?: 'text' | 'number' | 'color' | 'select' | 'textarea' | 'boolean'
  options?: ComponentPropOptionDTO[]
  placeholder?: string
  min?: number
  max?: number
  step?: number
  group?: 'style' | 'data' | 'event'
  dynamicOptions?: string
  show?: ComponentPropShowDTO | null
}

export interface ComponentMetaFieldDTO {
  key: string
  label: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  ui: 'text' | 'number' | 'color' | 'select' | 'textarea' | 'boolean'
  options?: ComponentPropOptionDTO[]
  placeholder?: string
  min?: number
  max?: number
  step?: number
  dynamicOptions?: string
  show?: ComponentPropShowDTO | null
}

export interface ComponentMetaDTO {
  type: string
  name: string
  category: string
  icon?: string | null
  renderer: string
  defaultStyle: { x: number; y: number; w: number; h: number }
  schemaVersion?: number
  enabled?: boolean
  scope?: 'system' | 'custom'
  ownerId?: string | null
  description?: string | null
  version?: string
  status?: 'draft' | 'published' | 'deprecated'
  manifest?: Record<string, unknown> | null
  publishedAt?: string | null
  usageCount?: number
  props?: Record<string, ComponentPropDefDTO>
  defaultProps?: Record<string, unknown>
  styleSchema?: ComponentMetaFieldDTO[]
  bindingSchema?: ComponentMetaFieldDTO[]
  eventSchema?: ComponentMetaFieldDTO[]
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
