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

export type DataSourceType = 'mysql' | 'postgres' | 'api' | 'kafka' | 'file'
export type DataSourceStatus = 'connected' | 'error'
export interface DataSourceDTO {
  id: string
  name: string
  type: DataSourceType
  endpoint: string
  status: DataSourceStatus
  updatedAt: string
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
