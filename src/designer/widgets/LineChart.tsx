import type { WidgetViewProps } from '../../data/types'

export default function LineChart({ component }: WidgetViewProps) {
  const { data = [], color = '#4f8cff', title } = component.props
  const rows = Array.isArray(data) ? data as Array<Record<string, unknown>> : []
  const w = component.style.w
  const h = component.style.h
  const pad = 36
  const titleH = 24
  const chartW = w - pad * 2
  const chartH = h - pad * 2 - titleH
  const max = Math.max(1, ...rows.map((d) => Number(d.value) || 0))
  const slot = chartW / Math.max(rows.length - 1, 1)

  const pts = rows.map((d, i) => {
    const x = pad + i * slot
    const y = pad + titleH + chartH - ((Number(d.value) || 0) / max) * chartH
    return [x, y]
  })
  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ')
  const area = `${line} L ${pts[pts.length - 1][0]} ${pad + titleH + chartH} L ${pts[0][0]} ${pad + titleH + chartH} Z`

  return (
    <svg className="chart-svg" viewBox={`0 0 ${w} ${h}`}>
      {title ? (
        <text x={pad} y={18} fill="#9aa7b4" fontSize="13">
          {title}
        </text>
      ) : null}
      <line x1={pad} y1={pad + titleH + chartH} x2={pad + chartW} y2={pad + titleH + chartH} stroke="#2a3340" />
      <path d={area} fill={color} opacity={0.12} />
      <path d={line} fill="none" stroke={color} strokeWidth={2} />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={3} fill={color} />
          <text x={p[0]} y={p[1] - 8} fill="#e6edf3" fontSize="10" textAnchor="middle">
            {String(rows[i].value)}
          </text>
          <text x={p[0]} y={pad + titleH + chartH + 16} fill="#9aa7b4" fontSize="10" textAnchor="middle">
            {String(rows[i].name)}
          </text>
        </g>
      ))}
    </svg>
  )
}
