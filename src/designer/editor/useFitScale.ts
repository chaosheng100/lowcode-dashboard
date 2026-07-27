import { useEffect, useState, type RefObject } from 'react'
import type { PageConfig } from '../../data/types'

/**
 * 根据容器实际可用尺寸，计算让 width×height 画布完整落在容器内的「适配缩放比」，
 * 并保留容器内边距（自动读取 computed style）。
 *
 * 当容器尺寸变化（窗口缩放、路由区折叠/展开导致操作区变宽变窄）时，
 * 通过 ResizeObserver 自动重算，使画布响应式适配。
 *
 * @param areaRef 画布容器（.canvas-area）的 ref
 * @param page    当前页面配置（含 width / height）
 * @returns 适配缩放比，范围裁到 [0.1, 1]
 */
export function useFitScale(areaRef: RefObject<HTMLElement | null>, page: PageConfig): number {
  const [fit, setFit] = useState(0.42)

  useEffect(() => {
    const el = areaRef.current
    if (!el) return

    const compute = () => {
      const cs = getComputedStyle(el)
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      const w = el.clientWidth - padX
      const h = el.clientHeight - padY
      if (w <= 0 || h <= 0) return
      const ratio = Math.min(w / page.width, h / page.height)
      setFit(Math.max(0.1, Math.min(1, ratio)))
    }

    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [areaRef, page.width, page.height])

  return fit
}
