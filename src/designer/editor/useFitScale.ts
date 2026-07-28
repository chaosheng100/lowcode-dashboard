import { useEffect, useState, type RefObject } from 'react'
import type { PageConfig } from '../../data/types'

/**
 * 根据容器实际可用尺寸，计算让 width×height 画布完整落在容器内的「适配缩放比」，
 * 并保留容器内边距（自动读取 computed style），以及编辑态四周标尺带的尺寸。
 *
 * 编辑态画布由「左右/上下标尺带 + 中心画布」组成（3×3 栅格），可用宽度需
 * 扣除 2×rulerX、可用高度需扣除 2×rulerY，否则 fit 出的画布视口恰好等于
 * 容器满宽高，加上标尺带后整体必然溢出 canvas-area。预览态无标尺带，传 0 即可。
 *
 * 当容器尺寸变化（窗口缩放、路由区折叠/展开导致操作区变宽变窄）时，
 * 通过 ResizeObserver 自动重算，使画布响应式适配。
 *
 * @param areaRef 画布容器（.canvas-area）的 ref
 * @param page    当前页面配置（含 width / height）
 * @param rulerX  编辑态左/右标尺带宽度（px），预览态传 0
 * @param rulerY  编辑态上/下标尺带高度（px），预览态传 0
 * @returns 适配缩放比，范围裁到 [0.1, 1]
 */
export function useFitScale(
  areaRef: RefObject<HTMLElement | null>,
  page: PageConfig,
  rulerX = 0,
  rulerY = 0
): number {
  const [fit, setFit] = useState(0.42)

  useEffect(() => {
    const el = areaRef.current
    if (!el) return

    const compute = () => {
      const cs = getComputedStyle(el)
      const padX = parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight)
      const padY = parseFloat(cs.paddingTop) + parseFloat(cs.paddingBottom)
      const w = el.clientWidth - padX - 2 * rulerX
      const h = el.clientHeight - padY - 2 * rulerY
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
