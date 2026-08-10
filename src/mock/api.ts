// ============================================================
// Mock API 门面 —— 类型化的业务接口集合
// 真实接入后端时，只需把内部 mockFetch 替换为 fetch 即可，调用方无感。
// ============================================================
import { mockFetch, type RequestOptions } from './client'
import { getToken } from '../auth/store'
import { forceLogin } from '../auth/session'
import { apiClient } from '../api/client'
import type { ApiResp } from './types'
import type {
  PageQuery,
  PageResult,
  DashboardDTO,
  DataSourceDTO,
  DatasetDTO,
  DatasetField,
  DatasetRow,
  AuthUserDTO,
  RbacRoleDTO,
  RbacUserDTO,
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
  DeployEnvDTO,
  DeployPackageDTO,
  DeployRecordDTO,
  AIModelDTO,
  AIBotDTO,
  ProviderCatalogItem,
  TwinModelDTO,
  TwinSceneDTO,
  TwinEditLock,
  IoTDeviceDTO,
  IoTAlarmRuleDTO,
  DataEntryDTO,
  WorkflowDTO,
  CarouselDTO,
  PluginDTO,
  // 新增 DTO（组件中心 / AI / 开发工具 / 系统 / 插件 / 通知 / 调度 / 同步 / 开放能力）
  WidgetVersionDTO,
  WidgetStatsDTO,
  WidgetLifecycleStatus,
  NotificationDTO,
  NotificationLevel,
  SchedulerJobDTO,
  SyncTaskDTO,
  OrgDTO,
  AlertRuleDTO,
  SysParamDTO,
  SystemMetricsDTO,
  AuditLogDTO,
  AssetRefDTO,
  AssetStatsDTO,
  AIPredictResultDTO,
  AIRecommendResultDTO,
  AIAnalyzeResultDTO,
  CodeGenResultDTO,
  DevEnvDTO,
  CapabilityRegistryDTO
} from './types'
import type { AIDesignSchema, AIDesignIntent, AIDesignReview, AIDesignData } from '../data/types'

// ---------------- SSE 流式消费（对接后端 pi-agent）----------------
// 后端 /api/ai/chat、/api/ai/generate 以 SSE 真实流式输出；
// 此处缓冲增量并在结束后 resolve 为旧的 { code, data:{ reply|code } } 形状，
// 调用方（AIAssistantPage 等）无需任何改动即可享受流式后端。
// 跨请求保持会话（满足「持久化、跨请求保留」需求）：同一页面的多次对话复用同一 sessionId
let aiChatSessionId: string | undefined
let aiGenSessionId: string | undefined

interface SseResult {
  done?: { type: 'done'; reply?: string; code?: string; sessionId?: string }
  error?: string
}

/** SSE 多智能体事件回调（设计接口除 delta 外还下发明意/结构/数据/校验） */
interface SseCallbacks {
  onDelta?: (text: string) => void
  onIntent?: (intent: AIDesignIntent) => void
  onSchema?: (schema: AIDesignSchema) => void
  onReview?: (review: AIDesignReview) => void
  onData?: (data: AIDesignData) => void
  onError?: (msg: string) => void
  signal?: AbortSignal
}

async function postSSE(path: string, body: unknown, cb?: SseCallbacks): Promise<SseResult> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' }
  const token = getToken()
  if (token) headers['Authorization'] = `Bearer ${token}`
  try {
    const res = await apiClient.post(path.replace(/^\/api/, ''), body, {
      adapter: 'fetch',
      responseType: 'stream',
      signal: cb?.signal,
      headers,
    })
    const stream = res.data as ReadableStream<Uint8Array> | undefined
    if (!stream) {
      const msg = 'SSE 请求失败：后端未返回响应流'
      cb?.onError?.(msg)
      return { error: msg }
    }
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    let donePayload: SseResult['done']
    let errorMsg: string | undefined
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })
      let idx: number
      while ((idx = buffer.indexOf('\n\n')) !== -1) {
        const raw = buffer.slice(0, idx)
        buffer = buffer.slice(idx + 2)
        const line = raw
          .split('\n')
          .map((l) => l.trim())
          .find((l) => l.startsWith('data:'))
        if (!line) continue
        const json = line.slice(5).trim()
        if (!json) continue
        try {
          const p = JSON.parse(json)
          if (p.type === 'delta') {
            if (cb?.onDelta && typeof p.text === 'string') cb.onDelta(p.text)
          } else if (p.type === 'done') donePayload = p
          else if (p.type === 'error') {
            errorMsg = p.message
            cb?.onError?.(p.message)
          } else if (p.type === 'schema') cb?.onSchema?.(p.schema)
          else if (p.type === 'intent') cb?.onIntent?.(p.intent)
          else if (p.type === 'review') cb?.onReview?.(p.review)
          else if (p.type === 'data') cb?.onData?.(p.data)
        } catch {
          /* 忽略无法解析的帧 */
        }
      }
    }
    return { done: donePayload, error: errorMsg }
  } catch (e) {
    const status = (e as { response?: { status?: number } }).response?.status
    if (status === 401 || status === 403) forceLogin()
    const msg = `SSE 请求失败: ${(e as Error).message}`
    cb?.onError?.(msg)
    return { error: msg }
  }
}

