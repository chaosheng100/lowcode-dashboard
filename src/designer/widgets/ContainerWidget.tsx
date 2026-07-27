import type { WidgetViewProps } from '../../data/types'

export default function ContainerWidget({ component }: WidgetViewProps) {
  const { label, background } = component.props
  return (
    <div className="w-container" style={{ background }}>
      <div style={{ padding: '6px 10px', color: '#9aa7b4', fontSize: 12 }}>{label}</div>
    </div>
  )
}
