import { create } from 'zustand'
import { genId } from '../utils/id'
import { makeThumb } from '../utils/thumb'
import { widgetRegistry } from '../registry/widgetRegistry'
import { buildPlatformProject, DEFAULT_ROUTE_ID } from '../routes/platformRoutes'
import type {
  DesignerState,
  RouteConfig,
  ComponentInstance,
  WidgetProps,
  Filter
} from '../types'

const clone = (o: unknown): unknown => JSON.parse(JSON.stringify(o))

const defaultPage = (): RouteConfig['page'] => ({
  width: 1920,
  height: 1080,
  background: '#0a0e1a',
  backgroundImage: '',
  backgroundImageFit: 'stretch',
  backgroundImageOpacity: 1,
  scale: 0.42,
  fit: true
})

// 一条「路由 / 页面」即一个独立的设计单元
function makeRoute(overrides: Partial<RouteConfig> = {}): RouteConfig {
  return {
    id: genId('route'),
    name: '新页面',
    path: '/page',
    parentId: null,
    kind: 'data',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    thumbnail: undefined,
    params: {},
    props: {},
    state: {},
    page: defaultPage(),
    components: [],
    links: [],
    ...overrides
  }
}

// 默认载入平台真实路由结构（11 一级 / 25 二级）
const initialRoutes = buildPlatformProject().routes

export const useDesignerStore = create<DesignerState>((set, get) => ({
  mode: 'project', // 'project' | 'preview'
  routes: initialRoutes,
  selectedRouteId: DEFAULT_ROUTE_ID,
  selectedId: null, // 当前选中的组件
  filter: null, // 联动全局筛选 { field, value }

  // —— 视图 / 选择 ——
  setMode: (mode) => set({ mode, selectedId: null }),
  selectRoute: (id) => set({ selectedRouteId: id, selectedId: null, filter: null }),
  select: (id) => set({ selectedId: id }),

  // —— 路由树操作 ——
  addRoute: (parentId = null) => {
    const count = get().routes.length
    const route = makeRoute({
      name: parentId ? '子页面' : `新页面${count}`,
      path: parentId ? `/page/${count}` : `/page-${count}`,
      parentId
    })
    set((s) => ({ routes: [...s.routes, route], selectedRouteId: route.id, selectedId: null }))
    return route.id
  },

  deleteRoute: (id) => {
    set((s) => {
      // 递归收集自身及所有后代
      const toRemove = new Set<string>([id])
      let changed = true
      while (changed) {
        changed = false
        for (const r of s.routes) {
          if (r.parentId && toRemove.has(r.parentId) && !toRemove.has(r.id)) {
            toRemove.add(r.id)
            changed = true
          }
        }
      }
      const remaining = s.routes.filter((r) => !toRemove.has(r.id))
      const nextSel = remaining[0]?.id ?? null
      return { routes: remaining, selectedRouteId: nextSel, selectedId: null, filter: null }
    })
  },

  updateRoute: (id, patch) =>
    set((s) => ({ routes: s.routes.map((r) => (r.id === id ? { ...r, ...patch } : r)) })),

  // —— 跨窗口同步：用整条远端路由替换（预览端应用，不触发广播）——
  upsertRoute: (route) =>
    set((s) => ({ routes: s.routes.map((r) => (r.id === route.id ? route : r)) })),

  // —— 新建大屏（dashboard 类型），独立进入大屏编辑器 —— 
  createDashboard: (name) => {
    const count = get().routes.filter((r) => r.kind === 'dashboard').length
    const title = name || `新建大屏${count + 1}`
    const path = `/screen/new_${Date.now().toString(36)}`
    const route = makeRoute({
      id: path,
      name: title,
      path,
      parentId: null,
      kind: 'dashboard',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      thumbnail: makeThumb(path),
      components: [
        {
          id: genId('text'),
          type: 'text',
          style: { x: 60, y: 60, w: 760, h: 64 },
          props: { content: title, fontSize: 28, color: '#e6edf3', bold: true }
        }
      ]
    })
    set((s) => ({ routes: [...s.routes, route], selectedRouteId: route.id, selectedId: null, filter: null }))
    return route.id
  },

  // —— 组件操作（作用于当前选中路由）—— 
  addComponent: (type, stylePatch = {}) => {
    const s = get()
    const route = s.routes.find((r) => r.id === s.selectedRouteId)
    if (!route) return undefined
    const def = widgetRegistry[type]
    if (!def) return undefined
    const comp: ComponentInstance = {
      id: genId(type),
      type,
      style: { ...def.defaultStyle, ...stylePatch },
      props: clone(def.defaultProps) as WidgetProps
    }
    set((st) => ({
      routes: st.routes.map((r) =>
        r.id === route.id ? { ...r, components: [...r.components, comp] } : r
      ),
      selectedId: comp.id
    }))
    return comp.id
  },

  removeComponent: (id) =>
    set((s) => ({
      routes: s.routes.map((r) =>
        r.id === s.selectedRouteId
          ? { ...r, components: r.components.filter((c) => c.id !== id) }
          : r
      ),
      selectedId: s.selectedId === id ? null : s.selectedId
    })),

  updateComponentProps: (id, patch) =>
    set((s) => ({
      routes: s.routes.map((r) =>
        r.id === s.selectedRouteId
          ? {
              ...r,
              components: r.components.map((c) =>
                c.id === id ? { ...c, props: { ...c.props, ...patch } } : c
              )
            }
          : r
      )
    })),

  updateComponentStyle: (id, patch) =>
    set((s) => ({
      routes: s.routes.map((r) =>
        r.id === s.selectedRouteId
          ? {
              ...r,
              components: r.components.map((c) =>
                c.id === id ? { ...c, style: { ...c.style, ...patch } } : c
              )
            }
          : r
      )
    })),

  moveComponent: (id, x, y) =>
    set((s) => ({
      routes: s.routes.map((r) =>
        r.id === s.selectedRouteId
          ? {
              ...r,
              components: r.components.map((c) =>
                c.id === id ? { ...c, style: { ...c.style, x: Math.round(x), y: Math.round(y) } } : c
              )
            }
          : r
      )
    })),

  // —— 当前路由页面设置（缩放 / 背景等）—— 
  setPage: (patch) =>
    set((s) => ({
      routes: s.routes.map((r) =>
        r.id === s.selectedRouteId ? { ...r, page: { ...r.page, ...patch } } : r
      )
    })),

  // —— 联动筛选 —— 
  setFilter: (filter: Filter) => set({ filter }),
  clearFilter: () => set({ filter: null }),

  // —— 项目级：加载 / 导出 / 清空 —— 
  loadProject: (project) => {
    const routes =
      project && project.routes && project.routes.length
        ? project.routes
        : [makeRoute({ name: '首页', path: '/' })]
    set({
      routes,
      selectedRouteId: routes[0].id,
      selectedId: null,
      filter: null,
      mode: 'project'
    })
  },

  exportProject: () => {
    const s = get()
    return { version: '1.0', routes: s.routes }
  },

  clearAll: () => {
    const root = makeRoute({ name: '首页', path: '/' })
    set({ routes: [root], selectedRouteId: root.id, selectedId: null, filter: null })
  }
}))

// 示例项目 = 平台真实路由结构（一键体验多页面路由 + 联动效果）
export { buildPlatformProject }

// 便捷选择器：取当前选中路由（带兜底）
export function useActiveRoute(): RouteConfig {
  return useDesignerStore((s) => s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0])
}
