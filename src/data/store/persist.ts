import { useDesignerStore } from './useDesignerStore'
import type { DashboardProject } from '../types'
import { isArray } from '../utils/typeGuards'

/**
 * 实时保存（localStorage 持久化，同源窗口共享）。
 * - 启动 initPersist()：加载已保存项目进 store，并挂防抖自动保存订阅。
 * - 预览窗口调用 setAutosave(false)：关闭回写，避免把本地实时刷新数据覆盖编辑器。
 * - onSaved：供编辑器顶栏显示「已保存」时间。
 */

const KEY = 'lowcode-dashboard:project:v1'
let enabled = true
let initialized = false
let savedListeners: Array<(t: number) => void> = []

/** 预览窗口关闭自动保存，防止本地刷新数据回写覆盖编辑器 */
export function setAutosave(on: boolean): void {
  enabled = on
}

/** 订阅保存事件，返回取消订阅函数 */
export function onSaved(cb: (t: number) => void): () => void {
  savedListeners.push(cb)
  return () => {
    savedListeners = savedListeners.filter((l) => l !== cb)
  }
}

export function loadPersisted(): DashboardProject | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw)
    if (p && isArray(p.routes) && p.routes.length) return p as DashboardProject
  } catch {
    /* 损坏则忽略 */
  }
  return null
}

export function initPersist(): void {
  if (initialized) return
  initialized = true

  const saved = loadPersisted()
  if (saved) useDesignerStore.getState().loadProject(saved)

  let last = JSON.stringify(useDesignerStore.getState().routes)
  let timer: ReturnType<typeof setTimeout> | null = null
  useDesignerStore.subscribe((s) => {
    if (!enabled) return
    const ser = JSON.stringify(s.routes)
    if (ser === last) return
    last = ser
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => {
      try {
        localStorage.setItem(
          KEY,
          JSON.stringify({ version: '1.0', routes: useDesignerStore.getState().routes })
        )
        const now = Date.now()
        savedListeners.forEach((l) => l(now))
      } catch {
        /* 配额超限或隐私模式：静默 */
      }
    }, 300)
  })
}
