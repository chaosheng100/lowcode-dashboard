import { create } from 'zustand'
import { genId } from '../utils/id'
import { makeThumb } from '../utils/thumb'
import { widgetRegistry } from '../registry/widgetRegistry'
import { buildPlatformProject, DEFAULT_ROUTE_ID } from '../routes/platformRoutes'
import { createDemoScene } from '../../twin/sceneFactory'
import type {
  DesignerState,
  RouteConfig,
  ComponentInstance,
  WidgetProps,
  Filter,
  AIDesignSchema
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

  // —— 数字孪生场景库（模块编辑器与大屏数字孪生组件共享同一份场景数据，实现互通 + 持久化）——
  twinScenes: { main: createDemoScene() },
  activeTwinSceneId: 'main',

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
      return { routes: remaining, selectedRouteId: nextSel ?? undefined, selectedId: null, filter: null }
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

  // —— 删除大屏（dashboard 类型）—— 
  deleteDashboard: (id) => {
    set((s) => {
      const remaining = s.routes.filter((r) => r.id !== id)
      // 删除当前选中的大屏时清空选中，避免 AppRouter 的 store→URL 同步把列表页自动导航到其它大屏
      const nextSel = s.selectedRouteId === id ? null : s.selectedRouteId
      return { routes: remaining, selectedRouteId: nextSel ?? undefined, selectedId: null, filter: null }
    })
  },

  // —— 重命名大屏（dashboard 类型），并刷新 updatedAt —— 
  renameDashboard: (id, name) =>
    set((s) => ({
      routes: s.routes.map((r) =>
        r.id === id ? { ...r, name, updatedAt: new Date().toISOString() } : r
      )
    })),

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

  // —— 数字孪生场景库 —— 
  setActiveTwinScene: (id) => set({ activeTwinSceneId: id }),
  /** 新增或覆盖一个孪生场景（id 为键） */
  upsertTwinScene: (scene) => set((s) => ({ twinScenes: { ...s.twinScenes, [scene.id]: scene } })),
  /** 编辑场景的实体集合与环境（模块编辑器写回，使大屏组件同步） */
  updateTwinSceneEntities: (id, entities, env) =>
    set((s) => {
      const cur = s.twinScenes[id]
      if (!cur) return s
      return { twinScenes: { ...s.twinScenes, [id]: { ...cur, entities, env } } }
    }),
  /** 新建空白场景，返回其 id 并设为当前编辑场景 */
  addTwinScene: (name) => {
    const id = `twin_${Date.now().toString(36)}`
    set((s) => ({
      twinScenes: { ...s.twinScenes, [id]: { id, name, entities: [], env: { lighting: 'day', fog: false } } },
      activeTwinSceneId: id
    }))
    return id
  },
  /** 删除场景（main 不允许删除） */
  removeTwinScene: (id) =>
    set((s) => {
      if (id === 'main') return s
      const next = { ...s.twinScenes }
      delete next[id]
      return { twinScenes: next, activeTwinSceneId: s.activeTwinSceneId === id ? 'main' : s.activeTwinSceneId }
    }),
  /** 重命名场景 */
  renameTwinScene: (id, name) =>
    set((s) => {
      const cur = s.twinScenes[id]
      if (!cur) return s
      return { twinScenes: { ...s.twinScenes, [id]: { ...cur, name } } }
    }),

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
  },

  // AI 设计：把自然语言生成的大屏 Schema 应用到当前选中路由
  applyAISchema: (schema: AIDesignSchema) => {
    const s = get()
    const route = s.routes.find((r) => r.id === s.selectedRouteId)
    if (!route) return
    const components: ComponentInstance[] = (schema.components || []).map((c) => {
      const type = (widgetRegistry[c.type as keyof typeof widgetRegistry]
        ? c.type
        : 'text') as ComponentInstance['type']
      const def = widgetRegistry[type]
      const baseStyle = def.defaultStyle
      const style = {
        x: c.style?.x ?? baseStyle.x,
        y: c.style?.y ?? baseStyle.y,
        w: c.style?.w ?? baseStyle.w,
        h: c.style?.h ?? baseStyle.h
      }
      return {
        id: c.id || genId(type),
        type,
        style,
        props: { ...(clone(def.defaultProps) as Record<string, unknown>), ...(c.props || {}) } as WidgetProps
      }
    })
    set((st) => ({
      routes: st.routes.map((r) =>
        r.id === route.id
          ? {
              ...r,
              components,
              page: schema.page
                ? {
                    ...r.page,
                    width: schema.page.width ?? r.page.width,
                    height: schema.page.height ?? r.page.height,
                    background: schema.page.background ?? r.page.background
                  }
                : r.page
            }
          : r
      ),
      selectedId: null
    }))
  }
}))

// 示例项目 = 平台真实路由结构（一键体验多页面路由 + 联动效果）
export { buildPlatformProject }

// 便捷选择器：取当前选中路由（带兜底）
export function useActiveRoute(): RouteConfig {
  return useDesignerStore((s) => s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0])
}
