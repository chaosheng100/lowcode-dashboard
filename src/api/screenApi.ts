// ============================================================
// 大屏相关 API
// ============================================================
import { http } from './client'

export interface ScreenItem {
  id: string
  projectId: string
  name: string
  description?: string | null
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED'
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
    return http.get<ScreenItem>(`/screens/${id}`)
  },

  /** 保存草稿 */
  save(id: string, config: ScreenConfig) {
    return http.put<ScreenItem>(`/screens/${id}/save`, { config })
  },

  /** 发布 */
  publish(id: string) {
    return http.post<ScreenItem>(`/screens/${id}/publish`)
  },

  /** 回滚到指定版本 */
  rollback(id: string, version: number) {
    return http.post<ScreenItem>(`/screens/${id}/rollback`, { version })
  },

  /** 版本列表 */
  versions(id: string) {
    return http.get<ScreenVersion[]>(`/screens/${id}/versions`)
  },

  /** 删除 */
  remove(id: string) {
    return http.del<void>(`/screens/${id}`)
  },

  /** 运行时：获取已发布版本 */
  published(id: string) {
    return http.get<ScreenItem & { cached: boolean }>(`/runtime/screens/${id}`)
  },
}
