// ============================================================
// 真实 API 客户端 —— 与 mockFetch 返回一致的 ApiResp<T> 信封
//
// 设计原则：
// - 统一基于 axios，返回结构与 mock 完全一致 { code, data, message }
// - 401/403 统一拦截
// - 失败时 code 为 HTTP 状态码，message 来自后端
// ============================================================
import axios, { AxiosError } from 'axios'
import type { ApiResp } from '../mock/types'
import { getToken } from '../auth/store'
import { forceLogin } from '../auth/session'
import { API_BASE_URL } from './config'
import { isNumber, isObject } from '../data/utils/typeGuards'

const BASE_URL = API_BASE_URL

/** 统一 axios 实例（业务 API），供 SSE 等场景复用 */
export const apiClient = axios.create({ baseURL: BASE_URL })

interface RequestOptions {
  query?: Record<string, unknown>
  body?: unknown
  headers?: Record<string, string>
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  /** 跳过自动附加 Authorization（如登录接口） */
  skipAuth?: boolean
}

function buildQuery(query?: Record<string, unknown>): string {
  if (!query) return ''
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null) continue
    params.set(k, String(v))
  }
  const qs = params.toString()
  return qs ? `?${qs}` : ''
}

export async function request<T>(path: string, opts: RequestOptions = {}): Promise<ApiResp<T>> {
  const method = opts.method || (opts.body ? 'POST' : 'GET')
  const url = `${path.replace(/\/{2,}/g, '/')}${buildQuery(opts.query)}`

  const isFormData = opts.body instanceof FormData
  const headers: Record<string, string> = { ...(opts.headers || {}) }
  // FormData 由浏览器自动生成 multipart boundary，不能预置 Content-Type
  if (!isFormData) headers['Content-Type'] = 'application/json'
  // 自动附加登录令牌
  if (!opts.skipAuth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  try {
    const res = await apiClient.request<string>({
      url,
      method,
      headers,
      data: isFormData ? (opts.body as FormData) : opts.body ? JSON.stringify(opts.body) : undefined,
      // 与 fetch 语义一致：按 Content-Type 判断是否 JSON.parse，文本响应原样返回
      responseType: 'text',
    })

    const contentType = String(res.headers['content-type'] || '')
    const isJson = contentType.includes('application/json')
    if (isJson) {
      const data = JSON.parse(res.data || 'null')
      // 后端统一包装 { code, data, message }
      if (isObject(data) && 'code' in data) {
        // 401/403：登录态失效，统一清理并回登录页
        if (data.code === 401 || data.code === 403) forceLogin()
        return data as unknown as ApiResp<T>
      }
      // 兼容未包装的响应
      return { code: 0, data, message: 'ok' }
    }
    return { code: 0, data: res.data as unknown as T, message: 'ok' }
  } catch (e) {
    const err = e as AxiosError<string>
    const res = err.response
    if (res) {
      const contentType = (res.headers?.['content-type'] as string | undefined) || ''
      let data: unknown
      if (contentType.includes('application/json')) {
        try {
          data = res.data ? JSON.parse(res.data) : null
        } catch {
          data = null
        }
      }
      if (data && isNumber((data as ApiResp<T>).code)) {
        // 401/403：登录态失效，统一清理并回登录页
        if ((data as ApiResp<T>).code === 401 || (data as ApiResp<T>).code === 403) forceLogin()
        return data as ApiResp<T>
      }
      if (res.status === 401 || res.status === 403) forceLogin()
      return {
        code: res.status,
        message: res.statusText,
        data: null as unknown as T,
      }
    }
    return {
      code: -1,
      message: `网络错误：${(e as Error).message}`,
      data: null as unknown as T,
    }
  }
}

// 便捷方法
export const http = {
  get: <T>(path: string, query?: Record<string, unknown>) => request<T>(path, { method: 'GET', query }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PUT', body }),
  patch: <T>(path: string, body?: unknown) => request<T>(path, { method: 'PATCH', body }),
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
