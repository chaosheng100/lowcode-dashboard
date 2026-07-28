// ============================================================
// Mock API 门面 —— 类型化的业务接口集合
// 真实接入后端时，只需把内部 mockFetch 替换为 fetch 即可，调用方无感。
// ============================================================
import { mockFetch, type RequestOptions } from './client'
import type {
  PageQuery,
  PageResult,
  DashboardDTO,
  DataSourceDTO,
  DatasetDTO,
  DatasetRow,
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
  PluginDTO
} from './types'

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

  // 数据集
  listDatasets: (q: PageQuery = {}) => mockFetch<PageResult<DatasetDTO>>('GET', '/api/datasets', { query: q }),
  queryDataset: (id: string, q: PageQuery = {}) =>
    mockFetch<{ list: DatasetRow[]; total: number }>('POST', `/api/datasets/${id}/query`, { query: q }),

  // 用户与角色
  listUsers: (q: PageQuery = {}) => mockFetch<PageResult<UserDTO>>('GET', '/api/users', { query: q }),
  setUserStatus: (id: string, status: 'active' | 'disabled') =>
    mockFetch<UserDTO>('PATCH', `/api/users/${id}/status`, { body: { status } }),
  listRoles: () => mockFetch<RoleDTO[]>('GET', '/api/roles'),

  // 扩展
  listExtensions: () => mockFetch<ExtensionDTO[]>('GET', '/api/extensions/status'),

  // 组件库
  listWidgets: (q: PageQuery = {}) => mockFetch<PageResult<WidgetDefDTO>>('GET', '/api/widgets', { query: q }),

  // 报表
  listReports: (q: PageQuery = {}) => mockFetch<PageResult<ReportDTO>>('GET', '/api/reports', { query: q }),
  saveReport: (body: Partial<ReportDTO>) =>
    mockFetch<ReportDTO>(body.id ? 'PATCH' : 'POST', `/api/reports${body.id ? '/' + body.id : ''}`, { body }),
  deleteReport: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/reports/${id}`),

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
  listAIModels: (q: PageQuery = {}) => mockFetch<PageResult<AIModelDTO>>('GET', '/api/aiModels', { query: q }),
  saveAIModel: (body: Partial<AIModelDTO>) =>
    mockFetch<AIModelDTO>(body.id ? 'PATCH' : 'POST', `/api/aiModels${body.id ? '/' + body.id : ''}`, { body }),
  deleteAIModel: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/aiModels/${id}`),
  listAIBots: (q: PageQuery = {}) => mockFetch<PageResult<AIBotDTO>>('GET', '/api/aiBots', { query: q }),
  saveAIBot: (body: Partial<AIBotDTO>) =>
    mockFetch<AIBotDTO>(body.id ? 'PATCH' : 'POST', `/api/aiBots${body.id ? '/' + body.id : ''}`, { body }),
  deleteAIBot: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/aiBots/${id}`),
  // AI 对话 / 代码生成（离线模拟，真实接入后替换 handler 即可）
  aiChat: (message: string) =>
    mockFetch<{ reply: string; suggestion: string }>('POST', '/api/ai/chat', { body: { message } }),
  aiGenerate: (prompt: string, lang: string) =>
    mockFetch<{ code: string }>('POST', '/api/ai/generate', { body: { prompt, lang } }),

  // —— 数字孪生 ——
  listTwinModels: (q: PageQuery = {}) => mockFetch<PageResult<TwinModelDTO>>('GET', '/api/twinModels', { query: q }),
  listTwinScenes: (q: PageQuery = {}) => mockFetch<PageResult<TwinSceneDTO>>('GET', '/api/twinScenes', { query: q }),
  saveTwinScene: (body: Partial<TwinSceneDTO>) =>
    mockFetch<TwinSceneDTO>(body.id ? 'PATCH' : 'POST', `/api/twinScenes${body.id ? '/' + body.id : ''}`, { body }),
  deleteTwinScene: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/twinScenes/${id}`),

  // —— 物联组态 ——
  listIoTDevices: (q: PageQuery = {}) => mockFetch<PageResult<IoTDeviceDTO>>('GET', '/api/iotDevices', { query: q }),
  saveIoTDevice: (body: Partial<IoTDeviceDTO>) =>
    mockFetch<IoTDeviceDTO>(body.id ? 'PATCH' : 'POST', `/api/iotDevices${body.id ? '/' + body.id : ''}`, { body }),
  deleteIoTDevice: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/iotDevices/${id}`),
  listIoTAlarms: (q: PageQuery = {}) => mockFetch<PageResult<IoTAlarmRuleDTO>>('GET', '/api/iotAlarms', { query: q }),

  // —— 填报 / 工作流 / 轮播 / 插件 ——
  listDataEntries: (q: PageQuery = {}) => mockFetch<PageResult<DataEntryDTO>>('GET', '/api/dataEntries', { query: q }),
  listWorkflows: (q: PageQuery = {}) => mockFetch<PageResult<WorkflowDTO>>('GET', '/api/workflows', { query: q }),
  listCarousels: (q: PageQuery = {}) => mockFetch<PageResult<CarouselDTO>>('GET', '/api/carousels', { query: q }),
  saveCarousel: (body: Partial<CarouselDTO>) =>
    mockFetch<CarouselDTO>(body.id ? 'PATCH' : 'POST', `/api/carousels${body.id ? '/' + body.id : ''}`, { body }),
  deleteCarousel: (id: string) => mockFetch<{ ok: boolean }>('DELETE', `/api/carousels/${id}`),
  listPlugins: (q: PageQuery = {}) => mockFetch<PageResult<PluginDTO>>('GET', '/api/plugins', { query: q }),
  togglePlugin: (id: string, installed: boolean) => mockFetch<PluginDTO>('PATCH', `/api/plugins/${id}`, { body: { installed } })
}

export type { RequestOptions }
