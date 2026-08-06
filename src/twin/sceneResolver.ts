import type { RouteConfig } from '../data/types'
import { createDemoScene } from './sceneFactory'
import type { TwinScene } from './twinTypes'

/**
 * 从大屏路由 state 读取孪生场景快照，兼容新版完整场景与旧版元数据。
 * 投放流程会把完整 TwinScene 写入 route.state.twinScenes[sceneId]，供新开标签/离线预览直接渲染。
 */
export function readRouteTwinScene(
  route: RouteConfig | undefined,
  sceneId: string
): TwinScene | undefined {
  const snap = route?.state?.twinScenes as Record<string, unknown> | undefined
  const item = snap?.[sceneId]
  if (!item || typeof item !== 'object') return undefined
  const candidate = item as { scene?: TwinScene; entities?: TwinScene['entities'] }
  if (candidate.scene?.entities) return candidate.scene
  if (Array.isArray(candidate.entities)) return candidate as unknown as TwinScene
  return undefined
}

/** 大屏组件场景解析：路由完整快照 > 全局孪生缓存 > 示范工厂 demo。 */
export function resolveWidgetScene(
  route: RouteConfig | undefined,
  sceneId: string,
  cached?: TwinScene
): TwinScene {
  const routeScene = readRouteTwinScene(route, sceneId)
  if (cached && (sceneId !== 'main' || !routeScene)) return cached
  if (routeScene) return routeScene
  return cached ?? createDemoScene()
}
