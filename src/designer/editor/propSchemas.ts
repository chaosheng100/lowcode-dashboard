import type { WidgetType, WidgetProps } from '../../data/types'

/**
 * 属性 Schema 定义 —— 对齐 Avue Data 的 AvueForm schema 驱动属性面板。
 * 每个组件类型声明其可配置字段，SchemaForm 据此自动渲染表单，
 * 新增组件只需补一份 schema，无需在 PropertyPanel 手写 if/else。
 */
export type PropFieldType = 'text' | 'number' | 'color' | 'select' | 'textarea' | 'boolean'

export interface PropField {
  key: keyof WidgetProps
  label: string
  type: PropFieldType
  options?: { value: string; label: string }[]
  placeholder?: string
  min?: number
  step?: number
  /** 动态选项来源：由 SchemaForm 从 store 注入（避免 schema 里硬编码数据源列表） */
  dynamicOptions?: 'liveSources' | 'twinScenes' | 'iotDevices' | 'iotMetrics'
  /** 仅当此函数返回 true 时显示该字段 */
  show?: (props: WidgetProps) => boolean
}

/** 样式类字段（渲染在「样式」Tab，位置 X/Y/W/H 之后） */
export const styleSchemas: Partial<Record<WidgetType, PropField[]>> = {
  text: [
    { key: 'content', label: '文本内容', type: 'text' },
    { key: 'fontSize', label: '字号', type: 'number', min: 8, step: 1 },
    { key: 'color', label: '颜色', type: 'color' },
    {
      key: 'align', label: '对齐', type: 'select',
      options: [{ value: 'left', label: '左' }, { value: 'center', label: '中' }, { value: 'right', label: '右' }]
    },
    { key: 'bold', label: '加粗', type: 'boolean' }
  ],
  image: [
    { key: 'src', label: '图片地址', type: 'text' },
    {
      key: 'fit', label: '填充', type: 'select',
      options: [{ value: 'cover', label: 'cover' }, { value: 'contain', label: 'contain' }, { value: 'fill', label: 'fill' }]
    }
  ],
  container: [
    { key: 'label', label: '标题', type: 'text' },
    { key: 'background', label: '背景色', type: 'text' }
  ],
  digitalTwin: [
    { key: 'title', label: '场景标题', type: 'text' },
    { key: 'lighting', label: '光照', type: 'select', options: [{ value: 'day', label: '日照' }, { value: 'night', label: '夜景' }] },
    { key: 'fog', label: '雾效', type: 'boolean' },
    { key: 'showLabels', label: '显示标签', type: 'boolean' },
    { key: 'showHud', label: '显示数据面板', type: 'boolean' },
    { key: 'showControl', label: '显示控制条', type: 'boolean' },
    { key: 'showSim', label: '显示决策沙盘', type: 'boolean' },
    { key: 'autoRotate', label: '相机自动旋转', type: 'boolean' },
    { key: 'sourceKind', label: '数据源类型', type: 'select', options: [{ value: 'simulated', label: '模拟源' }, { value: 'industrial', label: '工业协议' }, { value: 'bim', label: 'BIM' }, { value: 'gis', label: 'GIS' }] }
  ]
}

/** 数据/图表类字段（渲染在「数据」Tab） */
export const dataSchemas: Partial<Record<WidgetType, PropField[]>> = {
  lineChart: [
    { key: 'title', label: '标题', type: 'text' },
    { key: 'color', label: '主色', type: 'color' }
  ],
  barChart: [
    { key: 'title', label: '标题', type: 'text' },
    { key: 'color', label: '主色', type: 'color' }
  ],
  pieChart: [{ key: 'title', label: '标题', type: 'text' }],
  metric: [
    { key: 'label', label: '指标名', type: 'text' },
    { key: 'unit', label: '单位', type: 'text' },
    { key: 'iotDeviceId', label: '物联设备（绑定实时采集值）', type: 'select', dynamicOptions: 'iotDevices' },
    { key: 'iotMetric', label: '设备指标', type: 'select', dynamicOptions: 'iotMetrics', show: (p) => !!p.iotDeviceId },
    { key: 'liveIntervalMs', label: '刷新间隔 (ms)', type: 'number', min: 500, step: 100, show: (p) => !!p.iotDeviceId }
  ],
  table: [{ key: 'title', label: '标题', type: 'text' }],
  echartLine: [
    { key: 'title', label: '标题', type: 'text' },
    { key: 'color', label: '主色', type: 'color' },
    { key: 'smooth', label: '平滑曲线', type: 'boolean' },
    { key: 'showLegend', label: '显示图例', type: 'boolean' },
    { key: 'liveSourceId', label: '实时数据源（SQL/WS/MQTT 经代理推送）', type: 'select', dynamicOptions: 'liveSources' },
    { key: 'liveIntervalMs', label: '刷新间隔 (ms)', type: 'number', min: 300, step: 100, show: (p) => !!p.liveSourceId }
  ],
  echartBar: [
    { key: 'title', label: '标题', type: 'text' },
    { key: 'color', label: '主色', type: 'color' },
    { key: 'showLegend', label: '显示图例', type: 'boolean' },
    { key: 'liveSourceId', label: '实时数据源（SQL/WS/MQTT 经代理推送）', type: 'select', dynamicOptions: 'liveSources' },
    { key: 'liveIntervalMs', label: '刷新间隔 (ms)', type: 'number', min: 300, step: 100, show: (p) => !!p.liveSourceId }
  ],
  echartPie: [
    { key: 'title', label: '标题', type: 'text' },
    { key: 'showLegend', label: '显示图例', type: 'boolean' },
    { key: 'liveSourceId', label: '实时数据源（SQL/WS/MQTT 经代理推送）', type: 'select', dynamicOptions: 'liveSources' },
    { key: 'liveIntervalMs', label: '刷新间隔 (ms)', type: 'number', min: 300, step: 100, show: (p) => !!p.liveSourceId }
  ],
  echartGauge: [
    { key: 'title', label: '标题', type: 'text' },
    { key: 'color', label: '主色', type: 'color' },
    { key: 'gaugeValue', label: '当前值', type: 'number' },
    { key: 'gaugeMax', label: '最大值', type: 'number' }
  ],
  echartRadar: [
    { key: 'title', label: '标题', type: 'text' },
    { key: 'color', label: '主色', type: 'color' }
  ],
  echartCustom: [
    { key: 'optionJson', label: 'ECharts option (JSON，支持任意图表)', type: 'textarea' }
  ],
  digitalTwin: [
    { key: 'sceneId', label: '孪生场景', type: 'select', dynamicOptions: 'twinScenes' },
    { key: 'filterField', label: '联动字段 (filterField)', type: 'text' },
    { key: 'liveSourceId', label: '实时数据源（驱动孪生体指标）', type: 'select', dynamicOptions: 'liveSources' },
    { key: 'liveIntervalMs', label: '刷新间隔 (ms)', type: 'number', min: 300, step: 100, show: (p) => !!p.liveSourceId }
  ],
  twinAlarm: [
    { key: 'title', label: '标题', type: 'text' },
    { key: 'filterField', label: '联动字段 (filterField)', type: 'text' },
    { key: 'maxItems', label: '最大展示条数', type: 'number', min: 1, step: 1 }
  ]
}
