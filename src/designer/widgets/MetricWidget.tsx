import { applyFilter } from './filterUtils'
import type { WidgetViewProps } from '../../data/types'

// 指标卡：联动时只展示筛选维度对应的值，否则汇总全部
export default function MetricWidget({ component, filter }: WidgetViewProps) {
  const { label, data, filterField, unit } = component.props
  const list = applyFilter(data, filter && filter.field === filterField ? filter : null)
  const total = list.reduce((s, d) => s + (d.value || 0), 0)
  return (
    <div className="w-metric">
      <div className="lbl">
        {label}
        {filter ? `（${filter.value}）` : ''}
      </div>
      <div className="num">
        {total.toLocaleString()}
        {unit ? <span style={{ fontSize: 14, marginLeft: 4 }}>{unit}</span> : null}
      </div>
    </div>
  )
}
