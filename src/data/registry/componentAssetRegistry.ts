import { genId } from '../utils/id'
import type { ComponentInstance, RouteConfig, WidgetProps, WidgetType } from '../types'
import { widgetRegistry } from './widgetRegistry'
import type { WidgetDefDTO } from '../../mock/types'

export interface ComponentAssetDefinition {
  key: string
  name: string
  category: string
  description: string
  type: WidgetType
  businessType: 'general' | 'twin'
  /** AI 生成的 ECharts option JSON（echarts 资产专用） */
  optionJson?: string
  /** AI 生成的源码资产：html/react 组件 */
  sourceCode?: string
  /** 源码运行模式 */
  sandboxMode?: 'sandbox' | 'trusted'
  /** 组件目录渲染原语 */
  rendererType?: string
  /** 组件中心资产 id */
  widgetId?: string
}

const DESCRIPTIONS: Record<WidgetType, string> = {
  text: '标题、说明与状态文字',
  image: '封面、背景与业务图片',
  lineChart: '轻量时序趋势展示',
  barChart: '轻量分类数据对比',
  pieChart: '轻量占比构成分析',
  metric: '关键业务指标展示',
  grid: '结构化多列数据网格，支持数据集绑定与滚动展示',
  table: '历史表格 Schema；加载后自动迁移为数据网格',
  container: '组件分组与布局容器',
  echartLine: '可交互的实时趋势图表',
  echartBar: '可交互的分类对比图表',
  echartPie: '可交互的占比构成图表',
  echartGauge: '目标进度与完成率展示',
  echartRadar: '多维能力与状态评估',
  echartCustom: '基于 ECharts Option 的自定义图表',
  digitalTwin: '嵌入大屏的三维数字孪生场景，支持与大屏图表双向联动',
  twinAlarm: '孪生仿真预测性维护告警清单，点击告警反向定位三维实体',
  htmlComponent: 'AI 生成的独立视觉 HTML，沙箱渲染，不绑定数据集',
  reactComponent: 'AI 生成的独立视觉 React 子集组件，不绑定数据集'
}

export const standardComponentAssets: ComponentAssetDefinition[] = (
  Object.entries(widgetRegistry) as Array<[WidgetType, (typeof widgetRegistry)[WidgetType]]>
)
  .filter(([type]) => type !== 'table')
  .map(([type, definition]) => ({
    key: `standard:${type}`,
    name: definition.name,
    category: definition.category,
    description: DESCRIPTIONS[type],
    type,
    businessType: type === 'digitalTwin' || type === 'twinAlarm' ? 'twin' : 'general'
  }))

/** 组件中心已注册资产（AI 生成的 ECharts / 源码组件）→ 组件库资产定义（与组件库页共用） */
export function registeredAssetsFromWidgets(list: WidgetDefDTO[]): ComponentAssetDefinition[] {
  return (list ?? [])
    .flatMap<ComponentAssetDefinition>((w) => {
      const renderer = w.renderer ?? w.schema?.type
      if ((w.category === 'ECharts' || w.kind === 'echarts') && !!w.optionJson) {
        return [{
          key: `registered:${w.type}`,
          name: w.name,
          category: 'ECharts',
          description: w.desc || 'AI 生成的 ECharts 组件',
          type: 'echartCustom' as const,
          businessType: 'general' as const,
          optionJson: w.optionJson,
          widgetId: w.id ?? w.type,
        }]
      }
      if (renderer === 'htmlComponent' || renderer === 'reactComponent' || !!w.sourceCode || w.schema?.sourceCode) {
        const type = renderer === 'htmlComponent' || w.schema?.type === 'htmlComponent'
          ? 'htmlComponent' as const
          : 'reactComponent' as const
        return [{
          key: `registered:${w.type}`,
          name: w.name,
          category: 'AI 生成',
          description: w.desc || 'AI 生成的源码组件',
          type,
          businessType: 'general' as const,
          sourceCode: w.sourceCode ?? w.schema?.sourceCode,
          sandboxMode: (w.sandboxMode ?? w.schema?.sandboxMode) as 'sandbox' | 'trusted' | undefined,
          rendererType: type,
          widgetId: w.id ?? w.type,
        }]
      }
      return []
    })
}

function cloneProps(props: WidgetProps): WidgetProps {
  return JSON.parse(JSON.stringify(props)) as WidgetProps
}

export function createStandardAssetComponent(asset: ComponentAssetDefinition): ComponentInstance {
  const definition = widgetRegistry[asset.type]
  const props: WidgetProps = {
    ...cloneProps(definition.defaultProps),
    catalogKey: asset.key,
    catalogName: asset.name,
    catalogSourceId: `catalog:${asset.key}`,
    businessType: asset.businessType,
  }
  if (asset.type === 'echartCustom' && asset.optionJson) {
    props.optionJson = asset.optionJson
  }
  if (asset.sourceCode) {
    props.sourceCode = asset.sourceCode
    props.sandboxMode = asset.sandboxMode ?? 'sandbox'
  }
  if (asset.rendererType) {
    props.catalogRenderer = asset.rendererType
    props.catalogSourceId = `catalog:${asset.key}`
  }
  return {
    id: genId(asset.type),
    type: asset.type,
    style: { ...definition.defaultStyle },
    props,
  }
}

/** 按稳定来源键合并受管组件；重复投放保留用户调整过的 id 与布局。 */
export function mergeManagedComponents(
  current: ComponentInstance[],
  managed: ComponentInstance[]
): ComponentInstance[] {
  const managedBySource = new Map(
    managed.map((component) => [component.props.catalogSourceId, component])
  )
  const seen = new Set<string>()
  const components = current.flatMap((component) => {
    const sourceId = component.props.catalogSourceId
    const replacement = sourceId ? managedBySource.get(sourceId) : undefined
    if (!sourceId || !replacement) return [component]
    if (seen.has(sourceId)) return []
    seen.add(sourceId)
    return [{ ...replacement, id: component.id, style: component.style }]
  })
  for (const component of managed) {
    const sourceId = component.props.catalogSourceId
    if (!sourceId || !seen.has(sourceId)) components.push(component)
  }
  return components
}

export function deployStandardAsset(
  route: RouteConfig,
  asset: ComponentAssetDefinition,
  updatedAt = new Date().toISOString()
): Partial<RouteConfig> {
  return {
    components: mergeManagedComponents(route.components, [createStandardAssetComponent(asset)]),
    updatedAt
  }
}

/** 创建 AI 生成的 ECharts 自定义图表组件实例 */
export function createEchartCustomComponent(
  optionJson: string,
  meta?: { key?: string; name?: string }
): ComponentInstance {
  const definition = widgetRegistry.echartCustom
  return {
    id: genId('echartCustom'),
    type: 'echartCustom',
    style: { ...definition.defaultStyle },
    props: {
      ...cloneProps(definition.defaultProps),
      optionJson,
      catalogKey: meta?.key,
      catalogName: meta?.name,
      catalogSourceId: meta?.key ? `catalog:${meta.key}` : undefined,
      businessType: 'general'
    }
  }
}

/** 投放 AI 生成的 ECharts 图表到大屏，重复投放按资产键更新 */
export function deployEchartAsset(
  route: RouteConfig,
  asset: ComponentAssetDefinition,
  updatedAt = new Date().toISOString()
): Partial<RouteConfig> {
  return {
    components: mergeManagedComponents(route.components, [
      createEchartCustomComponent(asset.optionJson ?? '', {
        key: asset.key,
        name: asset.name,
      }),
    ]),
    updatedAt,
  }
}
