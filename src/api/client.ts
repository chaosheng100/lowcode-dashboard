// ============================================================
// 真实 API 客户端 —— 与 mockFetch 返回一致的 ApiResp<T> 信封
//
// 设计原则：
// - 返回结构与 mock 完全一致 { code, data, message }
// - 401/403 统一拦截
// - 失败时 code 为 HTTP 状态码，message 来自后端
// ============================================================
import type { ApiResp } from '../mock/types'
import { getToken, clearAuthStorage } from '../auth/store'

const BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000/api'

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
  const url = `${BASE_URL}${path}${buildQuery(opts.query)}`

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
    const res = await fetch(url, {
      method,
      headers,
      body: isFormData ? (opts.body as FormData) : opts.body ? JSON.stringify(opts.body) : undefined,
    })

    const contentType = res.headers.get('content-type') || ''
    const isJson = contentType.includes('application/json')

    if (!res.ok) {
      if (isJson) {
        const data = await res.json()
        // 后端全局异常过滤器也返回 { code, data, message }
        if (data && typeof data.code === 'number') {
          // 401/403：登录态失效，清理并跳登录页（HashRouter 用 hash 跳转）
          if (data.code === 401 || data.code === 403) {
            clearAuthStorage()
            const h = (location.hash || '').replace(/^#/, '')
            if (h !== '/login' && h !== '/register') {
              location.hash = '#/login'
            }
          }
          return data as ApiResp<T>
        }
      }
      return { code: res.status, message: res.statusText, data: null as unknown as T }
    }

    if (!isJson) {
      const text = await res.text()
      return { code: 0, data: text as unknown as T, message: 'ok' }
    }

    const data = await res.json()
    // 后端统一包装 { code, data, message }
    if (data && typeof data === 'object' && 'code' in data) {
      return data as ApiResp<T>
    }
    // 兼容未包装的响应
    return { code: 0, data, message: 'ok' }
  } catch (e) {
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
  del: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
}
