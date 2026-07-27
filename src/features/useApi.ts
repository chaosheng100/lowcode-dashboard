import { useCallback, useEffect, useState, type DependencyList } from 'react'
import type { ApiResp } from '../mock'

interface ApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
}

/**
 * 通用数据请求 hook：封装 loading / error / data 三态与 reload。
 * 配合 mock 的 ApiResp 信封（code=0 成功），对 code!=0 统一归入 error。
 * 仅当 deps 变化或显式 reload 时重新请求，避免重复触发。
 */
export function useApi<T>(fetcher: () => Promise<ApiResp<T>>, deps: DependencyList) {
  const [state, setState] = useState<ApiState<T>>({ data: null, loading: true, error: null })
  const [tick, setTick] = useState(0)
  const reload = useCallback(() => setTick((t) => t + 1), [])

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    fetcher()
      .then((res) => {
        if (cancelled) return
        if (res.code === 0) setState({ data: res.data, loading: false, error: null })
        else setState({ data: null, loading: false, error: res.message })
      })
      .catch((e) => {
        if (!cancelled) setState({ data: null, loading: false, error: String(e) })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  return { ...state, reload }
}

/** 关键字输入防抖（用于列表搜索） */
export function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}
