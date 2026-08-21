// ============================================================
// 统一类型定义 —— 整个设计器共用，保证设计态/运行态类型一致
// ============================================================

import type { TwinScene } from '../twin/twinTypes'
import type { ReactNode } from 'react'
import type { ComponentMetaDTO, IoTDeviceDTO, TwinSceneDTO, WidgetDefDTO } from '../mock/types'

/** 组件类型（与组件注册表、渲染映射一一对应） */
export type WidgetType =
  | 'text'
  | 'image'
  | 'lineChart'
  | 'barChart'
  | 'pieChart'
  | 'metric'
  | 'table'
  | 'container'
  // ECharts 真实图表组件（画布内嵌 echarts 实例）
  | 'echartLine'
  | 'echartBar'
  | 'echartPie'
  | 'echartGauge'
  | 'echartRadar'
  | 'echartCustom'
  // 数字孪生（嵌入大屏的三维场景组件）
  | 'digitalTwin'
  // 数字孪生告警清单（仿真预测性维护产出，联动反向定位）
  | 'twinAlarm'
  // AI 助手生成的 HTML / React 组件（源码资产，沙箱或安全子集渲染）
  | 'htmlComponent'
  | 'reactComponent'

/** 图表数据位点 */
export interface DataPoint {
  name: string
  value: number
}

/** 组件通用 props —— 所有字段可选，运行时按类型读取 */
export interface WidgetProps {
  /** 组件库资产定义键，用于识别组件来源与业务类型 */
  catalogKey?: string
  catalogName?: string
  /** 同一资产在目标大屏中的稳定实例键，用于幂等投放 */
  catalogSourceId?: string
  businessType?: 'general' | 'twin'
  /** 组件目录来源：后端 ComponentMeta.type */
  catalogRenderer?: string
  catalogVersion?: string
  catalogSchemaVersion?: number
  catalogCategory?: string
  // 文本
  content?: string
  fontSize?: number
  color?: string
  align?: 'left' | 'center' | 'right'
  bold?: boolean
  // 图片
  src?: string
  fit?: 'cover' | 'contain' | 'fill'
  // 图表 / 指标 / 表格
  title?: string
  data?: DataPoint[]
  filterField?: string
  interactive?: boolean
  /** 绑定的数据集（数据源 → 画布）：由资源中心/属性面板设置 */
  dataSourceId?: string
  dataSourceName?: string
  // 指标卡
  label?: string
  unit?: string
  // 表格
  columns?: string[]
  // 容器
  background?: string
  // ECharts 组件
  /** echartCustom：完整 ECharts option（JSON 字符串，支持任意图表） */
  optionJson?: string
  /** 是否平滑（折线） */
  smooth?: boolean
  /** 是否显示图例 */
  showLegend?: boolean
  /** 仪表盘当前值 / 最大值 */
  gaugeValue?: number
  gaugeMax?: number
  /** 实时数据：绑定后端代理数据源 id（SQL/WS/MQTT），非空时组件自动订阅实时值 */
  liveSourceId?: string
  /** 物联设备绑定：由物联组态同步到大屏 */
  iotDeviceId?: string
  iotMetric?: string
  /** 实时刷新间隔 ms（轮询型） */
  liveIntervalMs?: number
  // 数字孪生组件
  /** 光照：日照/夜景 */
  lighting?: 'day' | 'night'
  /** 雾效 */
  fog?: boolean
  /** 显示实体标签 */
  showLabels?: boolean
  /** 显示数据面板（HUD） */
  showHud?: boolean
  /** 相机自动旋转 */
  autoRotate?: boolean
  /** 关联的孪生场景 id（MVP 用默认演示场景） */
  sceneId?: string
  /** 多源接入类型：simulated / industrial / bim / gis（进阶多源适配器） */
  sourceKind?: 'simulated' | 'industrial' | 'bim' | 'gis'
  /** 显示闭环控制条 */
  showControl?: boolean
  /** 显示 What-if 决策沙盘 */
  showSim?: boolean
  /** 最大展示条数 */
  maxItems?: number
  /** 预览态：组件库预览/占位演示时使用静态数据，不向后端发起实时请求 */
  preview?: boolean
  /** AI 生成组件源码：htmlComponent 为完整 HTML 文档/片段，reactComponent 为 TSX */
  sourceCode?: string
  /** 源码运行模式：sandbox=沙箱隔离；trusted=信任源码（仅内网/审核后使用） */
  sandboxMode?: 'sandbox' | 'trusted'
  /** AI 产物声明的数据/交互契约，供属性面板与运行时校验 */
  dataSchema?: Record<string, unknown>
  /** 声明式事件配置：pick 事件发送的联动字段与值表达式 */
  eventConfig?: {
    pick?: {
      field?: string
      valueExpr?: string
    }
  }
}

