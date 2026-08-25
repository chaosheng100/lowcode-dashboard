import { useEffect, useState } from 'react'
import { applyFilter } from './filterUtils'
import { api } from '../../mock'
import type { WidgetViewProps } from '../../data/types'

// 指标卡：联动时只展示筛选维度对应的值，否则汇总全部。
// 绑定物联设备（iotDeviceId + iotMetric）后轮询设备最新采集值，覆盖静态 data。
export default function MetricWidget({ component, filter }: WidgetViewProps) {
  const { label, data, filterField, unit, iotDeviceId, iotMetric, liveIntervalMs, preview } = component.props
  const rows = Array.isArray(data) ? data as Array<Record<string, unknown>> : []
  const list = applyFilter(rows, filter && filter.field === filterField ? filter : null)
  const total = list.reduce((s, d) => s + (Number(d.value) || 0), 0)

  const [iotValue, setIotValue] = useState<number | null>(null)
  const [iotOnline, setIotOnline] = useState(false)

  // IoT 绑定：轮询接口读取设备指标最新值（设备编辑/指标变化后大屏自动跟随）
  useEffect(() => {
    if (!iotDeviceId || !iotMetric) { setIotValue(null); setIotOnline(false); return }
    // 预览态：使用静态 data 展示，不向后端发起实时请求
    if (preview) {
      const v = rows.find((d) => d.name === iotMetric)?.value
      setIotValue(typeof v === 'number' ? v : total)
      setIotOnline(true)
      return
    }
    let alive = true
    const pull = async () => {
      const r = await api.getIoTDevice(iotDeviceId)
      if (!alive) return
      const value = r.code === 0 && r.data ? r.data.metrics[iotMetric] : undefined
      if (typeof value === 'number') { setIotValue(value); setIotOnline(true) }
      else setIotOnline(false)
    }
    pull()
    const timer = setInterval(pull, Math.max(liveIntervalMs ?? 2000, 500))
    return () => { alive = false; clearInterval(timer) }
  }, [iotDeviceId, iotMetric, liveIntervalMs, preview, data, total])

  const isIot = Boolean(iotDeviceId && iotMetric)
  return (
    <div className="w-metric" style={{ position: 'relative' }}>
      <div className="lbl">
        {label}
        {filter ? `（${filter.value}）` : ''}
      </div>
      <div className="num">
        {(isIot && iotValue != null ? iotValue : total).toLocaleString()}
        {unit ? <span style={{ fontSize: 14, marginLeft: 4 }}>{unit}</span> : null}
      </div>
      {isIot && (
        <span style={{
          position: 'absolute', top: 4, right: 6, fontSize: 9, padding: '1px 6px', borderRadius: 8,
          background: iotOnline ? 'rgba(34,197,94,.15)' : 'rgba(148,163,184,.15)',
          color: iotOnline ? '#4ade80' : '#9aa7b4',
          border: `1px solid ${iotOnline ? '#166534' : '#334155'}`
        }}>
          {iotOnline ? '● IoT' : '○ IoT'}
        </span>
      )}
    </div>
  )
}
