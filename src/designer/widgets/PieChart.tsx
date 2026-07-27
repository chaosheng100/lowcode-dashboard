import { isActive } from './filterUtils'
import type { WidgetViewProps } from '../../data/types'

export default function PieChart({ component, filter, onPick }: WidgetViewProps) {
  const { data = [], title, filterField, interactive } = component.props
  const w = component.style.w
  const h = component.style.h
  const cx = w / 2
  const cy = h / 2 + 8
  const r = Math.min(w, h) / 2 - 50
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const palette = ['#4f8cff', '#22d3ee', '#56d364', '#ffb454', '#ff5d5d', '#a78bfa']

  const polar = (cx: number, cy: number, r: number, angleDeg: number) => {
    const a = ((angleDeg - 90) * Math.PI) / 180
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)]
  }
  const arcPath = (cx: number, cy: number, r: number, start: number, end: number) => {
    const [x1, y1] = polar(cx, cy, r, end)
    const [x2, y2] = polar(cx, cy, r, start)
    const large = end - start > 180 ? 1 : 0
    return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 0 ${x2} ${y2} Z`
  }

  let angle = 0
  return (
    <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`}>
      {title ? (
        <text x={12} y={20} fill="#9aa7b4" fontSize="13">
          {title}
        </text>
      ) : null}
      {data.map((d, i) => {
        const sweep = (d.value / total) * 360
        const path = arcPath(cx, cy, r, angle, angle + sweep)
        const active = isActive(d, filter)
        const slice = (
          <path
            key={i}
            className="pie-slice"
            d={path}
            fill={palette[i % palette.length]}
            opacity={filter && !active ? 0.3 : 1}
            onClick={
              interactive && onPick
                ? () => onPick({ field: filterField ?? 'name', value: d.name })
                : undefined
            }
          />
        )
        angle += sweep
        return slice
      })}
      {data.map((d, i) => (
        <g key={'l' + i}>
          <rect x={12} y={cy + r + 12 + i * 16} width={10} height={10} fill={palette[i % palette.length]} />
          <text x={28} y={cy + r + 21 + i * 16} fill="#cdd9e5" fontSize="11">
            {d.name} {Math.round((d.value / total) * 100)}%
          </text>
        </g>
      ))}
    </svg>
  )
}
