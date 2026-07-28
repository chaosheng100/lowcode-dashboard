import type { ComponentType } from 'react'
import TextWidget from './TextWidget'
import ImageWidget from './ImageWidget'
import LineChart from './LineChart'
import BarChart from './BarChart'
import PieChart from './PieChart'
import MetricWidget from './MetricWidget'
import TableWidget from './TableWidget'
import ContainerWidget from './ContainerWidget'
import EChartWidget from './EChartWidget'
import type { WidgetType, WidgetViewProps } from '../../data/types'

const map: Record<WidgetType, ComponentType<WidgetViewProps>> = {
  text: TextWidget,
  image: ImageWidget,
  lineChart: LineChart,
  barChart: BarChart,
  pieChart: PieChart,
  metric: MetricWidget,
  table: TableWidget,
  container: ContainerWidget,
  echartLine: EChartWidget,
  echartBar: EChartWidget,
  echartPie: EChartWidget,
  echartGauge: EChartWidget,
  echartRadar: EChartWidget,
  echartCustom: EChartWidget
}

export default function WidgetRenderer({ component, filter, onPick }: WidgetViewProps) {
  const Cmp = map[component.type]
  if (!Cmp) return <div style={{ color: '#ff5d5d', padding: 8 }}>未知组件: {component.type}</div>
  return <Cmp component={component} filter={filter} onPick={onPick} />
}
