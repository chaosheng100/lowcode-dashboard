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
  }
}

export const widgetCategories: string[] = ['基础', '图表', '指标', '布局']

export type { WidgetType, WidgetMeta }
