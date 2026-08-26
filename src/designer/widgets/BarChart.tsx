import { isActive } from './filterUtils'
import type { WidgetViewProps } from '../../data/types'
import { asArray } from '../../data/utils/typeGuards'

export default function BarChart({ component, filter, onPick }: WidgetViewProps) {
  const { data = [], color = '#22d3ee', title, filterField, interactive } = component.props
  const w = component.style.w
  const h = component.style.h
  const pad = 36
  const titleH = 24
  const chartW = w - pad * 2
  const chartH = Math.max(0, h - pad * 2 - titleH)
  const rows = asArray<Record<string, unknown>>(data)
  const max = Math.max(1, ...rows.map((d) => Number(d.value) || 0))
  const slot = chartW / Math.max(data.length, 1)
  const barW = Math.min(slot * 0.6, 60)

  return (
    <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`}>
      {title ? (
        <text x={pad} y={18} fill="#9aa7b4" fontSize="13">
          {title}
        </text>
      ) : null}
      <line x1={pad} y1={pad + titleH + chartH} x2={pad + chartW} y2={pad + titleH + chartH} stroke="#2a3340" />
      {rows.map((d, i) => {
        const v = Number(d.value) || 0
        const bh = Math.max(0, (v / max) * chartH)
        const x = pad + i * slot + (slot - barW) / 2
        const y = pad + titleH + chartH - bh
        const active = isActive(d, filter)
        return (
          <g key={i}>
            <rect
              className="bar-rect"
              x={x}
              y={y}
              width={barW}
              height={bh}
              rx={3}
              fill={active ? '#ffffff' : color}
              opacity={filter && !active ? 0.35 : 1}
              onClick={
                interactive && onPick
                  ? () => onPick({ field: filterField ?? 'name', value: d.name == null ? '' : String(d.name) })
                  : undefined
              }
            />
            <text x={x + barW / 2} y={y - 6} fill="#e6edf3" fontSize="11" textAnchor="middle">
              {d.value == null ? '' : String(d.value)}
            </text>
            <text x={x + barW / 2} y={pad + titleH + chartH + 16} fill="#9aa7b4" fontSize="11" textAnchor="middle">
              {d.name == null ? '' : String(d.name)}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
