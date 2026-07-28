import { useEffect, useMemo, useRef, useState } from 'react'
import * as echarts from 'echarts'
import type { WidgetViewProps, DataPoint } from '../../data/types'
import { subscribeLive } from '../../data/live/liveClient'

// ============================================================
// EChartWidget：画布内嵌真实 ECharts 实例的组件族。
// - 尺寸随组件 style.w/h 自适应（ResizeObserver）
// - 支持数据集绑定（props.data）与实时源订阅（props.liveSourceId）
// - 点击图表数据项 -> 触发全局联动（与 SVG 组件同一套 filter 机制）
// - echartCustom 支持粘贴任意 option JSON
// ============================================================

const AXIS_STYLE = {
  axisLine: { lineStyle: { color: '#2a3340' } },
  axisLabel: { color: '#9aa7b4', fontSize: 10 },
  splitLine: { lineStyle: { color: 'rgba(42,51,64,0.6)' } }
}

function buildOption(type: string, p: WidgetViewProps['component']['props'], data: DataPoint[]): echarts.EChartsCoreOption {
  const color = p.color || '#4f8cff'
  const title = p.title
    ? { text: p.title, textStyle: { color: '#9aa7b4', fontSize: 13, fontWeight: 'normal' as const }, left: 8, top: 6 }
    : undefined
  const legend = p.showLegend ? { textStyle: { color: '#9aa7b4', fontSize: 10 }, bottom: 0 } : undefined
  const grid = { left: 42, right: 16, top: p.title ? 40 : 20, bottom: p.showLegend ? 40 : 28 }

  switch (type) {
    case 'echartLine':
      return {
        title, legend, grid,
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: data.map((d) => d.name), ...AXIS_STYLE },
        yAxis: { type: 'value', ...AXIS_STYLE },
        series: [{
          name: p.title || '数值', type: 'line', smooth: p.smooth !== false,
          data: data.map((d) => d.value), itemStyle: { color },
          areaStyle: { opacity: 0.12, color }, symbolSize: 6
        }]
      }
    case 'echartBar':
      return {
        title, legend, grid,
        tooltip: { trigger: 'axis' },
        xAxis: { type: 'category', data: data.map((d) => d.name), ...AXIS_STYLE },
        yAxis: { type: 'value', ...AXIS_STYLE },
        series: [{
          name: p.title || '数值', type: 'bar', barMaxWidth: 28,
          data: data.map((d) => d.value),
          itemStyle: { color, borderRadius: [4, 4, 0, 0] }
        }]
      }
    case 'echartPie':
      return {
        title, tooltip: { trigger: 'item' },
        legend: p.showLegend !== false ? { textStyle: { color: '#9aa7b4', fontSize: 10 }, bottom: 0 } : undefined,
        series: [{
          name: p.title || '占比', type: 'pie', radius: ['38%', '66%'],
          center: ['50%', '50%'],
          data: data.map((d) => ({ name: d.name, value: d.value })),
          label: { color: '#9aa7b4', fontSize: 10 },
          itemStyle: { borderColor: '#0a0e1a', borderWidth: 2 }
        }]
      }
    case 'echartGauge':
      return {
        series: [{
          type: 'gauge', min: 0, max: p.gaugeMax ?? 100,
          progress: { show: true, width: 10, itemStyle: { color } },
          axisLine: { lineStyle: { width: 10, color: [[1, '#1a2433']] } },
          axisTick: { show: false }, splitLine: { length: 8, lineStyle: { color: '#2a3340' } },
          axisLabel: { color: '#9aa7b4', fontSize: 9, distance: 16 },
          pointer: { itemStyle: { color } },
          title: { show: !!p.title, offsetCenter: [0, '70%'], color: '#9aa7b4', fontSize: 12 },
          detail: { valueAnimation: true, color: '#e6edf3', fontSize: 20, offsetCenter: [0, '40%'] },
          data: [{ value: p.gaugeValue ?? data[0]?.value ?? 0, name: p.title || '' }]
        }]
      }
    case 'echartRadar':
      return {
        title,
        radar: {
          indicator: data.map((d) => ({ name: d.name, max: Math.max(...data.map((x) => x.value)) * 1.2 || 100 })),
          axisName: { color: '#9aa7b4', fontSize: 10 },
          splitLine: { lineStyle: { color: 'rgba(42,51,64,0.8)' } },
          splitArea: { areaStyle: { color: ['rgba(79,140,255,0.03)', 'rgba(79,140,255,0.06)'] } }
        },
        series: [{
          type: 'radar',
          data: [{ value: data.map((d) => d.value), name: p.title || '指标', itemStyle: { color }, areaStyle: { opacity: 0.2 } }]
        }]
      }
    default: {
      // echartCustom：解析用户 option JSON，失败给出占位
      try {
        return JSON.parse(p.optionJson || '{}') as echarts.EChartsCoreOption
      } catch {
        return { title: { text: 'option JSON 解析失败', textStyle: { color: '#ff5d5d', fontSize: 12 } } }
      }
    }
  }
}

