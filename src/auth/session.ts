import axios, { AxiosError } from 'axios'
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
    const res = await axios.post<{
      code?: number
      data?: { accessToken?: string; refreshToken?: string }
    }>(`${API_BASE_URL}/auth/refresh`, { refreshToken })
    const json = res.data
    if (json.code === 401) {
      forceLogin()
      return false
    }
    const data = json.data ?? null
    if (!data?.accessToken) return false
    useAuthStore.getState().setTokens(data.accessToken, data.refreshToken || refreshToken)
    return true
  } catch (e) {
    const status = (e as AxiosError).response?.status
    const body = (e as AxiosError<{ code?: number }>).response?.data
    if (status === 401 || body?.code === 401) {
      forceLogin()
      return false
    }
    // 网络异常或其它错误时保留会话，等待下一轮重试
    return false
  }
}
