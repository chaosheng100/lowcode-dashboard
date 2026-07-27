import type { WidgetViewProps } from '../../data/types'

export default function TextWidget({ component }: WidgetViewProps) {
  const { content, fontSize, color, align, bold } = component.props
  const justify =
    align === 'center' ? 'center' : align === 'right' ? 'flex-end' : 'flex-start'
  return (
    <div
      className="w-text"
      style={{ fontSize, color, justifyContent: justify, fontWeight: bold ? 700 : 400 }}
    >
      {content}
    </div>
  )
}
