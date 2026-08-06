import { refreshTokenOnce } from './session'

// access token 有效期为 2 小时，这里每 50 分钟刷新一次
const REFRESH_INTERVAL_MS = 50 * 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null

export function startTokenRefresh() {
  stopTokenRefresh()
  timer = setInterval(() => {
    void refreshTokenOnce()
  }, REFRESH_INTERVAL_MS)
}

export function stopTokenRefresh() {
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
