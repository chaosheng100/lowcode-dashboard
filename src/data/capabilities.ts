// ============================================================
// 能力映射模型（设计层）
// 前提：现有路由一切功能的基础能力，都能转化为「画布编辑」所需要的功能。
// 本文件把每个基础数据路由显式映射到它为大屏编辑器提供的画布能力，
// 并作为「能力中心」的可视化与消费依据（见 Designer 资源面板 / 能力映射弹窗）。
// ============================================================

/** 大屏画布编辑器所需的能力类型 */
export type CanvasCapability =
  | 'widget' // 组件能力：可拖入画布的组件
  | 'dataSource' // 数据源能力：画布组件的数据来路
  | 'dataset' // 数据集能力：可直接绑定的分析数据
  | 'asset' // 素材能力：背景图 / 图标 / 地图底图
  | 'theme' // 主题能力：画布配色与全局观感
  | 'variable' // 变量能力：跨组件全局变量绑定
  | 'template' // 模板能力：轮播 / 标签 / 布局模板
  | 'permission' // 权限能力：编辑器协作与可见性
  | 'extension' // 扩展能力：孪生 / 组态 / 插件 / 部署
  | 'ai' // 智能能力：模型 / 助手辅助编排
  | 'publish' // 发布能力：大屏部署与对外发布
  | 'analytics' // 分析能力：画布运行监控与优化
  | 'doc' // 文档能力：帮助与最佳实践沉淀

/** 每种画布能力的元信息（标签 / 图标 / 说明） */
export interface CapabilityMeta {
  label: string
  icon: string
  desc: string
}

export const CAPABILITY_META: Record<CanvasCapability, CapabilityMeta> = {
  widget: { label: '组件', icon: '🧩', desc: '为画布提供可拖拽的可视化组件（文本/图表/指标/表格/容器等）' },
  dataSource: { label: '数据源', icon: '🗄️', desc: '为画布组件提供连接与取数的数据来路（库/API/消息/文件）' },
  dataset: { label: '数据集', icon: '📊', desc: '为图表/表格/指标卡提供可直接绑定的分析数据' },
  asset: { label: '素材', icon: '🖼️', desc: '为画布提供背景图、图标与地图底图等视觉素材' },
  theme: { label: '主题', icon: '🎨', desc: '为画布提供配色方案与全局观感（运行配置沉淀）' },
  variable: { label: '变量', icon: '🧮', desc: '为画布提供跨组件全局变量，支持动态绑定与联动' },
  template: { label: '模板', icon: '📐', desc: '为画布提供轮播、标签分类与布局模板，加速编排' },
  permission: { label: '权限', icon: '🔐', desc: '为画布编辑器提供协作角色与可见性控制' },
  extension: { label: '扩展', icon: '🔌', desc: '为画布提供孪生/组态/插件/部署等扩展能力' },
  ai: { label: '智能', icon: '🤖', desc: '为画布提供模型与助手，辅助智能编排与生成' },
  publish: { label: '发布', icon: '🚀', desc: '将画布成果部署、发布为可访问的大屏' },
  analytics: { label: '分析', icon: '📈', desc: '对画布运行态进行监控与性能/异常分析' },
  doc: { label: '文档', icon: '❓', desc: '为画布编辑提供帮助文档与最佳实践' }
}

/** 单条路由 → 画布能力 的映射（即"基础能力转化为画布功能"的设计依据） */
export interface RouteCapability {
  routeId: string
  routeName: string
  domain: string // 一级业务域
  capability: CanvasCapability
  /** 该路由的基础能力如何转化为画布编辑功能 */
  description: string
}

/**
 * 全部基础数据路由（36 条）的能力映射。
 * 每条路由都被显式声明为某一种画布能力的来源，证明"基础能力皆可转化为画布功能"的前提。
 */
