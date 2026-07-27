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
  ThemeDTO
} from './types'

export const api = {
  // 大屏管理
  listDashboards: (q: PageQuery = {}) => mockFetch<PageResult<DashboardDTO>>('GET', '/api/dashboards', { query: q }),
  getDashboard: (id: string) => mockFetch<DashboardDTO | null>('GET', `/api/dashboards/${id}`),

  // 数据源
  listDataSources: (q: PageQuery = {}) => mockFetch<PageResult<DataSourceDTO>>('GET', '/api/datasources', { query: q }),
  testDataSource: (id: string) => mockFetch<{ id: string; ok: boolean; latencyMs: number }>('POST', `/api/datasources/${id}/test`),

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

  // 分析
  getAnalytics: (q: Record<string, any> = {}) => mockFetch<AnalyticsDTO[]>('GET', '/api/analytics/summary', { query: q }),

  // 素材（画布资源来源）
  listAssets: (q: PageQuery = {}) => mockFetch<PageResult<AssetDTO>>('GET', '/api/assets', { query: q }),

  // 主题（画布主题来源）
  listThemes: () => mockFetch<ThemeDTO[]>('GET', '/api/themes')
}

export type { RequestOptions }
