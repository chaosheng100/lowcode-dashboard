import { useEffect, useRef } from 'react'
import * as echarts from 'echarts'

/** 轻量 ECharts 容器：自动初始化、随窗口缩放、option 变更即重绘 */
export default function EChartBox({ option, height = 220 }: { option: any; height?: number }) {
  const ref = useRef<HTMLDivElement>(null)
  const chart = useRef<ReturnType<typeof echarts.init> | null>(null)

  useEffect(() => {
    if (!ref.current) return
    chart.current = echarts.init(ref.current)
    const onResize = () => chart.current?.resize()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      chart.current?.dispose()
      chart.current = null
    }
  }, [])

  useEffect(() => {
    chart.current?.setOption(option, true)
  }, [option])

  return <div ref={ref} style={{ width: '100%', height }} />
}
