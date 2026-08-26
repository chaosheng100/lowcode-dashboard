// ============================================================
// 前端 RouteConfig ↔ 后端 Screen 双向适配
//
// 前端 RouteConfig 对应后端一个 Screen：
//   - route.id         ↔  screen.id
//   - route.name       ↔  screen.name
//   - route.page       ↔  screen.config.page
//   - route.components ↔  screen.config.components
//   - route.state      →  screen.config.state  （扩展字段）
//   - route.params     →  screen.config.params （扩展字段）
//   - route.props      →  screen.config.props  （扩展字段）
// ============================================================
import type { ComponentInstance, PageConfig, RouteConfig } from '../data/types'
import type { ScreenConfig, ScreenItem } from './screenApi'
import { asArray, isObject } from '../data/utils/typeGuards'

const PAGE_DEFAULTS: PageConfig = {
  width: 1920,
  height: 1080,
  background: '#f5f5f7',
  backgroundImage: '',
  backgroundImageAssetId: '',
  backgroundImageFit: 'stretch',
  backgroundImageOpacity: 1,
  scale: 0.42,
  fit: true,
}

const STYLE_DEFAULTS = { x: 60, y: 60, w: 400, h: 240 }

function normalizePage(value: unknown): PageConfig {
  const raw = isObject(value) ? value as Partial<PageConfig> : {}
  const width = Number.isFinite(raw.width) ? raw.width! : PAGE_DEFAULTS.width
  const height = Number.isFinite(raw.height) ? raw.height! : PAGE_DEFAULTS.height
  return { ...PAGE_DEFAULTS, ...raw, width, height }
}

function normalizeComponents(value: unknown): ComponentInstance[] {
  const list = asArray(value)
  return list.map((entry, idx) => {
    const item = isObject(entry) ? entry as Partial<ComponentInstance> : {}
    const style = isObject(item.style) ? item.style as Partial<ComponentInstance['style']> : {}
    return {
      ...item,
      id: item.id || `comp-${idx}`,
      style: { ...STYLE_DEFAULTS, ...style },
      props: item.props || {},
    } as ComponentInstance
  })
}

/** 前端 RouteConfig → 后端 ScreenConfig */
export function routeToConfig(route: Partial<RouteConfig>): ScreenConfig {
  // 直接以 Record 构造，包含 page + components + 所有扩展字段
  const config: Record<string, unknown> = {
    page: route.page || PAGE_DEFAULTS,
    components: route.components || [],
  }
  if (route.state) config.state = route.state
  if (route.params) config.params = route.params
  if (route.props) config.props = route.props
  if (route.links) config.links = route.links
  if (route.thumbnail) config.thumbnail = route.thumbnail
  if (route.path) config.path = route.path
  if (route.kind) config.kind = route.kind
  return config as unknown as ScreenConfig
}

/** 后端 Screen → 前端 RouteConfig */
export function screenToRoute(screen: ScreenItem): RouteConfig {
  const cfg = (screen.config as unknown as Record<string, unknown>) || {}
  const components = normalizeComponents(cfg.components)
  const page = normalizePage(cfg.page)

  return {
    id: screen.id,
    name: screen.name,
    path: (cfg.path as string) || `/screen/${screen.id}`,
    parentId: null,
    kind: (cfg.kind as RouteConfig['kind']) || 'dashboard',
    createdAt: screen.createdAt,
    updatedAt: screen.updatedAt,
    thumbnail: cfg.thumbnail as string | undefined,
    params: (cfg.params as Record<string, unknown>) || {},
    props: (cfg.props as Record<string, unknown>) || {},
    state: (cfg.state as Record<string, unknown>) || {},
    page,
    components,
    links: (cfg.links as RouteConfig['links']) || [],
  }
}
