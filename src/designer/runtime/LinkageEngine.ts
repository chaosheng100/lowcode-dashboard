import type { Link, LinkageEvent, LinkTarget } from '../../data/types'

/**
 * 联动引擎（Linkage Engine）
 * 基于「事件总线 + 声明式规则」：
 *   源组件 -> 事件 -> 目标组件 -> 动作
 * 当前运行态采用「全局筛选」实现联动（见 runtime/Renderer）。
 * 下面提供可扩展的规则引擎与事件总线，便于后续替换为设计书中的 links 规则表。
 */

type Listener = (payload: unknown) => void

// 轻量事件总线
export function createEventBus() {
  const listeners = new Map<string, Set<Listener>>()
  return {
    on(type: string, fn: Listener): () => void {
      if (!listeners.has(type)) listeners.set(type, new Set())
      listeners.get(type)!.add(fn)
      return () => listeners.get(type)!.delete(fn)
    },
    emit(type: string, payload: unknown): void {
      ;(listeners.get(type) || []).forEach((fn) => fn(payload))
    }
  }
}

// 根据 links 规则表分发动作：源事件命中 -> 对目标执行动作
// link: { id, source:{componentId,event}, trigger:{payload}, targets:[{componentId,action,params}] }
export function dispatchLinks(links: Link[] = [], event: LinkageEvent): LinkTarget[] {
  return links
    .filter((l) => l.source.componentId === event.componentId && l.source.event === event.type)
    .flatMap((l) =>
      (l.targets || []).map((t) => ({
        componentId: t.componentId,
        action: t.action,
        params: resolveParams(t.params, event.payload)
      }))
    )
}

// 解析模板变量 {{$event.xxx}}
function resolveParams(params: Record<string, unknown> | undefined, payload: unknown = {}): Record<string, unknown> | undefined {
  if (typeof params !== 'object' || params === null) return params
  const p = payload as Record<string, unknown>
  return Object.fromEntries(
    Object.entries(params).map(([k, v]) => {
      if (typeof v === 'string' && v.startsWith('{{$event.')) {
        const key = v.slice(9, -2)
        return [k, p[key]]
      }
      return [k, v]
    })
  )
}
