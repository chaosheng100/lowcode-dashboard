import { request } from './client'
import type {
  AnalyticsDTO,
  AssetDTO,
  CodeSnippetDTO,
  ComponentMetaDTO,
  GlobalVarDTO,
  MapResourceDTO,
  PageQuery,
  PageResult,
  RbacUserDTO,
  ThemeDTO,
  WidgetDefDTO,
} from '../mock/types'

export interface GovernanceTag {
  id: string
  name: string
  resourceType: string
  aliases: string[]
  color: string
  description?: string | null
  count: number
}

export interface GovernanceTaxonomy {
  id: string
  name: string
  resourceType: string
  parentId?: string | null
  sortOrder: number
  color: string
  status: string
}

export interface GovernanceMenuItem {
  id: string
  componentType: string
  groupName?: string | null
  sortOrder: number
  visible: boolean
  component?: ComponentMetaDTO | null
  meta?: ComponentMetaDTO | null
}

export interface GovernanceMenu {
  id: string
  name: string
  projectId?: string | null
  items: GovernanceMenuItem[]
}

export interface RuntimeEnvironmentDTO {
  id: string
  name: string
  kind: string
  baseUrl: string
  isDefault: boolean
  status: string
}

export interface RuntimeProfileDTO {
  id: string
  environmentId: string
  name: string
  config: Record<string, unknown> | string
  status: string
  currentVersion: number
}

export interface InstalledPluginDTO {
  id: string
  packageId: string
  versionId: string
  status: string
  config: Record<string, unknown>
  package?: { id: string; code: string; name: string; type: string; description?: string | null }
  version?: string
}

export interface MarketPluginDTO {
  id: string
  code: string
  name: string
  type: string
  description?: string | null
  status: string
  latestVersion?: { version: string; manifest: Record<string, unknown> }
}

const page = <T>(path: string, query?: PageQuery) => request<PageResult<T>>(path, { query: query as Record<string, unknown> | undefined })

