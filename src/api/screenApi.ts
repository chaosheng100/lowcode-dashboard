// ============================================================
// 大屏相关 API
// ============================================================
import { http } from './client'

export interface ScreenItem {
  id: string
  projectId: string
  name: string
  description?: string | null
  status: 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'PUBLISHED'
  config: ScreenConfig
  currentVersion: number
  publishedVersion?: number | null
  createdAt: string
  updatedAt: string
}

/** 与后端 config 字段对齐：page + components（前端 routes[0] 结构映射过来） */
export interface ScreenConfig {
  page: { width: number; height: number; background?: string }
  components: unknown[]
}

export interface ScreenVersion {
  id: string
  version: number
  publishedAt?: string | null
  publisherId?: string | null
  createdAt: string
}

export interface ScreenApproval {
  id: string
  screenId: string
  projectId: string
  status: 'pending' | 'approved' | 'rejected' | 'published'
  note?: string
  comment?: string
  requesterId?: string
  reviewerId?: string
  requestedAt: string
  reviewedAt?: string
  configHash: string
  targetVersion: number
  publishedVersion?: number
  publishedAt?: string
}

export interface ApprovalPolicy {
  id: string
  name: string
  scope: 'default' | 'project' | 'screen'
  refId?: string | null
  required: boolean
  reviewers?: string[]
}

export interface DeployEnvironment {
  id: string
  name: string
  kind?: string
  baseUrl?: string
  targetUrl?: string
  code?: string
  url?: string
  previewUrl?: string
  description?: string
}

export interface DeployRecord {
  id: string
  screenId: string
  screenName: string
  version: number
  environmentId: string
  environmentName: string
  targetUrl: string
  artifactUrl: string
  operatorId?: string | null
  status: string
  deployedAt: string
  log: string[]
}

export interface EmbedTokenResult {
  token: string
  screenId: string
  expiresInSec: number
  embedUrl: string
  sdkUrl: string
}

export interface GitSyncConfig {
  id: string
  name: string
  remoteUrl: string
  branch?: string
  autoPush?: boolean
  token?: string
}

export interface GitSyncRecord {
  id: string
  name: string
  configId: string
  status: string
  commitHash?: string | null
  files?: number
  message?: string
  startedAt: string
  finishedAt: string
}

export interface PageResult<T> {
  list: T[]
  total: number
  page: number
  pageSize: number
}

const cleanId = (id: string) => encodeURIComponent(id.replace(/^\/+|\/+$/g, ''))

export const screenApi = {
  /** 创建大屏 */
  create(projectId: string, name: string, description?: string) {
    return http.post<ScreenItem>('/screens', { projectId, name, description })
  },

  /** 大屏列表 */
  list(projectId?: string) {
    return http.get<ScreenItem[]>('/screens', projectId ? { projectId } : undefined)
  },

  /** 获取大屏详情 */
  detail(id: string) {
    return http.get<ScreenItem>(`/screens/${cleanId(id)}`)
  },

  /** 更新大屏元信息：名称/描述 */
  update(id: string, body: { name?: string; description?: string }) {
    return http.patch<ScreenItem>(`/screens/${cleanId(id)}`, body)
  },

  /** 保存草稿 */
  save(id: string, config: ScreenConfig) {
    return http.put<ScreenItem>(`/screens/${cleanId(id)}/save`, { config })
  },

  /** 发布 */
  publish(id: string) {
    return http.post<ScreenItem>(`/screens/${cleanId(id)}/publish`)
  },

  /** 提交审核 */
  submitReview(id: string, note?: string) {
    return http.post<ScreenItem>(`/screens/${cleanId(id)}/submit-review`, note ? { note } : undefined)
  },

  /** 审核：通过或驳回 */
  review(id: string, approved: boolean, comment?: string) {
    return http.post<ScreenItem>(`/screens/${cleanId(id)}/review`, { approved, comment })
  },

  /** 审批记录 */
  approvals(id: string) {
    return http.get<ScreenApproval[]>(`/screens/${cleanId(id)}/approvals`)
  },

  /** 多环境部署 */
  deploy(id: string, environmentId: string, version?: number) {
    return http.post<DeployRecord>(`/screens/${cleanId(id)}/deploy`, { environmentId, version })
  },

  /** 大屏部署记录 */
  deployRecords(id: string) {
    return http.get<DeployRecord[]>(`/screens/${cleanId(id)}/deploy-records`)
  },

  /** 生成嵌入令牌 */
  createEmbedToken(screenId: string, options?: { expiresInSec?: number; allowedOrigins?: string[]; baseUrl?: string }) {
    return http.post<EmbedTokenResult>('/embed/tokens', { screenId: cleanId(screenId), ...options })
  },

  /** 审批策略 */
  approvalPolicies() {
    return http.get<PageResult<ApprovalPolicy>>('/governance/approval-policies')
  },
  saveApprovalPolicy(dto: Pick<ApprovalPolicy, 'scope' | 'refId' | 'required' | 'reviewers'>) {
    return http.post<ApprovalPolicy>('/governance/approval-policies', dto)
  },
  removeApprovalPolicy(refId: string) {
    return http.del<{ ok: boolean }>(`/governance/approval-policies/${encodeURIComponent(refId)}`)
  },

  /** 部署环境 */
  deployEnvs() {
    return http.get<PageResult<DeployEnvironment>>('/deployEnvs')
  },
  deployRecordsAll() {
    return http.get<PageResult<DeployRecord>>('/deployRecords')
  },

  /** Git 同步 */
  gitSyncConfigs() {
    return http.get<PageResult<GitSyncConfig>>('/git-sync/configs')
  },
  saveGitSyncConfig(body: Partial<GitSyncConfig> & { remoteUrl: string }) {
    return http.post<GitSyncConfig>('/git-sync/configs', body)
  },
  deleteGitSyncConfig(id: string) {
    return http.del<{ ok: boolean }>(`/git-sync/configs/${cleanId(id)}`)
  },
  testGitSyncConfig(id: string) {
    return http.post<{ ok: boolean; branch: string; remoteUrl: string; output: string }>(`/git-sync/configs/${cleanId(id)}/test`)
  },
  gitSyncRecords() {
    return http.get<PageResult<GitSyncRecord>>('/git-sync/records')
  },
  runGitSync(body?: { configId?: string; resourceTypes?: string[]; resourceId?: string; commitMessage?: string; autoPush?: boolean }) {
    return http.post<{ ok: boolean; files: number; commitHash?: string | null; pushed: boolean; message: string }>('/git-sync/run', body)
  },

  /** 回滚到指定版本 */
  rollback(id: string, version: number) {
    return http.post<ScreenItem>(`/screens/${cleanId(id)}/rollback`, { version })
  },

  /** 版本列表 */
  versions(id: string) {
    return http.get<ScreenVersion[]>(`/screens/${cleanId(id)}/versions`)
  },

  /** 删除 */
  remove(id: string) {
    return http.del<void>(`/screens/${cleanId(id)}`)
  },

  /** 运行时：获取已发布版本 */
  published(id: string) {
    return http.get<ScreenItem & { cached: boolean }>(`/runtime/screens/${cleanId(id)}`)
  },
}
