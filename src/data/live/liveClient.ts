// ============================================================
// 实时数据客户端：优先连接后端代理（server/proxy-server.mjs），
// 连接失败时自动降级为本地模拟推送，保证画布组件始终有数据。
//
// 真实链路：浏览器 --WebSocket--> 代理服务 --driver--> SQL/MQTT/WS 源
// ============================================================

export interface LivePoint {
  name: string
  value: number
}
export type LiveCallback = (data: LivePoint[], meta: { transport: 'proxy' | 'mock'; ts: number }) => void

import { getToken } from '../../auth/store'
import { forceLogin } from '../../auth/session'
import axios, { AxiosError } from 'axios'

// 默认同源走 Vite 代理；局域网设备访问时无需依赖设备自身的 localhost。
const PROXY_HTTP = (import.meta.env.VITE_PROXY_URL as string | undefined) || ''
const PROXY_WS = PROXY_HTTP ? `${PROXY_HTTP.replace(/^http/, 'ws')}/stream` : '/stream'

/** 代理侧统一 axios 实例 */
const proxyHttp = axios.create({ baseURL: PROXY_HTTP })

function authHeaders(): Record<string, string> {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}` } : {}
}

/** 代理侧登录态失效：清空本地会话并回到登录页，避免继续携带过期 token */
function handleAuthFailure(message: string): never {
  forceLogin()
  throw new Error(message)
}

interface Sub {
  sourceId: string
  cb: LiveCallback
  timer?: ReturnType<typeof setInterval>
}

const subs = new Set<Sub>()
let ws: WebSocket | null = null
let wsReady = false
let wsTried = false

/** 本地模拟推送（代理不可用时的降级方案） */
function startMock(sub: Sub, intervalMs: number) {
  const base = 100 + Math.random() * 200
  const names = ['节点A', '节点B', '节点C', '节点D', '节点E']
  const tick = () => {
    const data = names.map((name, i) => ({
      name,
      value: Math.round(base + Math.sin(Date.now() / 1500 + i) * 60 + Math.random() * 30)
    }))
    sub.cb(data, { transport: 'mock', ts: Date.now() })
  }
  tick()
  sub.timer = setInterval(tick, intervalMs)
}

function ensureWs() {
  if (wsTried) return
  wsTried = true
  try {
    const token = getToken()
    ws = new WebSocket(`${PROXY_WS}?token=${encodeURIComponent(token || '')}`)
    ws.onopen = () => {
      wsReady = true
      // 把现有订阅切换到代理：先停掉 mock 定时器再注册
      subs.forEach((s) => {
        if (s.timer) { clearInterval(s.timer); s.timer = undefined }
        ws?.send(JSON.stringify({ op: 'sub', sourceId: s.sourceId }))
      })
    }
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data as string) as { sourceId: string; data: LivePoint[]; ts: number }
        subs.forEach((s) => {
          if (s.sourceId === msg.sourceId) s.cb(msg.data, { transport: 'proxy', ts: msg.ts })
        })
      } catch { /* 忽略坏包 */ }
    }
    ws.onerror = () => { wsReady = false }
    ws.onclose = () => {
      wsReady = false
      ws = null
      // 连接断开：所有订阅回退 mock
      subs.forEach((s) => { if (!s.timer) startMock(s, 2000) })
      // 30s 后允许重试
      setTimeout(() => { wsTried = false }, 30000)
    }
  } catch {
    wsReady = false
  }
}

/** 订阅一个实时数据源；返回取消函数 */
export function subscribeLive(sourceId: string, cb: LiveCallback, intervalMs = 2000): () => void {
  const sub: Sub = { sourceId, cb }
  subs.add(sub)
  ensureWs()
  if (wsReady && ws) {
    ws.send(JSON.stringify({ op: 'sub', sourceId }))
  } else {
    // 代理未就绪：先用 mock 推送，onopen 时会自动切换
    startMock(sub, intervalMs)
  }
  return () => {
    subs.delete(sub)
    if (sub.timer) clearInterval(sub.timer)
    if (wsReady && ws) ws.send(JSON.stringify({ op: 'unsub', sourceId }))
  }
}

/** 通过代理执行一次 SQL 查询（真实链路，代理不可用时抛错由调用方降级） */
export async function querySqlViaProxy(payload: { dsType: string; endpoint: string; sql: string; simulate?: boolean }): Promise<{ columns: string[]; rows: Array<Record<string, unknown> | unknown[]>; elapsedMs: number; simulated?: boolean }> {
  const json = await proxyHttp
    .post<{ code: number; message: string; data: { columns: string[]; rows: unknown[][]; elapsedMs: number; simulated?: boolean } }>(
      '/proxy/sql',
      payload,
      { headers: authHeaders() },
    )
    .then((res) => res.data)
    .catch((e: AxiosError<{ code: number; message: string }>) => {
      const status = e.response?.status
      if (status === 401 || status === 403) handleAuthFailure(e.response?.data?.message || `登录态无效，请重新登录`)
      if (e.response) throw new Error(e.response.data?.message || `proxy ${status}`)
      throw e
    })
  if (json.code !== 0) throw new Error(json.message || `proxy ${json.code}`)
  return json.data
}

/** 通过代理订阅 MQTT 主题（一次性拉取代理侧缓存的最近消息） */
export async function queryMqttViaProxy(topic: string): Promise<{ topic: string; messages: { ts: number; payload: unknown }[] }> {
  const json = await proxyHttp
    .get<{ code: number; message: string; data: { topic: string; messages: { ts: number; payload: unknown }[] } }>(
      '/proxy/mqtt',
      { params: { topic }, headers: authHeaders() },
    )
    .then((res) => res.data)
    .catch((e: AxiosError<{ code: number; message: string }>) => {
      const status = e.response?.status
      if (status === 401 || status === 403) handleAuthFailure(e.response?.data?.message || `登录态无效，请重新登录`)
      if (e.response) throw new Error(e.response.data?.message || `proxy ${status}`)
      throw e
    })
  if (json.code !== 0) throw new Error(json.message || `proxy ${json.code}`)
  return json.data
}

/** 检查代理是否在线 */
export async function proxyHealth(): Promise<boolean> {
  try {
    const res = await proxyHttp.get('/health', { timeout: 1500 })
    return res.status >= 200 && res.status < 300
  } catch {
    return false
  }
}
