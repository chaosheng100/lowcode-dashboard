import type { WidgetRegistry, WidgetType, WidgetMeta } from '../types'

/**
 * 组件注册表：设计器与渲染器共用。
 * 新增组件只需在此登记默认配置，并在 src/widgets 实现对应组件、在 widgets/WidgetRenderer 注册映射。
 */
export const widgetRegistry: WidgetRegistry = {
  text: {
    name: '文本',
    icon: 'T',
    category: '基础',
    defaultStyle: { x: 60, y: 60, w: 280, h: 56 },
    defaultProps: { content: '数据可视化大屏', fontSize: 22, color: '#e6edf3', align: 'left', bold: true }
  },
  image: {
    name: '图片',
    icon: '🖼',
    category: '基础',
    defaultStyle: { x: 60, y: 140, w: 280, h: 180 },
    defaultProps: { src: 'https://picsum.photos/400/260', fit: 'cover' }
  },
  lineChart: {
    name: '折线图',
    icon: '📈',
    category: '图表',
    defaultStyle: { x: 60, y: 340, w: 460, h: 300 },
    defaultProps: {
      title: '趋势',
      color: '#4f8cff',
      data: [
        { name: '一月', value: 120 },
        { name: '二月', value: 200 },
        { name: '三月', value: 150 },
        { name: '四月', value: 280 }
      ],
      filterField: 'name',
      interactive: false
    }
  },
  barChart: {
    name: '柱状图',
    icon: '📊',
    category: '图表',
    defaultStyle: { x: 560, y: 340, w: 460, h: 300 },
    defaultProps: {
      title: '各区域销量',
      color: '#22d3ee',
      data: [
        { name: '华东', value: 320 },
        { name: '华北', value: 210 },
        { name: '华南', value: 260 },
        { name: '西部', value: 150 }
      ],
      filterField: 'name',
      interactive: true
    }
  },
  pieChart: {
    name: '饼图',
    icon: '🥧',
    category: '图表',
    defaultStyle: { x: 1060, y: 340, w: 360, h: 300 },
    defaultProps: {
      title: '占比',
      data: [
        { name: '产品A', value: 40 },
        { name: '产品B', value: 30 },
        { name: '产品C', value: 20 },
        { name: '其他', value: 10 }
      ],
      filterField: 'name',
      interactive: true
    }
  },
  metric: {
    name: '指标卡',
    icon: '🔢',
    category: '指标',
    defaultStyle: { x: 560, y: 60, w: 280, h: 120 },
    defaultProps: {
      label: '总销量',
      data: [
        { name: '华东', value: 320 },
        { name: '华北', value: 210 },
        { name: '华南', value: 260 },
        { name: '西部', value: 150 }
      ],
      filterField: 'name',
      unit: '件'
    }
  },
  table: {
    name: '表格',
    icon: '▦',
    category: '指标',
    defaultStyle: { x: 1060, y: 60, w: 460, h: 240 },
    defaultProps: {
      title: '明细',
      columns: ['区域', '销量'],
      data: [
        { name: '华东', value: 320 },
        { name: '华北', value: 210 },
        { name: '华南', value: 260 },
        { name: '西部', value: 150 }
      ],
      filterField: 'name',
      interactive: true
    }
  },
  container: {
    name: '容器',
    icon: '▢',
    category: '布局',
    defaultStyle: { x: 60, y: 680, w: 460, h: 200 },
    defaultProps: { label: '分组容器', background: 'rgba(79,140,255,0.05)' }
  },
  // —— ECharts 真实图表（画布内嵌 echarts 实例，支持数据集绑定 / 实时源 / 联动） ——
  echartLine: {
    name: 'ECharts 折线',
    icon: '📉',
    category: 'ECharts',
    defaultStyle: { x: 80, y: 80, w: 460, h: 300 },
    defaultProps: {
      title: '实时趋势', color: '#4f8cff', smooth: true, showLegend: false,
      data: [
        { name: '周一', value: 120 }, { name: '周二', value: 200 }, { name: '周三', value: 150 },
        { name: '周四', value: 280 }, { name: '周五', value: 230 }
      ],
      filterField: 'name', interactive: true
    }
  },
  echartBar: {
    name: 'ECharts 柱状',
    icon: '🏙',
    category: 'ECharts',
    defaultStyle: { x: 580, y: 80, w: 460, h: 300 },
    defaultProps: {
      title: '区域对比', color: '#22d3ee', showLegend: false,
      data: [
        { name: '华东', value: 320 }, { name: '华北', value: 210 },
        { name: '华南', value: 260 }, { name: '西部', value: 150 }
      ],
      filterField: 'name', interactive: true
    }
  },
  echartPie: {
    name: 'ECharts 饼图',
    icon: '🍩',
    category: 'ECharts',
    defaultStyle: { x: 1080, y: 80, w: 380, h: 300 },
    defaultProps: {
      title: '份额占比', showLegend: true,
      data: [
        { name: '产品A', value: 40 }, { name: '产品B', value: 30 },
        { name: '产品C', value: 20 }, { name: '其他', value: 10 }
      ],
      filterField: 'name', interactive: true
    }
  },
  echartGauge: {
    name: 'ECharts 仪表盘',
    icon: '⏲',
    category: 'ECharts',
    defaultStyle: { x: 80, y: 420, w: 320, h: 280 },
    defaultProps: { title: '完成率', color: '#4ade80', gaugeValue: 72, gaugeMax: 100, data: [] }
  },
  echartRadar: {
    name: 'ECharts 雷达',
    icon: '🕸',
    category: 'ECharts',
    defaultStyle: { x: 440, y: 420, w: 380, h: 300 },
    defaultProps: {
      title: '能力评估', color: '#a855f7',
      data: [
        { name: '性能', value: 80 }, { name: '稳定', value: 90 }, { name: '易用', value: 70 },
        { name: '扩展', value: 85 }, { name: '安全', value: 75 }
      ]
    }
  },
  echartCustom: {
    name: 'ECharts 自定义',
    icon: '⚙',
    category: 'ECharts',
    defaultStyle: { x: 860, y: 420, w: 460, h: 300 },
    defaultProps: {
      optionJson: JSON.stringify({
        tooltip: {},
        xAxis: { type: 'category', data: ['A', 'B', 'C'], axisLabel: { color: '#9aa7b4' } },
        yAxis: { type: 'value', axisLabel: { color: '#9aa7b4' } },
        series: [{ type: 'scatter', symbolSize: 18, data: [12, 28, 20], itemStyle: { color: '#f59e0b' } }]
      }, null, 2)
    }
  }
}

export const widgetCategories: string[] = ['基础', '图表', 'ECharts', '指标', '布局']

export type { WidgetType, WidgetMeta }
