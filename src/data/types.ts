// ============================================================
// 统一类型定义 —— 整个设计器共用，保证设计态/运行态类型一致
// ============================================================

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

/** 图表数据位点 */
export interface DataPoint {
  name: string
  value: number
}

/** 组件通用 props —— 所有字段可选，运行时按类型读取 */
export interface WidgetProps {
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
  /** 实时刷新间隔 ms（轮询型） */
  liveIntervalMs?: number
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
  props: WidgetProps
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
  icon: string
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

  // 视图 / 选择
  setMode: (mode: 'project' | 'preview') => void
  selectRoute: (id: string) => void
  select: (id: string | null) => void

  // 路由树操作
  addRoute: (parentId?: string | null) => string
  deleteRoute: (id: string) => void
  updateRoute: (id: string, patch: Partial<RouteConfig>) => void
  /** 跨窗口同步：用整条远端路由替换（预览端应用，不触发广播） */
  upsertRoute: (route: RouteConfig) => void
  /** 新建一个大屏路由（dashboard 类型），返回其 id */
  createDashboard: (name?: string) => string

  // 组件操作（作用于当前选中路由）
  addComponent: (type: WidgetType, stylePatch?: Partial<ComponentStyle>) => string | undefined
  removeComponent: (id: string) => void
  updateComponentProps: (id: string, patch: Partial<WidgetProps>) => void
  updateComponentStyle: (id: string, patch: Partial<ComponentStyle>) => void
  moveComponent: (id: string, x: number, y: number) => void

  // 当前路由页面设置
  setPage: (patch: Partial<PageConfig>) => void

  // 联动筛选
  setFilter: (filter: Filter) => void
  clearFilter: () => void

  // 项目级操作
  loadProject: (project: Partial<DashboardProject>) => void
  exportProject: () => DashboardProject
  clearAll: () => void
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
