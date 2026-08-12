// ============================================================
// 统一请求适配层（真实后端版）
// - 原 mock 模拟实现（seed / handlers / 人工延迟 / 错误注入）已全部移除。
// - 现统一转发到真实后端：复用 src/api/client 的 request()，调用方（mock/api.ts
//   的 api 对象、MockDemo 等）无需任何改动，即由「本地模拟」切换为「真实后端」。
// - 后端地址：import.meta.env.VITE_API_BASE_URL || /api（同源，由 Vite 代理转发）
// - 注意：mockFetch 的 path 形如 /api/screens（带前缀），而 request 的 BASE_URL 已含
//   /api，故此处剥掉 /api 前缀再交给 request，避免拼成 /api/api/... 双前缀。
// ============================================================
import type { ApiResp } from './types'
import { request } from '../api/client'

export interface RequestOptions {
  query?: Record<string, any>
  body?: unknown
  delay?: number
  skipAuth?: boolean
}

export async function mockFetch<T>(method: string, path: string, opts: RequestOptions = {}): Promise<ApiResp<T>> {
  const cleanPath = path.replace(/^\/api/, '').replace(/\/{2,}/g, '/')
  return request<T>(cleanPath, {
    method: method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    query: opts.query,
    body: opts.body,
    skipAuth: opts.skipAuth,
  })
}