export default function EChartWidget({ component, filter, onPick }: WidgetViewProps) {
  const ref = useRef<HTMLDivElement>(null)
  const chartRef = useRef<echarts.ECharts | null>(null)
  const p = component.props
  const [liveData, setLiveData] = useState<DataPoint[] | null>(null)
  const [transport, setTransport] = useState<'proxy' | 'mock' | null>(null)

  // 实时源订阅（SQL/WS/MQTT 经代理推送；代理不可用时自动本地模拟）
  useEffect(() => {
    if (!p.liveSourceId) { setLiveData(null); setTransport(null); return }
    const off = subscribeLive(
      p.liveSourceId,
      (data, meta) => { setLiveData(data); setTransport(meta.transport) },
      p.liveIntervalMs ?? 2000
    )
    return off
  }, [p.liveSourceId, p.liveIntervalMs])

  // 数据优先级：实时源 > 绑定/手动数据；联动过滤只作用于静态数据
  const data = useMemo<DataPoint[]>(() => {
    const base = liveData ?? p.data ?? []
    if (!filter || liveData) return base
    const field = p.filterField || 'name'
    if (field === 'name') return base.filter((d) => d.name === filter.value)
    return base
  }, [liveData, p.data, filter, p.filterField])

  // 初始化 + option 更新
  useEffect(() => {
    if (!ref.current) return
    if (!chartRef.current) {
      chartRef.current = echarts.init(ref.current)
      // 点击联动：与 SVG 组件同一套全局 filter
      chartRef.current.on('click', (params) => {
        if (p.interactive && onPick && typeof params.name === 'string' && params.name) {
          onPick({ field: p.filterField || 'name', value: params.name })
        }
      })
    }
    chartRef.current.setOption(buildOption(component.type, p, data), true)
  }, [component.type, p, data, onPick])

  // 尺寸自适应：跟随组件宽高（拖拽缩放时实时 resize）
  useEffect(() => {
    if (!ref.current) return
    const ro = new ResizeObserver(() => chartRef.current?.resize())
    ro.observe(ref.current)
    return () => ro.disconnect()
  }, [])

  // 卸载清理
  useEffect(() => () => { chartRef.current?.dispose(); chartRef.current = null }, [])

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={ref} style={{ width: '100%', height: '100%' }} />
      {p.liveSourceId && (
        <span style={{
          position: 'absolute', top: 4, right: 6, fontSize: 9, padding: '1px 6px', borderRadius: 8,
          background: transport === 'proxy' ? 'rgba(34,197,94,.15)' : 'rgba(234,179,8,.15)',
          color: transport === 'proxy' ? '#4ade80' : '#facc15',
          border: `1px solid ${transport === 'proxy' ? '#166534' : '#713f12'}`
        }}>
          {transport === 'proxy' ? '● 实时' : '● 模拟'}
        </span>
      )}
    </div>
  )
}
