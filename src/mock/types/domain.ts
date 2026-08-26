// Dashboard, datasource, content, and AI domain contracts.
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
  status?: 'draft' | 'published' | 'deprecated'
  hasSecret?: boolean
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
  apiKey?: string | null // 接口不再返回明文，仅内部编辑提交时使用
  hasApiKey?: boolean
  apiKeyMasked?: string | null
  status: 'ready' | 'unset' | 'error'
  group?: string
  priority?: number
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
  /** 机器人类型 */
  type?: string
  /** 机器人描述 */
  description?: string
  /** 绑定的 AI 模型 id */
  modelId: string | null
  /** 提示词（系统提示） */
  prompt?: string
  /** 兼容别名：系统提示词 */
  systemPrompt?: string
  /** 启用状态 */
  enabled: boolean
  /** 归属用户（平台机器人/历史数据为空） */
  ownerId?: string | null
  /** 是否进入共享市场 */
  isPublic?: boolean
  /** 被安装次数 */
  installCount?: number
  /** 发布时间 */
  publishedAt?: string | null
  /** 就绪状态：ready / error / pending */
  status?: 'ready' | 'error' | 'pending'
  updatedAt: string
}

export interface AIMarketBotDTO extends AIBotDTO {
  ownerName?: string
}

export interface AISessionItem {
  id: string
  title?: string
  botId?: string
  modelId?: string
  messageCount: number
  createdAt: string
  updatedAt: string
}

export interface AISessionMessage {
  id: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  createdAt: string
}

export interface AIPromptDTO {
  id: string
  code: string
  name: string
  scene: 'chat' | 'generate' | 'design'
  content: string
  enabled: boolean
  version: number
  createdAt: string
  updatedAt: string
}

export interface AIUsageItem {
  id: string
  sessionId?: string
  modelId?: string
  scene: string
  status: string
  promptTokens: number
  completionTokens: number
  estimatedTokens: number
  durationMs: number
  createdAt: string
}

export interface AIUsageStats {
  totalCalls: number
  totalTokens: number
  totalDurationMs: number
  todayCalls: number
  byScene: Array<{
    scene: string
    _count: { _all: number }
    _sum: { estimatedTokens: number | null; durationMs: number | null }
  }>
}

export interface AIQuota {
  dailyLimit: number
  modelWhitelist: string[]
}

export interface AIToolArg {
  key: string
  type: string
  required: boolean
}

export interface AIToolDef {
  id: string
  name: string
  description: string
  args: AIToolArg[]
}

export interface KnowledgeDocDTO {
  id: string
  title: string
  content: string
  tags: string[]
  createdAt: string
  updatedAt: string
}

export interface AISearchDoc {
  id: string
  title: string
  excerpt: string
}

export interface AgentFlowNode {
  id: string
  type: 'echo' | 'chat' | 'generate' | 'review' | 'datasetMeta' | 'componentSearch'
  label?: string
  args?: Record<string, unknown>
}

export interface AgentFlowDTO {
  id: string
  name: string
  description?: string
  nodes: AgentFlowNode[]
  enabled: boolean
  createdAt: string
  updatedAt: string
}

export interface FlowRunStep {
  id: string
  type: string
  label?: string
  ok: boolean
  output: string
}

export interface FlowRunResult {
  flowId: string
  flowName: string
  steps: FlowRunStep[]
  output: string
}
