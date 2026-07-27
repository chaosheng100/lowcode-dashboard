import type { WidgetViewProps } from '../../data/types'

export default function ImageWidget({ component }: WidgetViewProps) {
  const { src, fit } = component.props
  return (
    <img
      className="w-img"
      src={src}
      style={{ objectFit: fit }}
      alt=""
      draggable={false}
    />
  )
}
