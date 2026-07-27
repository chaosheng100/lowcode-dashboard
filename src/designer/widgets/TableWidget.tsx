import { isActive } from './filterUtils'
import type { WidgetViewProps } from '../../data/types'

export default function TableWidget({ component, filter, onPick }: WidgetViewProps) {
  const { title, columns, data, filterField, interactive } = component.props
  const rows = data || []
  return (
    <div className="w-table">
      {title ? (
        <div style={{ color: '#9aa7b4', fontSize: 12, marginBottom: 6 }}>{title}</div>
      ) : null}
      <table>
        <thead>
          <tr>
            <th>{columns?.[0] || '名称'}</th>
            <th>{columns?.[1] || '数值'}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => {
            const active = isActive(r, filter)
            return (
              <tr
                key={i}
                className={(interactive ? 'clickable ' : '') + (active ? 'active' : '')}
                onClick={
                  interactive && onPick
                    ? () => onPick({ field: filterField ?? 'name', value: r.name })
                    : undefined
                }
              >
                <td>{r.name}</td>
                <td>{(r.value ?? '').toLocaleString?.() ?? r.value}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