export const governanceApi = {
  listTags: (query: PageQuery & { resourceType?: string } = {}) => page<GovernanceTag>('/resource-tags', query),
  saveTag: (body: Partial<GovernanceTag> & { workspaceId?: string }) => request<GovernanceTag>(body.id ? `/resource-tags/${body.id}` : '/resource-tags', { method: body.id ? 'PATCH' : 'POST', body }),
  deleteTag: (id: string) => request<{ ok: boolean }>(`/resource-tags/${id}`, { method: 'DELETE' }),
  mergeTag: (id: string, targetTagId: string) => request<{ ok: boolean }>(`/resource-tags/${id}/merge`, { method: 'POST', body: { targetTagId } }),
  listTagStats: (query?: { workspaceId?: string }) => request<GovernanceTag[]>('/resource-tags/stats', { query }),
  bindTags: (body: { tagIds: string[]; resourceType: string; resourceId: string }) => request<{ ok: boolean }>('/resource-tag-bindings', { method: 'POST', body }),
  listTaxonomies: (query?: { resourceType?: string }) => request<GovernanceTaxonomy[]>('/taxonomies', { query }),
  saveTaxonomy: (body: Partial<GovernanceTaxonomy>) => request<GovernanceTaxonomy>(body.id ? `/taxonomies/${body.id}` : '/taxonomies', { method: body.id ? 'PATCH' : 'POST', body }),
  deleteTaxonomy: (id: string) => request<{ ok: boolean }>(`/taxonomies/${id}`, { method: 'DELETE' }),

  listMenus: (query: { projectId?: string; workspaceId?: string } = {}) => request<GovernanceMenu[]>('/component-menus', { query }),
  getMenu: (id = 'default', query?: { projectId?: string; workspaceId?: string }) => request<GovernanceMenu>(`/component-menus/${id}`, { query }),
  listAvailableComponents: (query: { projectId?: string; workspaceId?: string } = {}) => request<GovernanceMenuItem[]>('/component-menus/available', { query }),
  reorderMenu: (id: string, items: Array<Pick<GovernanceMenuItem, 'id' | 'groupName' | 'visible'>>) => request<GovernanceMenu>(`/component-menus/${id}/items/reorder`, { method: 'POST', body: { items } }),

  listVariables: (query: PageQuery = {}) => page<GlobalVarDTO>('/global-variables', query),
  saveVariable: (body: Record<string, unknown>) => request<GlobalVarDTO>(body.id ? `/global-variables/${body.id}` : '/global-variables', { method: body.id ? 'PATCH' : 'POST', body }),
  deleteVariable: (id: string) => request<{ ok: boolean }>(`/global-variables/${id}`, { method: 'DELETE' }),
  publishVariable: (id: string) => request<GlobalVarDTO>(`/global-variables/${id}/publish`, { method: 'POST' }),
  validateVariable: (id: string) => request<{ ok: boolean; errors: string[] }>(`/global-variables/${id}/validate`, { method: 'POST' }),
  variableVersions: (id: string) => request<unknown[]>(`/global-variables/${id}/versions`),
  variableReferences: (id: string) => request<unknown[]>(`/global-variables/${id}/references`),

  listSnippets: (query: PageQuery = {}) => page<CodeSnippetDTO>('/code-snippets', query),
  saveSnippet: (body: Record<string, unknown>) => request<CodeSnippetDTO>(body.id ? `/code-snippets/${body.id}` : '/code-snippets', { method: body.id ? 'PATCH' : 'POST', body }),
  deleteSnippet: (id: string) => request<{ ok: boolean }>(`/code-snippets/${id}`, { method: 'DELETE' }),
  snippetVersions: (id: string) => request<unknown[]>(`/code-snippets/${id}/versions`),
  testSnippet: (id: string, input?: unknown) => request<unknown>(`/code-snippets/${id}/test`, { method: 'POST', body: { input } }),

  listMaps: (query: PageQuery = {}) => page<MapResourceDTO>('/map-resources', query),
  saveMap: (body: Record<string, unknown>) => request<MapResourceDTO>(body.id ? `/map-resources/${body.id}` : '/map-resources', { method: body.id ? 'PATCH' : 'POST', body }),
  deleteMap: (id: string) => request<{ ok: boolean }>(`/map-resources/${id}`, { method: 'DELETE' }),
  mapHealth: (id: string) => request<{ ok: boolean; status: string; message: string }>(`/map-resources/${id}/health-check`, { method: 'POST' }),

  listEnvironments: (query?: PageQuery) => request<RuntimeEnvironmentDTO[]>('/runtime-environments', { query: query as Record<string, unknown> | undefined }),
  saveEnvironment: (body: Partial<RuntimeEnvironmentDTO>) => request<RuntimeEnvironmentDTO>(body.id ? `/runtime-environments/${body.id}` : '/runtime-environments', { method: body.id ? 'PATCH' : 'POST', body }),
  listProfiles: (query?: PageQuery) => request<RuntimeProfileDTO[]>('/runtime-profiles', { query: query as Record<string, unknown> | undefined }),
  saveProfile: (body: Record<string, unknown>) => request<RuntimeProfileDTO>(body.id ? `/runtime-profiles/${body.id}` : '/runtime-profiles', { method: body.id ? 'PATCH' : 'POST', body }),
  validateProfile: (id: string) => request<{ ok: boolean; errors: string[] }>(`/runtime-profiles/${id}/validate`, { method: 'POST' }),
  preflightProfile: (id: string) => request<unknown>(`/runtime-profiles/${id}/preflight`, { method: 'POST' }),
  publishProfile: (id: string) => request<RuntimeProfileDTO>(`/runtime-profiles/${id}/publish`, { method: 'POST' }),

  listInstalledPlugins: (query: PageQuery = {}) => page<InstalledPluginDTO>('/plugin-installs', query),
  installPlugin: (body: { packageId: string; version?: string; projectId?: string; config?: Record<string, unknown> }) => request<InstalledPluginDTO>('/plugin-installs', { method: 'POST', body }),
  pluginAction: (id: string, action: 'enable' | 'disable' | 'uninstall') => request<InstalledPluginDTO>(`/plugin-installs/${id}/${action}`, { method: 'POST' }),
  listMarketPlugins: (query: PageQuery = {}) => page<MarketPluginDTO>('/market/plugins', query),
  reviewPlugin: (id: string, body: { decision: 'approve' | 'reject' | 'deprecate'; comment?: string }) => request<unknown>(`/market/plugins/${id}/review`, { method: 'POST', body }),
  listPluginRatings: (id: string) => request<unknown[]>(`/market/plugins/${id}/ratings`),
  savePluginRating: (id: string, body: { score: number; comment?: string }) => request<unknown>(`/market/plugins/${id}/ratings`, { method: 'POST', body }),

  listAnalytics: (query: Record<string, unknown> = {}) => request<AnalyticsDTO[]>('/analytics/summary', { query }),
  analyticsTrends: (query: Record<string, unknown> = {}) => request<Array<{ bucket: string; pv: number; uv: number; errorCount: number; errorRate: number; p95Ms: number; avgDurationMs: number; firstPaintMs: number }>>('/analytics/trends', { query }),

  listAssets: (query: PageQuery = {}) => page<AssetDTO>('/assets', query),
  assetStats: () => request<unknown[]>('/assets/stats'),
  assetReferences: (id: string) => request<unknown[]>(`/assets/${id}/references`),
  archiveAsset: (id: string) => request<{ ok: boolean }>(`/assets/${id}`, { method: 'DELETE' }),
  uploadAsset: (file: File, category = 'general') => {
    const body = new FormData()
    body.append('file', file)
    return request<{ id: string; url: string; filename: string; size: number }>(`/assets/upload/${category}`, { method: 'POST', body })
  },

  listUsers: (query: PageQuery = {}) => page<RbacUserDTO>('/rbac/users', query),
  listThemes: () => request<ThemeDTO[]>('/themes'),
  listComponents: () => request<ComponentMetaDTO[]>('/ai/components'),
  listWidgets: (query: PageQuery = {}) => page<WidgetDefDTO>('/widgets', query),
}