export const routeCapabilities: RouteCapability[] = [
  // —— 大屏管理 ——
  { routeId: '/dashboard', routeName: '大屏管理', domain: '大屏管理', capability: 'publish', description: '大屏列表与编排入口，产出即画布；新建/打开大屏即进入画布编辑器。' },

  // —— 生态扩展 ——
  { routeId: '/extension', routeName: '生态扩展', domain: '生态扩展', capability: 'extension', description: '扩展能力总览，为画布提供孪生/组态/部署等扩展组件底座。' },
  { routeId: '/extension/report', routeName: '报表管理', domain: '生态扩展', capability: 'extension', description: '报表组件可作为画布中的嵌入式报表视图。' },
  { routeId: '/extension/carousel', routeName: '轮播管理', domain: '生态扩展', capability: 'template', description: '轮播方案沉淀为画布轮播/翻页模板能力。' },
  { routeId: '/extension/twin', routeName: '数字孪生', domain: '生态扩展', capability: 'extension', description: '孪生场景转化为画布 3D/实时孪生组件。' },
  { routeId: '/extension/deploy', routeName: '独立部署', domain: '生态扩展', capability: 'publish', description: '将画布成果独立部署发布为对外大屏。' },
  { routeId: '/extension/iot', routeName: '物联组态', domain: '生态扩展', capability: 'extension', description: '物联组态点位驱动画布实时组件与告警。' },

  // —— 数据管理 ——
  { routeId: '/data', routeName: '数据管理', domain: '数据管理', capability: 'dataset', description: '数据能力总入口，统一供给画布所需分析数据。' },
  { routeId: '/data/source', routeName: '数据源配置', domain: '数据管理', capability: 'dataSource', description: '配置的数据源成为画布组件取数的来路。' },
  { routeId: '/data/dataset', routeName: '数据集管理', domain: '数据管理', capability: 'dataset', description: '数据集可在画布中直接绑定到图表/表格/指标卡。' },
  { routeId: '/data/entry', routeName: '数据填报', domain: '数据管理', capability: 'dataset', description: '填报采集的数据回灌为画布可绑定的数据集。' },
  { routeId: '/data/channel', routeName: '消息通道', domain: '数据管理', capability: 'extension', description: '消息通道为画布提供实时推送与联动触发。' },
  { routeId: '/data/workflow', routeName: '数据工作流', domain: '数据管理', capability: 'dataset', description: '工作流加工后的结果作为画布数据集来源。' },

  // —— 组件中心 ——
  { routeId: '/components', routeName: '组件中心', domain: '组件中心', capability: 'widget', description: '组件能力总览，画布组件面板的数据来源。' },
  { routeId: '/components/library', routeName: '组件库', domain: '组件中心', capability: 'widget', description: '组件库即画布组件面板，组件可直接拖入画布。' },
  { routeId: '/components/menu', routeName: '组件菜单', domain: '组件中心', capability: 'widget', description: '组件分组/菜单沉淀为画布组件分类与导航。' },

  // —— AI 智能 ——
  { routeId: '/ai', routeName: 'AI智能', domain: 'AI智能', capability: 'ai', description: 'AI 能力总入口，辅助画布智能编排。' },
  { routeId: '/ai/models', routeName: '模型管理', domain: 'AI智能', capability: 'ai', description: '模型可驱动画布智能组件（预测/识别/推荐）。' },
  { routeId: '/ai/assistant', routeName: 'AI助手', domain: 'AI智能', capability: 'ai', description: '助手提供画布布局/配色/数据的智能生成建议。' },

  // —— 开发工具 ——
  { routeId: '/dev', routeName: '开发工具', domain: '开发工具', capability: 'variable', description: '开发能力总入口，承接画布变量与自定义组件。' },
  { routeId: '/dev/code', routeName: '代码仓库', domain: '开发工具', capability: 'variable', description: '仓库中的代码片段可封装为画布自定义组件。' },
  { routeId: '/dev/variables', routeName: '全局变量', domain: '开发工具', capability: 'variable', description: '全局变量可在画布中跨组件绑定与联动。' },

  // —— 资源管理 ——
  { routeId: '/resources', routeName: '资源管理', domain: '资源管理', capability: 'asset', description: '素材能力总入口，统一供给画布视觉素材。' },
  { routeId: '/resources/static', routeName: '静态资源', domain: '资源管理', capability: 'asset', description: '静态资源（图/图标）可作为画布背景或图片组件。' },
  { routeId: '/resources/map', routeName: '地图资源', domain: '资源管理', capability: 'asset', description: '地图底图作为画布地理可视化背景与底图组件。' },

  // —— 系统管理 ——
  { routeId: '/system', routeName: '系统管理', domain: '系统管理', capability: 'permission', description: '系统能力总入口，提供画布编辑器协作与治理。' },
  { routeId: '/system/tags', routeName: '分类标签', domain: '系统管理', capability: 'template', description: '标签分类沉淀为画布主题/分组模板。' },
  { routeId: '/system/runtime', routeName: '运行配置', domain: '系统管理', capability: 'theme', description: '运行配置中的主题沉淀为画布配色与全局观感。' },
  { routeId: '/system/users', routeName: '用户管理', domain: '系统管理', capability: 'permission', description: '用户与角色决定画布编辑器的协作权限与可见性。' },
  { routeId: '/system/analysis', routeName: '大屏分析', domain: '系统管理', capability: 'analytics', description: '分析能力对画布运行态做监控与性能/异常分析。' },

  // —— 插件管理 ——
  { routeId: '/plugins', routeName: '插件管理', domain: '插件管理', capability: 'extension', description: '插件能力总入口，扩展画布组件生态。' },
  { routeId: '/plugins/mine', routeName: '我的插件', domain: '插件管理', capability: 'extension', description: '自有插件封装为画布可复用组件。' },
  { routeId: '/plugins/market', routeName: '插件市场', domain: '插件管理', capability: 'extension', description: '市场插件一键安装为画布组件能力。' },

  // —— 帮助中心 ——
  { routeId: '/help', routeName: '帮助中心', domain: '帮助中心', capability: 'doc', description: '帮助文档沉淀为画布编辑的最佳实践与引导。' },

  // —— 其他系统 ——
  { routeId: '/others', routeName: '其他系统', domain: '其他系统', capability: 'extension', description: '外部系统能力可作为画布数据/组件扩展来源。' },
  { routeId: '/others/ai-platform', routeName: 'AI模型平台', domain: '其他系统', capability: 'ai', description: '外部 AI 平台模型接入画布智能组件。' }
]

/** 按路由 id 取能力映射 */
export function getRouteCapability(routeId: string): RouteCapability | undefined {
  return routeCapabilities.find((r) => r.routeId === routeId)
}

/** 按画布能力聚合路由 */
export function routesByCapability(): Record<CanvasCapability, RouteCapability[]> {
  const map = {} as Record<CanvasCapability, RouteCapability[]>
  ;(Object.keys(CAPABILITY_META) as CanvasCapability[]).forEach((k) => {
    map[k] = []
  })
  routeCapabilities.forEach((r) => map[r.capability].push(r))
  return map
}