/** CSS 风格定位尺寸（画布坐标系，单位 px） */
export interface ComponentStyle {
  x: number
  y: number
  w: number
  h: number
}

/** 画布（页面）配置 */
export interface PageConfig {
  width: number
  height: number
  /** 背景色（CSS 颜色值，支持 #hex / rgba） */
  background: string
  /** 背景图片（dataURL 或 URL），为空则无背景图 */
  backgroundImage?: string
  /** 背景图填充方式：拉伸 / 平铺 / 居中 / 覆盖 */
  backgroundImageFit?: 'stretch' | 'tile' | 'center' | 'cover'
  /** 背景图透明度 0~1 */
  backgroundImageOpacity?: number
  /** 手动缩放比（fit=false 时生效） */
  scale: number
  /** true=自动适配容器尺寸；false=使用 scale 手动缩放 */
  fit: boolean
}

/** 单个组件实例 */
export interface ComponentInstance {
  id: string
  type: WidgetType
  style: ComponentStyle
  dataSource?: ComponentDataBinding
  props: WidgetProps
}

/** 组件数据集绑定：语义字段映射 + 结构化 dataSource，与后端 NormalizedSchema 对齐 */
export interface ComponentDataBinding {
  /** 绑定的数据集 id */
  datasetId: string
  /** 维度字段 fieldKey（类目/横轴/标签） */
  xField?: string
  /** 指标字段 fieldKey（数值/纵轴/值） */
  yField?: string
  /** 多指标（多折线/多柱图等） */
  yFields?: string[]
  /** 筛选条件 */
  filters?: Array<{ field: string; op: string; value: unknown }>
  /** 聚合方式，覆盖数据集默认聚合 */
  aggregation?: string
  /** 绑定的数据集名称（冗余，方便 UI 展示） */
  datasetName?: string
}

/** 联动规则（可扩展：源事件 -> 目标动作） */
export interface LinkTarget {
  componentId: string
  action: string
  params?: Record<string, unknown>
}
export interface Link {
  id: string
  source: { componentId: string; event: string }
  trigger?: { payload?: unknown }
  targets: LinkTarget[]
}

/** 路由种类：基础数据路由（为画布提供底座支持）/ 大屏路由（可在大屏编辑器独立编辑） */
export type RouteKind = 'data' | 'dashboard'

/** 一条路由 / 页面 —— 即一个独立的设计单元 */
export interface RouteConfig {
  id: string
  name: string
  path: string
  parentId: string | null
  /** 路由分类：'data'=基础数据路由；'dashboard'=大屏路由（进入大屏编辑器编辑） */
  kind: RouteKind
  /** 创建时间（ISO 字符串），用于大屏管理列表排序 */
  createdAt: string
  /** 最后修改时间（ISO 字符串），用于大屏管理列表排序 */
  updatedAt: string
  /** 缩略图：CSS 渐变字符串或图片 URL，用于大屏管理列表预览 */
  thumbnail?: string
  params: Record<string, unknown>
  props: Record<string, unknown>
  state: Record<string, unknown>
  page: PageConfig
  components: ComponentInstance[]
  links: Link[]
}

/** 整个项目（导出/导入的 JSON 结构） */
export interface DashboardProject {
  version: string
  routes: RouteConfig[]
}

/** 联动全局筛选 */
export interface Filter {
  field: string
  value: string
}

/** 联动事件 */
export interface LinkageEvent {
  componentId: string
  type: string
  payload?: unknown
}

/** 组件注册表条目 */
export interface WidgetMeta {
  name: string
  icon: ReactNode
  category: string
  defaultStyle: ComponentStyle
  defaultProps: WidgetProps
}
export type WidgetRegistry = Record<WidgetType, WidgetMeta>

/** 设计器全局状态（Zustand store） */
export interface DesignerState {
  mode: 'project' | 'preview'
  routes: RouteConfig[]
  selectedRouteId: string
  selectedId: string | null
  filter: Filter | null

  // 组件目录缓存（后端 ComponentMeta 唯一来源）
  catalog: ComponentMetaDTO[]
  catalogLoading: boolean
  catalogError: string | null

  // 组件中心已注册资产（AI 生成的 ECharts / 源码组件，与组件库页共用）
  registeredWidgets: WidgetDefDTO[]
  widgetsLoading: boolean

  // 孪生/物联资产数据（左侧组件面板「组件库全量组件」数据源）
  twinScenesMeta: Record<string, unknown>
  iotDevicesMeta: IoTDeviceDTO[]
  twinMetaLoading: boolean
  iotMetaLoading: boolean
  upsertTwinScenesMeta: (snapshots: Record<string, unknown>) => void
  removeTwinScenesMeta: (id: string) => void
  setIotDevicesMeta: (list: IoTDeviceDTO[]) => void

