// IoT, workflow, plugin, deployment, and directory contracts.
import type { ChannelKind } from './domain'

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

/** 数据集字段（语义层）：业务名称 + 维度/指标类型 + 聚合方式，AI 据此自动匹配字段 */
export interface DatasetField {
  /** 原始字段名/键（对应数据行中的 key） */
  fieldKey: string
  /** 业务名称（中文可读，AI 和用户都看这个，如 "销售额" "月份"） */
  label: string
  /** 数据类型 */
  fieldType: 'string' | 'number' | 'date' | 'boolean'
  /** 语义类型：维度（类目/横轴/标签） | 指标（数值/纵轴/值） */
  semanticType: 'dimension' | 'metric'
  /** 聚合方式：sum | avg | count | max | min | none（维度用 none） */
  aggregation?: string
  /** 显示格式：如 'yyyy-MM-dd'、'￥#,##0.00' */
  format?: string
  /** 补充说明（AI 理解用，如 "含税销售额，单位：元"） */
  description?: string
  /** 样例值（3-5 个代表性值，AI 快速感知数据形态） */
  sampleValues?: unknown[]
  sortOrder?: number
}

/** 数据集（与后端 dataset 模块对齐）：基于数据源构建，携带字段语义元信息，是 AI 自动匹配的直接对象 */
export interface DatasetDTO {
  id: string
  name: string
  projectId?: string
  dataSourceId?: string
  /** 来源数据源名称 */
  sourceName?: string
  description?: string
  /** 数据集类型：sql | api | static | csv */
  type: 'sql' | 'api' | 'static' | 'csv'
  /** 查询配置（SQL 语句 / API 路径 / 静态数据 JSON 等） */
  config?: unknown
  status?: string
  rowCount: number
  /** 字段语义元信息 */
  fields?: DatasetField[]
  createdAt?: string
  updatedAt?: string
}

export interface DatasetRow {
  [key: string]: unknown
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
