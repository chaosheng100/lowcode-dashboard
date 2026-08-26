import { create } from 'zustand'
import { genId } from '../utils/id'
import { widgetRegistry } from '../registry/widgetRegistry'
import { buildPlatformProject, DEFAULT_ROUTE_ID } from '../routes/platformRoutes'
import { createDemoScene } from '../../twin/sceneFactory'
import type { TwinAnnotation } from '../../twin/twinTypes'
import type {
  DesignerState,
  RouteConfig,
  ComponentInstance,
  WidgetProps,
  Filter,
  AIDesignSchema
} from '../types'
import {
  createTwinComponent,
  type TwinWidgetKind
} from '../../features/twinWidgetCatalog'
import {
  createIoTComponent,
  type IoTWidgetKind
} from '../../features/iotWidgetCatalog'
import { asArray, isArray, isObject } from '../utils/typeGuards'
import { dtoToScene } from '../../twin/dtoAdapter'

const clone = (o: unknown): unknown => JSON.parse(JSON.stringify(o))

const defaultPage = (): RouteConfig['page'] => ({
  width: 1920,
  height: 1080,
  background: '#f5f5f7',
  backgroundImage: '',
  backgroundImageAssetId: '',
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
  catalog: [],
  catalogLoading: false,
  catalogError: null,
  // 组件中心已注册资产（AI 生成的 ECharts / 源码组件，与组件库页共用）
  registeredWidgets: [],
  widgetsLoading: false,
  // 孪生/物联资产数据（左侧组件面板「组件库全量组件」数据源）
  twinScenesMeta: {},
  iotDevicesMeta: [],
  twinMetaLoading: false,
  iotMetaLoading: false,

  // —— 数字孪生场景库（模块编辑器与大屏数字孪生组件共享同一份场景数据，实现互通 + 持久化）——
  twinScenes: { main: createDemoScene() },
  activeTwinSceneId: 'main',

  // —— 视图 / 选择 ——
  setMode: (mode) => set({ mode, selectedId: null }),
  selectRoute: (id) => set({ selectedRouteId: id, selectedId: null, filter: null }),
  select: (id) => set({ selectedId: id }),

  // —— 组件目录（后端 ComponentMeta 唯一来源）——
  loadCatalog: async () => {
    const st = get()
    if (st.catalogLoading) return
    set({ catalogLoading: true, catalogError: null })
    try {
      const res = await import('../../mock/api').then((m) => m.api.listComponents())
      if (res.code === 0) {
        // 后端滚动升级期间可能仍存在旧 table 元数据；前端目录只暴露 grid。
        const metas = (asArray(res.data) as Array<Record<string, any>>).map((meta) =>
          meta.type === 'table'
            ? { ...meta, type: 'grid', renderer: 'grid' }
            : meta
        ) as typeof res.data
        set({ catalog: metas, catalogLoading: false })
      } else {
        set({ catalogError: res.message || '组件目录加载失败', catalogLoading: false })
      }
    } catch (e) {
      set({ catalogError: (e as Error).message || '组件目录加载失败', catalogLoading: false })
    }
  },

  /** 组件目录 + 组件中心资产 + 孪生场景 + 物联设备：左侧组件面板的「组件库全量组件」数据源 */
  loadCatalogAssets: async () => {
    const st = get()
    await st.loadCatalog()
    const apiMod = await import('../../mock/api').then((m) => m.api)
    if (!st.widgetsLoading) {
      set({ widgetsLoading: true })
      try {
        const res = await apiMod.listWidgets({ pageSize: 50 })
        if (res.code === 0 && isArray(res.data?.list)) {
          set({ registeredWidgets: res.data.list })
        }
      } catch {
        // 组件中心资产加载失败不阻塞组件面板
      } finally {
        set({ widgetsLoading: false })
      }
    }
    if (!st.twinMetaLoading) {
      set({ twinMetaLoading: true })
      try {
        const res = await apiMod.listTwinScenes({ pageSize: 100 })
        if (res.code === 0 && isArray(res.data?.list)) {
          const snapshots: Record<string, unknown> = {}
          for (const scene of res.data.list) {
            snapshots[scene.id] = scene
          }
          set({ twinScenesMeta: snapshots })
        }
      } catch {
        // 孪生场景加载失败不阻塞组件面板
      } finally {
        set({ twinMetaLoading: false })
      }
    }
    if (!st.iotMetaLoading) {
      set({ iotMetaLoading: true })
      try {
        const res = await apiMod.listIoTDevices({ pageSize: 100 })
        if (res.code === 0 && isArray(res.data?.list)) {
          set({ iotDevicesMeta: res.data.list })
        }
      } catch {
        // 物联设备加载失败不阻塞组件面板
      } finally {
        set({ iotMetaLoading: false })
      }
    }
  },

  upsertTwinScenesMeta: (snapshots) =>
    set((s) => ({ twinScenesMeta: { ...s.twinScenesMeta, ...snapshots } })),
  removeTwinScenesMeta: (id) =>
    set((s) => {
      const next = { ...s.twinScenesMeta }
      delete next[id]
      return { twinScenesMeta: next }
    }),
  setIotDevicesMeta: (list) => set({ iotDevicesMeta: list }),

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

  // —— 组件操作（作用于当前选中路由）—— 
  addComponent: (type, stylePatch = {}, propsPatch, preset, meta) => {
    const s = get()
    const route = s.routes.find((r) => r.id === s.selectedRouteId)
    if (!route) return undefined
    const def = widgetRegistry[type]
    if (!def && !preset && !meta) return undefined
    const defaultStyle = meta?.defaultStyle ?? def?.defaultStyle ?? { x: 60, y: 60, w: 400, h: 240 }
    const catalogProps: Partial<WidgetProps> = meta
      ? {
          catalogKey: meta.type,
          catalogName: meta.name,
          catalogSourceId: `catalog:${meta.type}`,
          catalogRenderer: meta.renderer,
          catalogVersion: meta.version,
          catalogSchemaVersion: meta.schemaVersion,
          catalogCategory: meta.category,
          businessType: 'general',
        }
      : {
          catalogKey: type,
          catalogRenderer: type,
        }
    const comp: ComponentInstance = {
      id: genId(type),
      type: (meta?.type ?? preset?.type ?? type) as ComponentInstance['type'],
      style: { ...defaultStyle, ...stylePatch },
      props: clone({
        ...(def?.defaultProps ?? {}),
        ...(meta?.defaultProps ?? {}),
        ...(propsPatch || {}),
        ...(preset?.props || {}),
        ...catalogProps,
      }) as WidgetProps
    }
    set((st) => ({
      routes: st.routes.map((r) =>
        r.id === route.id ? { ...r, components: [...r.components, comp] } : r
      ),
      selectedId: comp.id
    }))
    return comp.id
  },

  // —— 左侧面板拖入孪生/物联业务组件（与组件库投放共用同一资产工厂）——
  addTwinCatalogComponent: (scene, kind, stylePatch) => {
    const s = get()
    const route = s.routes.find((r) => r.id === s.selectedRouteId)
    if (!route || !scene?.id) return undefined
    const syncedAt = new Date().toISOString()
    const managed = createTwinComponent(scene, kind as TwinWidgetKind)
    const comp: ComponentInstance = {
      ...managed,
      style: stylePatch ? { ...managed.style, ...stylePatch } : managed.style
    }
    const sourceId = comp.props.catalogSourceId
    const previousScenes = isObject(route.state.twinScenes)
      ? route.state.twinScenes as Record<string, unknown>
      : {}
    set((st) => ({
      twinScenesMeta: {
        ...st.twinScenesMeta,
        [scene.id]: scene
      },
      routes: st.routes.map((r) => {
        if (r.id !== route.id) return r
        const components = sourceId
          ? r.components.map((c) =>
              c.props.catalogSourceId === sourceId
                ? { ...comp, id: c.id, style: c.style }
                : c
            ).concat(sourceId && r.components.some((c) => c.props.catalogSourceId === sourceId) ? [] : [comp])
          : [...r.components, comp]
        return {
          ...r,
          components,
          state: {
            ...r.state,
            activeTwinSceneId: scene.id,
            twinScenes: { ...previousScenes, [scene.id]: {
              sceneId: scene.id,
              sceneName: scene.name,
              status: scene.status,
              modelCount: scene.models?.length ?? 0,
              lighting: scene.lighting,
              fog: scene.fog,
              scene: dtoToScene(scene),
              syncedAt
            } }
          }
        }
      }),
      selectedId: comp.id
    }))
    return comp.id
  },

  addIoTComponent: (device, kind, stylePatch) => {
    const s = get()
    const route = s.routes.find((r) => r.id === s.selectedRouteId)
    if (!route || !device?.id) return undefined
    const syncedAt = new Date().toISOString()
    const managed = createIoTComponent(device, kind as IoTWidgetKind)
    const comp: ComponentInstance = {
      ...managed,
      style: stylePatch ? { ...managed.style, ...stylePatch } : managed.style
    }
    const sourceId = comp.props.catalogSourceId
    const previousBindings = isArray(route.state.iotBindings)
      ? route.state.iotBindings as Array<Record<string, unknown>>
      : []
    const binding = {
      deviceId: device.id,
      deviceName: device.name,
      deviceType: device.type,
      status: device.status,
      metricCount: Object.keys(device.metrics ?? {}).length,
      syncedAt
    }
    const nextBindings = previousBindings.some((b) => b.deviceId === device.id)
      ? previousBindings.map((b) => (b.deviceId === device.id ? binding : b))
      : [...previousBindings, binding]
    set((st) => ({
      routes: st.routes.map((r) => {
        if (r.id !== route.id) return r
        const components = sourceId
          ? r.components.map((c) =>
              c.props.catalogSourceId === sourceId
                ? { ...comp, id: c.id, style: c.style }
                : c
            ).concat(sourceId && r.components.some((c) => c.props.catalogSourceId === sourceId) ? [] : [comp])
          : [...r.components, comp]
        return { ...r, components, state: { ...r.state, iotBindings: nextBindings } }
      }),
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

  updateComponentDataSource: (id, binding) =>
    set((s) => ({
      routes: s.routes.map((r) =>
        r.id === s.selectedRouteId
          ? {
              ...r,
              components: r.components.map((c) =>
                c.id === id ? { ...c, dataSource: binding ?? undefined } : c
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

  reorderComponent: (id, index) =>
    set((s) => ({
      routes: s.routes.map((r) => {
        if (r.id !== s.selectedRouteId) return r
        const list = [...r.components]
        const from = list.findIndex((c) => c.id === id)
        if (from < 0) return r
        const [item] = list.splice(from, 1)
        const to = Math.max(0, Math.min(index, list.length))
        list.splice(to, 0, item)
        return { ...r, components: list }
      })
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
  updateTwinSceneEntities: (id, entities, env, annotations?: TwinAnnotation[]) =>
    set((s) => {
      const cur = s.twinScenes[id]
      if (!cur) return s
      return {
        twinScenes: {
          ...s.twinScenes,
          [id]: { ...cur, entities, env, ...(annotations ? { annotations } : {}) }
        }
      }
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
      const catalog = s.catalog.find((meta) => meta.type === c.type)
      const resolvedType = (catalog?.renderer && (catalog.renderer === 'htmlComponent' || catalog.renderer === 'reactComponent')
        ? catalog.renderer
        : type) as ComponentInstance['type']
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
        type: resolvedType,
        style,
        props: {
          ...(clone(def.defaultProps) as Record<string, unknown>),
          ...(c.props || {}),
          ...(catalog
            ? {
                catalogKey: catalog.type,
                catalogName: catalog.name,
                catalogRenderer: catalog.renderer,
                catalogVersion: catalog.version,
                catalogSchemaVersion: catalog.schemaVersion,
                catalogCategory: catalog.category,
              }
            : {}),
        } as WidgetProps,
        ...(c.dataSource ? { dataSource: c.dataSource } : {})
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