  // 视图 / 选择
  setMode: (mode: 'project' | 'preview') => void
  selectRoute: (id: string) => void
  select: (id: string | null) => void

  // 组件目录（含孪生/物联资产数据）
  loadCatalog: () => Promise<void>
  loadCatalogAssets: () => Promise<void>

  // 路由树操作
  addRoute: (parentId?: string | null) => string
  deleteRoute: (id: string) => void
  updateRoute: (id: string, patch: Partial<RouteConfig>) => void
  /** 跨窗口同步：用整条远端路由替换（预览端应用，不触发广播） */
  upsertRoute: (route: RouteConfig) => void

  // 组件操作（作用于当前选中路由）
  addComponent: (
    type: WidgetType,
    stylePatch?: Partial<ComponentStyle>,
    propsPatch?: Partial<WidgetProps>,
    preset?: { type: WidgetType; props?: WidgetProps },
    meta?: ComponentMetaDTO,
  ) => string | undefined
  /** 左侧面板拖入孪生业务组件：创建实例 + 持久化场景快照到路由 state */
  addTwinCatalogComponent: (
    scene: TwinSceneDTO,
    kind: 'summary' | 'models' | 'geometry' | 'scene',
    stylePatch?: Partial<ComponentStyle>,
  ) => string | undefined
  /** 左侧面板拖入物联组态组件：创建实例 + 持久化设备绑定到路由 state */
  addIoTComponent: (
    device: IoTDeviceDTO,
    kind: 'summary' | 'metrics' | 'alarm',
    stylePatch?: Partial<ComponentStyle>,
  ) => string | undefined
  removeComponent: (id: string) => void
  updateComponentProps: (id: string, patch: Partial<WidgetProps>) => void
  updateComponentStyle: (id: string, patch: Partial<ComponentStyle>) => void
  moveComponent: (id: string, x: number, y: number) => void
  reorderComponent: (id: string, index: number) => void
  updateComponentDataSource: (id: string, binding: ComponentDataBinding | null) => void

  // 当前路由页面设置
  setPage: (patch: Partial<PageConfig>) => void

  // 联动筛选
  setFilter: (filter: Filter) => void
  clearFilter: () => void

  // 数字孪生场景库（模块编辑器与大屏数字孪生组件共享）
  twinScenes: Record<string, TwinScene>
  activeTwinSceneId: string
  setActiveTwinScene: (id: string) => void
  upsertTwinScene: (scene: TwinScene) => void
  updateTwinSceneEntities: (
    id: string,
    entities: TwinScene['entities'],
    env: TwinScene['env'],
    annotations?: TwinScene['annotations']
  ) => void
  addTwinScene: (name: string) => string
  removeTwinScene: (id: string) => void
  renameTwinScene: (id: string, name: string) => void

  // 项目级操作
  loadProject: (project: Partial<DashboardProject>) => void
  exportProject: () => DashboardProject
  clearAll: () => void

  // AI 设计：把自然语言生成的大屏 Schema 应用到画布
  applyAISchema: (schema: AIDesignSchema) => void
}

/** 当前选中的路由便捷读取 */
export interface RouteConfigPanelProps {
  route: RouteConfig
}

/** 单个组件在画布中的渲染属性（设计态/运行态共用） */
export interface WidgetViewProps {
  component: ComponentInstance
  filter?: Filter | null
  onPick?: ((filter: Filter) => void) | null
}

// ============================================================
// AI 设计（自然语言 → 大屏 Schema）—— 前端与后端 /api/ai/design 对齐
// ============================================================

/** 后端归一化 Schema 中的单个组件（renderer 仅后端用，前端按 type 渲染） */
export interface AIDesignComponent {
  id?: string
  type: string
  renderer?: string
  style?: { x: number; y: number; w: number; h: number }
  props?: Record<string, unknown>
  dataSource?: ComponentDataBinding
}

/** 后端 /api/ai/design 归一化后的大屏 Schema */
export interface AIDesignSchema {
  version: string
  page?: { width: number; height: number; background: string }
  components: AIDesignComponent[]
  links?: unknown[]
}

/** Orchestrator 反推的结构化设计意图（前端「过程纠偏」面板展示） */
export interface AIDesignIntent {
  summary: string
  metrics: string[]
  dimensions: string[]
  components: Array<{ type: string; title: string; hasData: boolean }>
}

/** ReviewAgent 结构校验结果 */
export interface AIDesignReview {
  issues: string[]
}

/** DataAgent 数据绑定结果（数据集语义绑定优先，兼容旧数据源绑定） */
export interface AIDesignData {
  /** 绑定的数据集 id（数据集语义绑定） */
  datasetId?: string
  /** 绑定的数据集名称 */
  datasetName?: string
  /** 绑定的数据源 id（旧版绑定） */
  dataSourceId?: string
  rowCount: number
  columns: string[]
}
