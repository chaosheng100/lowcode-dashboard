// Unified big-screen helpers: every dashboard edit/deploy targets backend /api/screens.
import type { RouteConfig } from '../data/types'
import { routeToConfig, screenToRoute } from './screenAdapter'
import { screenApi } from './screenApi'

export async function loadScreenRoute(id: string): Promise<RouteConfig | null> {
  const res = await screenApi.detail(id)
  if (res.code !== 0 || !res.data) return null
  return screenToRoute(res.data)
}

export async function saveScreenRoute(route: RouteConfig): Promise<boolean> {
  const res = await screenApi.save(route.id, routeToConfig(route))
  return res.code === 0
}

export function patchScreenRoute(
  route: RouteConfig,
  patch: Partial<RouteConfig>,
): RouteConfig {
  return { ...route, ...patch }
}
