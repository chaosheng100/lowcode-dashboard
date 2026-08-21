// ============================================================
// AI 编排共享工具：画布 → AI baseSchema
// ============================================================
import type { AIDesignSchema, RouteConfig } from '../types'

/**
 * 当前画布 → AI baseSchema（让 AI 基于现状编排/调整，而不是凭空生成）。
 * AIPanel（全画布编排）共用。
 */
export function currentCanvasSchema(route: RouteConfig | undefined): AIDesignSchema | undefined {
  if (!route) return undefined
  return {
    version: '1.0',
    page: {
      width: route.page.width,
      height: route.page.height,
      background: route.page.background,
    },
    components: route.components.map((c) => ({
      id: c.id,
      type: c.type,
      style: { ...c.style },
      props: { ...c.props },
      ...(c.dataSource ? { dataSource: c.dataSource } : {}),
    })),
  }
}
