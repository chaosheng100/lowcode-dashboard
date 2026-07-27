// Mock 模块统一出口
export { api } from './api'
export { mockFetch } from './client'
export * from './types'

// 便于在浏览器控制台联调：window.__mockApi
import { api } from './api'
if (typeof window !== 'undefined') {
  ;(window as unknown as { __mockApi: typeof api }).__mockApi = api
}
