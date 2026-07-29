import { genId } from '../utils/id'
import type { ComponentInstance, RouteConfig, WidgetProps, WidgetType } from '../types'
import { widgetRegistry } from './widgetRegistry'

export interface ComponentAssetDefinition {
  key: string
  name: string
  category: string
  description: string
  type: WidgetType
  businessType: 'general' | 'twin'
}

const DESCRIPTIONS: Record<WidgetType, string> = {
  text: '标题、说明与状态文字',
  image: '封面、背景与业务图片',
  lineChart: '轻量时序趋势展示',
  barChart: '轻量分类数据对比',
  pieChart: '轻量占比构成分析',
  metric: '关键业务指标展示',
  table: '结构化明细数据展示',
  container: '组件分组与布局容器',
  echartLine: '可交互的实时趋势图表',
  echartBar: '可交互的分类对比图表',
  echartPie: '可交互的占比构成图表',
  echartGauge: '目标进度与完成率展示',
  echartRadar: '多维能力与状态评估',
  echartCustom: '基于 ECharts Option 的自定义图表',
  digitalTwin: '嵌入大屏的三维数字孪生场景，支持与大屏图表双向联动',
  twinAlarm: '孪生仿真预测性维护告警清单，点击告警反向定位三维实体'
}

export const standardComponentAssets: ComponentAssetDefinition[] = (
  Object.entries(widgetRegistry) as Array<[WidgetType, (typeof widgetRegistry)[WidgetType]]>
).map(([type, definition]) => ({
  key: `standard:${type}`,
  name: definition.name,
  category: definition.category,
  description: DESCRIPTIONS[type],
  type,
  businessType: type === 'digitalTwin' || type === 'twinAlarm' ? 'twin' : 'general'
}))

function cloneProps(props: WidgetProps): WidgetProps {
  return JSON.parse(JSON.stringify(props)) as WidgetProps
}

export function createStandardAssetComponent(asset: ComponentAssetDefinition): ComponentInstance {
  const definition = widgetRegistry[asset.type]
  return {
    id: genId(asset.type),
    type: asset.type,
    style: { ...definition.defaultStyle },
    props: {
      ...cloneProps(definition.defaultProps),
      catalogKey: asset.key,
      catalogName: asset.name,
      catalogSourceId: `catalog:${asset.key}`,
      businessType: asset.businessType
    }
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
