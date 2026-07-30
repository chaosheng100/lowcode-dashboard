import { useReducer, useRef, useEffect, useMemo } from 'react'
import { useLocation } from 'react-router-dom'

interface KeepAliveOutletProps {
  /** 渲染当前路由内容的函数，接收 pathname 作为缓存 key */
  children: (pathname: string) => React.ReactNode
  /** 最大缓存数量，默认 10，超出淘汰最久未访问的 */
  max?: number
  /** 是否启用缓存，默认 true。关闭时每次都重新渲染 */
  enabled?: boolean
}

/**
 * 路由级 keep-alive：按路径缓存页面组件，切走时 display:none 不卸载。
 *
 * 原理：
 * - 首次访问某路径时，将该路径的 React 元素存进 Map 并渲染
 * - 切到其他路径时，旧路径的 DOM 用 display:none 隐藏，组件不卸载
 * - 再切回来时直接显示，状态（表单、滚动、分页等）完全保留
 * - 超出 max 时按 LRU 淘汰最久未访问的页面
 *
 * 用法：
 *   <KeepAliveOutlet>
 *     {(pathname) => <PageContent path={pathname} />}
 *   </KeepAliveOutlet>
 *
 * 注意：children 是 render prop 形式，传入当前 pathname，返回该路径的内容。
 * 组件内部会为每个路径持有一份独立的 React 元素实例。
 */
export default function KeepAliveOutlet({ children, max = 10, enabled = true }: KeepAliveOutletProps) {
  const location = useLocation()
  const pathname = location.pathname

  // 已挂载的缓存：key = pathname, value = { element, lastVisit }
  // 用 ref 持有，避免每次重渲染都重建
  const cacheRef = useRef<Map<string, { node: React.ReactNode; lastVisit: number }>>(new Map())
  // LRU 顺序数组：头部 = 最近访问
  const lruRef = useRef<string[]>([])
  // 触发重渲染的 tick
  const [, tick] = useReducer((x: number) => x + 1, 0)

  useEffect(() => {
    if (!enabled) return
    const key = pathname

    // 更新 LRU 顺序
    const arr = lruRef.current
    const idx = arr.indexOf(key)
    if (idx >= 0) arr.splice(idx, 1)
    arr.unshift(key)

    let evicted = false
    while (arr.length > max) {
      const victim = arr.pop()
      if (victim) {
        cache.delete(victim)
        evicted = true
      }
    }

    if (evicted || idx !== 0) {
      tick()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, max, enabled])

  // 生成或取出当前路径的节点
  const cache = cacheRef.current
  if (enabled) {
    if (!cache.has(pathname)) {
      cache.set(pathname, { node: children(pathname), lastVisit: Date.now() })
    } else {
      cache.get(pathname)!.lastVisit = Date.now()
    }
  }

  const cachedItems = useMemo(() => {
    if (!enabled) return []
    return Array.from(cache.entries()).map(([key, val]) => ({ key, node: val.node }))
    // 依赖 tick 来触发重渲染（淘汰后需要重新生成数组）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cache.size, tick])

  if (!enabled) {
    return <>{children(pathname)}</>
  }

  return (
    <>
      {cachedItems.map(({ key, node }) => (
        <div
          key={key}
          data-keep-alive={key}
          style={{
            display: key === pathname ? 'block' : 'none',
            width: '100%',
            height: '100%',
          }}
        >
          {node}
        </div>
      ))}
    </>
  )
}
