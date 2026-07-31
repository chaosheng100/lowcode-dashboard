import { isActive } from './filterUtils'
import type { WidgetViewProps } from '../../data/types'

// 表头/列可能是字符串数组，也可能是 { name, key } 对象数组（如 AI 生成的 schema），统一取可读文本
function cellText(c: unknown): string {
  if (typeof c === 'string') return c
  if (c && typeof c === 'object') {
    const o = c as Record<string, unknown>
    return String(o.name ?? o.label ?? o.key ?? o.title ?? '')
  }
  return c == null ? '' : String(c)
}

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
            <th>{cellText(columns?.[0]) || '名称'}</th>
            <th>{cellText(columns?.[1]) || '数值'}</th>
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
                <td>{r.name ?? ''}</td>
                <td>{(r.value ?? '').toLocaleString?.() ?? r.value}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
