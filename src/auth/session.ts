import { API_BASE_URL } from '../api/config'
import { getRefreshToken, useAuthStore } from './store'

/** 登录态失效：清空本地会话并回到登录页（HashRouter 用 hash 跳转） */
export function forceLogin() {
  useAuthStore.getState().logout()
  const h = (location.hash || '').replace(/^#/, '')
  if (h !== '/login' && h !== '/register') location.hash = '#/login'
}

/** 用 refreshToken 换一组新令牌；仅 refresh 接口明确返回 401 时才强制重登 */
export async function refreshTokenOnce(): Promise<boolean> {
  const refreshToken = getRefreshToken()
  if (!refreshToken) return false
  try {
    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    })
    let code = res.status
    let data: { accessToken?: string; refreshToken?: string } | null = null
    try {
      const json = (await res.json()) as {
        code?: number
        data?: { accessToken?: string; refreshToken?: string }
      }
      if (typeof json.code === 'number') code = json.code
      data = json.data ?? null
    } catch {
      /* ignore parse errors */
    }
    if (code === 401) {
      forceLogin()
      return false
    }
    if (!res.ok || !data?.accessToken) return false
    useAuthStore.getState().setTokens(data.accessToken, data.refreshToken || refreshToken)
    return true
  } catch {
    // 网络异常时保留会话，等待下一轮重试
    return false
  }
}
