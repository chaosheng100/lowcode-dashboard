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
import TwinWidget from './TwinWidget'
import AlarmListWidget from './AlarmListWidget'
import HtmlComponentWidget from './HtmlComponentWidget'
import ReactComponentWidget from './ReactComponentWidget'
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
  echartCustom: EChartWidget,
  digitalTwin: TwinWidget,
  twinAlarm: AlarmListWidget,
  htmlComponent: HtmlComponentWidget,
  reactComponent: ReactComponentWidget
}

export default function WidgetRenderer({ component, filter, onPick, fieldLabelMap, preview }: WidgetViewProps) {
  const renderer = component.props.catalogRenderer || component.type
  const Cmp = map[renderer as WidgetType] || map[component.type]
  if (!Cmp) {
    return (
      <div style={{ color: '#ff3b30', background: 'rgba(255,59,48,0.06)', borderRadius: 8, padding: 8, fontSize: 12 }}>
        未知组件 · {component.props.catalogName || component.type}（{renderer}）
      </div>
    )
  }
  return <Cmp component={component} filter={filter} onPick={onPick} fieldLabelMap={fieldLabelMap} preview={preview} />
}
