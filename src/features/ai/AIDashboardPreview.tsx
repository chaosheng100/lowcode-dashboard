import { widgetRegistry } from '../../data/registry/widgetRegistry'
import type { AIDesignSchema, AIDesignComponent, ComponentInstance, WidgetType } from '../../data/types'
import WidgetRenderer from '../../designer/widgets/WidgetRenderer'

/** 把 AI 设计组件映射为可渲染的 ComponentInstance（未知类型兜底为 text） */
function toInstance(c: AIDesignComponent, i: number): ComponentInstance {
  const type = (widgetRegistry[c.type as keyof typeof widgetRegistry]
    ? c.type
    : 'text') as WidgetType
  const def = widgetRegistry[type]
  return {
    id: c.id || `${c.type}-${i}`,
    type,
    style: c.style ?? { x: 0, y: 0, w: def.defaultStyle.w, h: def.defaultStyle.h },
    props: { ...def.defaultProps, ...(c.props || {}) } as ComponentInstance['props'],
  }
}

/**
 * AI 生成结果实时预览：按 Schema 的 page 尺寸等比缩放渲染各组件。
 * 仅用于生成阶段的「所见即所得」校验，不绑定交互/联动。
 */
export default function AIDashboardPreview({
  schema,
  scale = 0.34,
}: {
  schema?: AIDesignSchema | null
  scale?: number
}) {
  if (!schema || !schema.components || schema.components.length === 0) {
    return (
      <div
        style={{
          height: 240,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#86868b',
          fontSize: 13,
          border: '1px dashed #e5e5ea',
          borderRadius: 8,
          background: '#ffffff',
        }}
      >
        描述你的数据大屏，AI 将实时生成预览
      </div>
    )
  }

  const page = schema.page ?? { width: 1920, height: 1080, background: '#ffffff' }
  const instances = schema.components.map(toInstance)

  return (
    <div style={{ overflow: 'auto', background: '#ffffff', borderRadius: 8, padding: 8 }}>
      <div
        style={{
          width: page.width * scale,
          height: page.height * scale,
          position: 'relative',
          background: page.background,
          transformOrigin: 'top left',
        }}
      >
        {instances.map((inst) => (
          <div
            key={inst.id}
            style={{
              position: 'absolute',
              left: inst.style.x * scale,
              top: inst.style.y * scale,
              width: inst.style.w * scale,
              height: inst.style.h * scale,
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                width: inst.style.w,
                height: inst.style.h,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
              }}
            >
              <WidgetRenderer component={inst} />
            </div>
          </div>
        ))}
      </div>
      <div style={{ color: '#86868b', fontSize: 12, marginTop: 6 }}>
        共 {instances.length} 个组件 · 画布 {page.width}×{page.height}
      </div>
    </div>
  )
}