export const api = {
  // 大屏管理
  listDashboards: (q: PageQuery = {}) => mockFetch<PageResult<DashboardDTO>>('GET', '/api/dashboards', { query: q }),
  getDashboard: (id: string) => mockFetch<DashboardDTO | null>('GET', `/api/dashboards/${id}`),

  // 数据源
  listDataSources: (q: PageQuery = {}) => mockFetch<PageResult<DataSourceDTO>>('GET', '/api/datasources', { query: q }),
  testDataSource: (id: string) => mockFetch<{ id: string; ok: boolean; latencyMs: number }>('POST', `/api/datasources/${id}/test`),
  saveDataSource: (body: Partial<DataSourceDTO>) =>
    mockFetch<DataSourceDTO>(body.id ? 'PATCH' : 'POST', `/api/datasources${body.id ? '/' + body.id : ''}`, { body }),
  deleteDataSource: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/datasources/${id}`),

  // 数据集（语义层：dataset 模块，含字段语义元信息与查询接口）
  listDatasets: (q: PageQuery = {}) => mockFetch<PageResult<DatasetDTO>>('GET', '/api/datasets', { query: q }),
  getDataset: (id: string) => mockFetch<DatasetDTO>('GET', `/api/datasets/${id}`),
  saveDataset: (body: Partial<DatasetDTO> & { fields?: DatasetField[]; config?: unknown }) =>
    mockFetch<DatasetDTO>(body.id ? 'PATCH' : 'POST', `/api/datasets${body.id ? '/' + body.id : ''}`, { body }),
  deleteDataset: (id: string) => mockFetch<null>('DELETE', `/api/datasets/${id}`),
  queryDataset: (id: string, params: { pageSize?: number } = {}) =>
    mockFetch<{ list: DatasetRow[]; total: number; columns: string[] }>('POST', `/api/datasets/${id}/query`, { body: params }),
  /** 数据集创建可选的数据源（后端 data 模块 DataSource 表） */
  listDataEngineSources: () => mockFetch<Array<{ id: string; name: string; type: string }>>('GET', '/api/data/sources'),

  // ============ 认证与权限（RBAC）============
  auth: {
    register: (body: { email: string; name: string; password: string; orgId?: string }) =>
      mockFetch<{ id: string; email: string; name: string; status: string; orgId: string | null }>(
        'POST',
        '/api/auth/register',
        { body, skipAuth: true },
      ),
    login: (body: { email: string; password: string }) =>
      mockFetch<{ accessToken: string; refreshToken: string; user: AuthUserDTO }>('POST', '/api/auth/login', {
        body,
        skipAuth: true,
      }),
    refresh: (refreshToken: string) =>
      mockFetch<{ accessToken: string; refreshToken: string }>('POST', '/api/auth/refresh', {
        body: { refreshToken },
        skipAuth: true,
      }),
    profile: () => mockFetch<AuthUserDTO>('GET', '/api/auth/profile'),
    logout: () => mockFetch<{ ok: boolean }>('POST', '/api/auth/logout'),
  },
  rbac: {
    listRoles: (q: PageQuery = {}) => mockFetch<RbacRoleDTO[]>('GET', '/api/rbac/roles', { query: q }),
    createRole: (body: { code: string; name: string; description?: string; permissions?: string[] }) =>
      mockFetch<RbacRoleDTO>('POST', '/api/rbac/roles', { body }),
    updateRole: (id: string, body: { name?: string; description?: string; permissions?: string[] }) =>
      mockFetch<RbacRoleDTO>('PATCH', `/api/rbac/roles/${id}`, { body }),
    deleteRole: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/rbac/roles/${id}`),
    listUsers: (q: PageQuery = {}) => mockFetch<PageResult<RbacUserDTO>>('GET', '/api/rbac/users', { query: q }),
    setUserRoles: (id: string, roleCodes: string[]) =>
      mockFetch<{ ok: boolean }>('PATCH', `/api/rbac/users/${id}/roles`, { body: { roleCodes } }),
    setUserStatus: (id: string, status: 'active' | 'disabled') =>
      mockFetch<{ ok: boolean }>('PATCH', `/api/rbac/users/${id}/status`, { body: { status } }),
  },

  // 扩展
  listExtensions: () => mockFetch<ExtensionDTO[]>('GET', '/api/extensions/status'),

  // 组件库
  listWidgets: (q: PageQuery = {}) => mockFetch<PageResult<WidgetDefDTO>>('GET', '/api/widgets', { query: q }),

  // 报表
  listReports: (q: PageQuery = {}) => mockFetch<PageResult<ReportDTO>>('GET', '/api/reports', { query: q }),
  saveReport: (body: Partial<ReportDTO>) =>
    mockFetch<ReportDTO>(body.id ? 'PATCH' : 'POST', `/api/reports${body.id ? '/' + body.id : ''}`, { body }),
  deleteReport: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/reports/${id}`),
  runReport: (id: string) => mockFetch<ReportDTO>('POST', `/api/reports/${id}/run`),

  // 分析
  getAnalytics: (q: Record<string, any> = {}) => mockFetch<AnalyticsDTO[]>('GET', '/api/analytics/summary', { query: q }),

  // 素材（画布资源来源）
  listAssets: (q: PageQuery = {}) => mockFetch<PageResult<AssetDTO>>('GET', '/api/assets', { query: q }),

  // 主题（画布主题来源）
  listThemes: () => mockFetch<ThemeDTO[]>('GET', '/api/themes'),

  // —— 消息推送 ——
  listChannels: (q: PageQuery = {}) => mockFetch<PageResult<MessageChannelDTO>>('GET', '/api/messageChannels', { query: q }),
  saveChannel: (body: Partial<MessageChannelDTO>) =>
    mockFetch<MessageChannelDTO>(body.id ? 'PATCH' : 'POST', `/api/messageChannels${body.id ? '/' + body.id : ''}`, { body }),
  deleteChannel: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/messageChannels/${id}`),

  // —— 地图资源 ——
  listMaps: (q: PageQuery = {}) => mockFetch<PageResult<MapResourceDTO>>('GET', '/api/mapResources', { query: q }),
  saveMap: (body: Partial<MapResourceDTO>) =>
    mockFetch<MapResourceDTO>(body.id ? 'PATCH' : 'POST', `/api/mapResources${body.id ? '/' + body.id : ''}`, { body }),
  deleteMap: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/mapResources/${id}`),

  // —— 全局变量 ——
  listVars: (q: PageQuery = {}) => mockFetch<PageResult<GlobalVarDTO>>('GET', '/api/globalVars', { query: q }),
  saveVar: (body: Partial<GlobalVarDTO>) =>
    mockFetch<GlobalVarDTO>(body.id ? 'PATCH' : 'POST', `/api/globalVars${body.id ? '/' + body.id : ''}`, { body }),
  deleteVar: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/globalVars/${id}`),

  // —— 代码仓库 ——
  listSnippets: (q: PageQuery = {}) => mockFetch<PageResult<CodeSnippetDTO>>('GET', '/api/codeSnippets', { query: q }),
  saveSnippet: (body: Partial<CodeSnippetDTO>) =>
    mockFetch<CodeSnippetDTO>(body.id ? 'PATCH' : 'POST', `/api/codeSnippets${body.id ? '/' + body.id : ''}`, { body }),
  deleteSnippet: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/codeSnippets/${id}`),

  // —— 分类标签 ——
  listCategories: (q: PageQuery = {}) => mockFetch<PageResult<CategoryDTO>>('GET', '/api/categories', { query: q }),
  saveCategory: (body: Partial<CategoryDTO>) =>
    mockFetch<CategoryDTO>(body.id ? 'PATCH' : 'POST', `/api/categories${body.id ? '/' + body.id : ''}`, { body }),
  deleteCategory: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/categories/${id}`),

  // —— AI 模型 / 机器人 ——
  listAIProviderCatalog: () => mockFetch<ProviderCatalogItem[]>('GET', '/api/aiProviderCatalog'),
  listAIModels: (q: PageQuery = {}) => mockFetch<PageResult<AIModelDTO>>('GET', '/api/aiModels', { query: q }),
  saveAIModel: (body: Partial<AIModelDTO>) =>
    mockFetch<AIModelDTO>(body.id ? 'PATCH' : 'POST', `/api/aiModels${body.id ? '/' + body.id : ''}`, { body }),
  deleteAIModel: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/aiModels/${id}`),
  pingAIModel: (id: string) => mockFetch<{ ok: boolean; status?: string; message?: string }>('POST', `/api/aiModels/${id}/ping`),
  listAIBots: (q: PageQuery = {}) => mockFetch<PageResult<AIBotDTO>>('GET', '/api/aiBots', { query: q }),
  saveAIBot: (body: Partial<AIBotDTO>) =>
    mockFetch<AIBotDTO>(body.id ? 'PATCH' : 'POST', `/api/aiBots${body.id ? '/' + body.id : ''}`, { body }),
  deleteAIBot: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/aiBots/${id}`),
  // AI 对话 / 代码生成（SSE 流式后端；onDelta 逐块回调驱动前端流式渲染，调用方契约不变）
  aiChat: async (
    message: string,
    opts: { onDelta?: (text: string) => void; onError?: (m: string) => void; signal?: AbortSignal } = {},
  ) => {
    const r = await postSSE(
      '/api/ai/chat',
      { message, sessionId: aiChatSessionId },
      { onDelta: opts.onDelta, onError: opts.onError, signal: opts.signal },
    )
    if (r.error) return { code: 500, message: r.error, data: { reply: '', suggestion: '' } }
    if (!r.done) return { code: 500, message: '无响应', data: { reply: '', suggestion: '' } }
    if (r.done.sessionId) aiChatSessionId = r.done.sessionId
    return { code: 0, message: 'ok', data: { reply: r.done.reply ?? '', suggestion: '' } }
  },
  aiGenerate: async (
    prompt: string,
    lang: string,
    opts: { onDelta?: (text: string) => void; onError?: (m: string) => void; signal?: AbortSignal } = {},
  ) => {
    const r = await postSSE(
      '/api/ai/generate',
      { prompt, lang, sessionId: aiGenSessionId },
      { onDelta: opts.onDelta, onError: opts.onError, signal: opts.signal },
    )
    if (r.error) return { code: 500, message: r.error, data: { code: '' } }
    if (!r.done) return { code: 500, message: '无响应', data: { code: '' } }
    if (r.done.sessionId) aiGenSessionId = r.done.sessionId
    return { code: 0, message: 'ok', data: { code: r.done.code ?? '' } }
  },
  // AI 设计（自然语言 → 大屏 Schema）：多智能体事件（intent/schema/review/data）逐块回调
  aiDesign: async (
    prompt: string,
    opts: {
      modelId?: string
      botId?: string
      model?: string
      provider?: string
      baseURL?: string
      apiKey?: string
      /** 数据集语义绑定（推荐）：AI 感知数据集字段语义并自动匹配 */
      datasetId?: string
      dataSourceId?: string
      /** 基于已有 schema 迭代修改（传入上一版本的 schema，AI 在此基础上调整） */
      baseSchema?: AIDesignSchema
      onDelta?: (text: string) => void
      onIntent?: (intent: AIDesignIntent) => void
      onSchema?: (schema: AIDesignSchema) => void
      onReview?: (review: AIDesignReview) => void
      onData?: (data: AIDesignData) => void
      onError?: (msg: string) => void
      signal?: AbortSignal
    } = {},
  ) => {
    const r = await postSSE(
      '/api/ai/design',
      {
        message: prompt,
        modelId: opts.modelId,
        botId: opts.botId,
        model: opts.model,
        provider: opts.provider,
        baseURL: opts.baseURL,
        apiKey: opts.apiKey,
        datasetId: opts.datasetId,
        dataSourceId: opts.dataSourceId,
        baseSchema: opts.baseSchema,
      },
      {
        onDelta: opts.onDelta,
        onIntent: opts.onIntent,
        onSchema: opts.onSchema,
        onReview: opts.onReview,
        onData: opts.onData,
        onError: opts.onError,
        signal: opts.signal,
      },
    )
    if (r.error) return { code: 500, message: r.error, data: { schema: null } }
    if (!r.done) return { code: 500, message: '无响应', data: { schema: null } }
    return { code: 0, message: 'ok', data: { schema: null } }
  },

  // —— 数字孪生 ——
  listTwinModels: (q: PageQuery = {}) => mockFetch<PageResult<TwinModelDTO>>('GET', '/api/twinModels', { query: q }),
  createTwinModel: (body: Partial<TwinModelDTO>) => mockFetch<TwinModelDTO>('POST', '/api/twinModels', { body }),
  updateTwinModel: (id: string, body: Partial<TwinModelDTO>) =>
    mockFetch<TwinModelDTO>('PATCH', `/api/twinModels/${id}`, { body }),
  uploadTwinModelFile: (id: string, file: File, onProgress?: (percent: number) => void) => {
    const fd = new FormData()
    fd.append('file', file)
    const token = getToken()
    return apiClient
      .post<TwinModelDTO>(`/twinModels/${id}/file`, fd, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        onUploadProgress: (e) => {
          if (e.total && onProgress) {
            onProgress(Math.round((e.loaded / e.total) * 100))
          }
        },
      })
      .then((res) => {
        const data = res.data
        if (data && typeof data === 'object' && 'code' in data) {
          const json = data as unknown as ApiResp<TwinModelDTO>
          if (json.code === 401 || json.code === 403) forceLogin()
          return json
        }
        return { code: 0, data: data as TwinModelDTO, message: 'ok' }
      })
      .catch((e: { response?: { status?: number; data?: ApiResp<TwinModelDTO> } }) => {
        const status = e.response?.status
        const json = e.response?.data
        if (status === 401 || status === 403 || json?.code === 401 || json?.code === 403) forceLogin()
        if (json && typeof json.code === 'number') return json
        return {
          code: status ?? -1,
          message: status ? '上传失败' : '网络错误，上传失败',
          data: null as unknown as TwinModelDTO,
        }
      })
  },
  deleteTwinModel: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/twinModels/${id}`),
  listTwinScenes: (q: PageQuery = {}) => mockFetch<PageResult<TwinSceneDTO>>('GET', '/api/twinScenes', { query: q }),
  getTwinScene: (id: string) => mockFetch<TwinSceneDTO>('GET', `/api/twinScenes/${id}`),
  saveTwinScene: (body: Partial<TwinSceneDTO>) =>
    mockFetch<TwinSceneDTO>(body.id ? 'PATCH' : 'POST', `/api/twinScenes${body.id ? '/' + body.id : ''}`, { body }),
  deleteTwinScene: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/twinScenes/${id}`),
  lockTwinScene: (id: string) => mockFetch<TwinEditLock>('POST', `/api/twinScenes/${id}/lock`, {}),
  unlockTwinScene: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/twinScenes/${id}/lock`),

  // —— 物联组态 ——
  listIoTDevices: (q: PageQuery = {}) => mockFetch<PageResult<IoTDeviceDTO>>('GET', '/api/iotDevices', { query: q }),
  getIoTDevice: (id: string) => mockFetch<IoTDeviceDTO | null>('GET', `/api/iotDevices/${id}`),
  saveIoTDevice: (body: Partial<IoTDeviceDTO>) =>
    mockFetch<IoTDeviceDTO>(body.id ? 'PATCH' : 'POST', `/api/iotDevices${body.id ? '/' + body.id : ''}`, { body }),
  deleteIoTDevice: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/iotDevices/${id}`),
  listIoTAlarms: (q: PageQuery = {}) => mockFetch<PageResult<IoTAlarmRuleDTO>>('GET', '/api/iotAlarms', { query: q }),
  saveIoTAlarm: (body: Partial<IoTAlarmRuleDTO>) =>
    mockFetch<IoTAlarmRuleDTO>(body.id ? 'PATCH' : 'POST', `/api/iotAlarms${body.id ? '/' + body.id : ''}`, { body }),
  deleteIoTAlarm: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/iotAlarms/${id}`),

  // —— 填报 / 工作流 / 轮播 / 插件 ——
  listDataEntries: (q: PageQuery = {}) => mockFetch<PageResult<DataEntryDTO>>('GET', '/api/dataEntries', { query: q }),
  listWorkflows: (q: PageQuery = {}) => mockFetch<PageResult<WorkflowDTO>>('GET', '/api/workflows', { query: q }),
  listCarousels: (q: PageQuery = {}) => mockFetch<PageResult<CarouselDTO>>('GET', '/api/carousels', { query: q }),
  saveCarousel: (body: Partial<CarouselDTO>) =>
    mockFetch<CarouselDTO>(body.id ? 'PATCH' : 'POST', `/api/carousels${body.id ? '/' + body.id : ''}`, { body }),
  deleteCarousel: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/carousels/${id}`),
  listPlugins: (q: PageQuery = {}) => mockFetch<PageResult<PluginDTO>>('GET', '/api/plugins', { query: q }),
  togglePlugin: (id: string, installed: boolean) => mockFetch<PluginDTO>('PATCH', `/api/plugins/${id}`, { body: { installed } }),

  // —— 独立部署（企业级）：环境 / 部署包 / 部署记录 ——
  listDeployEnvs: (q: PageQuery = {}) => mockFetch<PageResult<DeployEnvDTO>>('GET', '/api/deployEnvs', { query: q }),
  saveDeployEnv: (body: Partial<DeployEnvDTO>) =>
    mockFetch<DeployEnvDTO>(body.id ? 'PATCH' : 'POST', `/api/deployEnvs${body.id ? '/' + body.id : ''}`, { body }),
  deleteDeployEnv: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/deployEnvs/${id}`),

  listDeployPackages: (q: PageQuery = {}) => mockFetch<PageResult<DeployPackageDTO>>('GET', '/api/deployPackages', { query: q }),
  saveDeployPackage: (body: Partial<DeployPackageDTO>) =>
    mockFetch<DeployPackageDTO>(body.id ? 'PATCH' : 'POST', `/api/deployPackages${body.id ? '/' + body.id : ''}`, { body }),
  deleteDeployPackage: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/deployPackages/${id}`),

  listDeployRecords: (q: PageQuery = {}) => mockFetch<PageResult<DeployRecordDTO>>('GET', '/api/deployRecords', { query: q }),
  saveDeployRecord: (body: Partial<DeployRecordDTO>) =>
    mockFetch<DeployRecordDTO>(body.id ? 'PATCH' : 'POST', `/api/deployRecords${body.id ? '/' + body.id : ''}`, { body }),
  deleteDeployRecord: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/deployRecords/${id}`),

  // —— 组件中心：组件生命周期 / 版本 / 统计 ——
  saveWidget: (body: Partial<WidgetDefDTO>) =>
    mockFetch<WidgetDefDTO>(body.type ? 'PATCH' : 'POST', `/api/widgets${body.type ? '/' + body.type : ''}`, { body }),
  deleteWidget: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/widgets/${id}`),
  getWidgetStats: () => mockFetch<WidgetStatsDTO>('GET', '/api/widgets/stats'),
  getWidgetVersions: (id: string) => mockFetch<WidgetVersionDTO[]>('GET', `/api/widgets/${id}/versions`),
  publishWidgetVersion: (id: string, body: { version: string; changelog: string }) =>
    mockFetch<WidgetVersionDTO>('POST', `/api/widgets/${id}/versions`, { body }),
  setWidgetLifecycle: (id: string, status: WidgetLifecycleStatus) =>
    mockFetch<{ status: WidgetLifecycleStatus }>('POST', `/api/widgets/${id}/lifecycle`, { body: { status } }),

  // —— AI 智能：预测 / 推荐 / 分析 ——
  aiPredict: (body: { series: number[]; steps: number }) =>
    mockFetch<AIPredictResultDTO>('POST', '/api/ai/predict', { body }),
  aiRecommend: (body: { scene: string }) =>
    mockFetch<AIRecommendResultDTO>('POST', '/api/ai/recommend', { body }),
  aiAnalyze: (body: { data: unknown }) =>
    mockFetch<AIAnalyzeResultDTO>('POST', '/api/ai/analyze', { body }),

  // —— 开发工具：代码生成 / 环境 ——
  codegen: (body: { schema: unknown; target: string }) =>
    mockFetch<CodeGenResultDTO>('POST', '/api/dev/codegen', { body }),
  getDevEnv: () => mockFetch<DevEnvDTO>('GET', '/api/dev/env'),

  // —— 资源：统计 / 引用关系 ——
  getAssetStats: () => mockFetch<AssetStatsDTO>('GET', '/api/assets/stats'),
  getAssetReferences: (id: string) => mockFetch<AssetRefDTO>('GET', `/api/assets/${id}/references`),

  // —— 系统：日志 / 指标 / 组织 / 参数 / 告警规则 ——
  getSystemLogs: (q: PageQuery = {}) => mockFetch<PageResult<AuditLogDTO>>('GET', '/api/system/logs', { query: q }),
  getSystemMetrics: () => mockFetch<SystemMetricsDTO>('GET', '/api/system/metrics'),
  listOrgs: (q: PageQuery = {}) => mockFetch<PageResult<OrgDTO>>('GET', '/api/orgs', { query: q }),
  saveOrg: (body: Partial<OrgDTO>) =>
    mockFetch<OrgDTO>(body.id ? 'PATCH' : 'POST', `/api/orgs${body.id ? '/' + body.id : ''}`, { body }),
  deleteOrg: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/orgs/${id}`),
  getSystemParams: () => mockFetch<SysParamDTO[]>('GET', '/api/system/params'),
  patchSystemParam: (key: string, value: string) =>
    mockFetch<SysParamDTO>('PATCH', '/api/system/params', { body: { key, value } }),
  listAlertRules: (q: PageQuery = {}) => mockFetch<PageResult<AlertRuleDTO>>('GET', '/api/alertRules', { query: q }),
  saveAlertRule: (body: Partial<AlertRuleDTO>) =>
    mockFetch<AlertRuleDTO>(body.id ? 'PATCH' : 'POST', `/api/alertRules${body.id ? '/' + body.id : ''}`, { body }),
  deleteAlertRule: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/alertRules/${id}`),

  // —— 插件：生命周期 / 依赖 ——
  pluginAction: (id: string, action: 'install' | 'uninstall' | 'enable' | 'disable' | 'update') =>
    mockFetch<PluginDTO>('POST', `/api/plugins/${id}/${action}`),
  getPluginDeps: (id: string) => mockFetch<{ deps: string[] }>('GET', `/api/plugins/${id}/deps`),

  // —— 通知 / 消息 ——
  listNotifications: (q: PageQuery = {}) => mockFetch<PageResult<NotificationDTO>>('GET', '/api/notifications', { query: q }),
  sendNotification: (body: { title: string; content: string; level: NotificationLevel }) =>
    mockFetch<NotificationDTO>('POST', '/api/notifications', { body }),
  readNotification: (id: string) => mockFetch<{ ok: boolean }>('POST', `/api/notifications/${id}/read`),
  readAllNotifications: () => mockFetch<{ ok: boolean }>('POST', '/api/notifications/readAll'),

  // —— 调度任务 ——
  listSchedulerJobs: (q: PageQuery = {}) => mockFetch<PageResult<SchedulerJobDTO>>('GET', '/api/schedulerJobs', { query: q }),
  saveSchedulerJob: (body: Partial<SchedulerJobDTO>) =>
    mockFetch<SchedulerJobDTO>(body.id ? 'PATCH' : 'POST', `/api/schedulerJobs${body.id ? '/' + body.id : ''}`, { body }),
  deleteSchedulerJob: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/schedulerJobs/${id}`),
  runSchedulerJob: (id: string) => mockFetch<SchedulerJobDTO>('POST', `/api/schedulerJobs/${id}/run`),

  // —— 数据同步任务 ——
  listSyncTasks: (q: PageQuery = {}) => mockFetch<PageResult<SyncTaskDTO>>('GET', '/api/syncTasks', { query: q }),
  saveSyncTask: (body: Partial<SyncTaskDTO>) =>
    mockFetch<SyncTaskDTO>(body.id ? 'PATCH' : 'POST', `/api/syncTasks${body.id ? '/' + body.id : ''}`, { body }),
  deleteSyncTask: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/syncTasks/${id}`),
  runSyncTask: (id: string) => mockFetch<SyncTaskDTO>('POST', `/api/syncTasks/${id}/run`),

  // —— 开放能力注册表 ——
  getOpenCapabilities: () => mockFetch<CapabilityRegistryDTO>('GET', '/api/open/capabilities')
}

export type { RequestOptions }
