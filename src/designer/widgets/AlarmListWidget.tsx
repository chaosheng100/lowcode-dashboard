import type { WidgetViewProps } from '../../data/types'
import { useTwinRuntimeStore, selectAllAlarms, selectAllPredictions } from '../../twin/twinRuntimeStore'
import { ALARM_COLORS, type AlarmLevel } from '../../twin/twinTypes'

// ============================================================
// AlarmListWidget：数字孪生告警清单组件（L5 决策/应用层）
// 读取运行时 store 的告警（由 TwinSim 预测性维护产出），展示分级告警列表；
// 顶部摘要带显示“平均健康指数 / 预测故障数 / 告警总数”，体现仿真驱动大屏动态展示；
// 点击某条告警 → 联动过滤(filter) + 选中实体 → 孪生场景反向空间定位。
// ============================================================

function fmtTime(ts: number): string {
  const d = new Date(ts)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`
}

function levelText(l: AlarmLevel): string {
  return l === 'critical' ? '严重' : l === 'warning' ? '预警' : '提示'
}

export default function AlarmListWidget({ component, filter, onPick }: WidgetViewProps) {
  const p = component.props
  const filterField = p.filterField || 'entityId'
  // 聚合所有孪生实例的告警与预测（运行时状态按实例隔离，告警清单作为全局监控视图汇总）
  const alarms = useTwinRuntimeStore(selectAllAlarms)
  const predictions = useTwinRuntimeStore(selectAllPredictions)

  const predList = Object.values(predictions)
  const avgHealth = predList.length
    ? Math.round(predList.reduce((a, b) => a + b.healthIndex, 0) / predList.length)
    : 0
  const faultCount = alarms.filter((a) => a.level !== 'info').length
  const maxItems = p.maxItems ?? 30
  const shown = alarms.slice(0, maxItems)

  const onClick = (entityId: string) => {
    // 仅通过联动 filter 驱动孪生组件聚焦/选中，避免写入全局选中态导致跨实例串数据
    if (onPick) onPick({ field: filterField, value: entityId })
  }

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: 'rgba(8,13,22,0.6)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '6px 10px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, color: '#e6edf3', fontWeight: 600 }}>{p.title || '孪生告警清单'}</span>
        <span style={{ fontSize: 10, color: '#7dd3fc' }}>平均健康 {avgHealth || '—'}</span>
        <span style={{ fontSize: 10, color: '#f59e0b' }}>预测故障 {faultCount}</span>
        <span style={{ fontSize: 10, color: '#9fb0c3', marginLeft: 'auto' }}>共 {alarms.length}</span>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '4px 6px' }}>
        {shown.length === 0 && (
          <div style={{ color: '#6b7d8f', fontSize: 11, textAlign: 'center', marginTop: 16 }}>暂无告警，孪生体运行正常</div>
        )}
        {shown.map((a) => {
          const active = filter && (filter as any).field === filterField && (filter as any).value === a.entityId
          return (
            <div
              key={a.id}
              onClick={() => onClick(a.entityId)}
              style={{
                cursor: 'pointer',
                padding: '5px 8px',
                marginBottom: 4,
                borderRadius: 6,
                background: active ? 'rgba(245,158,11,0.18)' : 'rgba(255,255,255,0.04)',
                border: `1px solid ${active ? '#f59e0b' : 'transparent'}`,
                display: 'flex',
                alignItems: 'center',
                gap: 8
              }}
            >
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: ALARM_COLORS[a.level], flexShrink: 0 }} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 11, color: '#e6edf3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.entityName}
                  <span style={{ marginLeft: 6, fontSize: 10, color: ALARM_COLORS[a.level] }}>[{levelText(a.level)}]</span>
                </div>
                <div style={{ fontSize: 10, color: '#9fb0c3', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {a.message}
                </div>
              </div>
              <span style={{ fontSize: 10, color: '#6b7d8f', flexShrink: 0 }}>{fmtTime(a.ts)}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
