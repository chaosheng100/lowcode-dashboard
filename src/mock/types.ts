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
  provider: string // openai / 通义 / 文心 / 本地
  type: AIModelType
  baseUrl: string
  status: 'ready' | 'unset' | 'error'
  updatedAt: string
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
export interface TwinSceneDTO {
  id: string
  name: string
  models: { modelId: string; x: number; y: number; z: number; rx: number; ry: number; rz: number }[]
  lighting: 'day' | 'night'
  fog: boolean
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

export interface WidgetDefDTO {
  type: string
  name: string
  icon: string
  category: string
  version: string
  desc: string
}

export interface ReportDTO {
  id: string
  name: string
  sourceName: string
  format: string[]
  schedule: string
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
