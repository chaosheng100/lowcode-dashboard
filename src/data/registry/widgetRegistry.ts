import type { WidgetRegistry, WidgetType, WidgetMeta } from '../types'
import { createElement } from 'react'
import {
  PictureOutlined, LineChartOutlined, BarChartOutlined, PieChartOutlined,
  NumberOutlined, TableOutlined, BorderOutlined, DashboardOutlined,
  RadarChartOutlined, SettingOutlined, GlobalOutlined, WarningOutlined,
  CodeOutlined, FileTextOutlined,
} from '@ant-design/icons'

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
    icon: createElement(PictureOutlined),
    category: '基础',
    defaultStyle: { x: 60, y: 140, w: 280, h: 180 },
    defaultProps: { src: 'https://picsum.photos/400/260', fit: 'cover' }
  },
  lineChart: {
    name: '折线图',
    icon: createElement(LineChartOutlined),
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
    icon: createElement(BarChartOutlined),
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
    icon: createElement(PieChartOutlined),
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
    icon: createElement(NumberOutlined),
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
    icon: createElement(TableOutlined),
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
      interactive: true,
      scroll: false,
      scrollSpeed: 30,
      visibleRows: 6,
      pauseOnHover: true
    }
  },
  container: {
    name: '容器',
    icon: createElement(BorderOutlined),
    category: '布局',
    defaultStyle: { x: 60, y: 680, w: 460, h: 200 },
    defaultProps: { label: '分组容器', background: 'rgba(79,140,255,0.05)' }
  },
  // —— ECharts 真实图表（画布内嵌 echarts 实例，支持数据集绑定 / 实时源 / 联动） ——
  echartLine: {
    name: 'ECharts 折线',
    icon: createElement(LineChartOutlined),
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
    icon: createElement(BarChartOutlined),
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
    icon: createElement(PieChartOutlined),
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
    icon: createElement(DashboardOutlined),
    category: 'ECharts',
    defaultStyle: { x: 80, y: 420, w: 320, h: 280 },
    defaultProps: { title: '完成率', color: '#4ade80', gaugeValue: 72, gaugeMax: 100, data: [] }
  },
  echartRadar: {
    name: 'ECharts 雷达',
    icon: createElement(RadarChartOutlined),
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
    icon: createElement(SettingOutlined),
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
  },
  // —— 数字孪生：嵌入大屏的三维场景组件（与大屏图表双向联动） ——
  digitalTwin: {
    name: '数字孪生',
    icon: createElement(GlobalOutlined),
    category: '数字孪生',
    defaultStyle: { x: 80, y: 80, w: 480, h: 360 },
    defaultProps: {
      title: '工厂数字孪生',
      lighting: 'day',
      fog: false,
      showLabels: true,
      showHud: true,
      showControl: true,
      showSim: true,
      autoRotate: false,
      interactive: true,
      filterField: 'entityId',
      sceneId: 'main',
      sourceKind: 'simulated'
    }
  },
  // —— 孪生告警清单：仿真预测性维护产出的告警，点击反向定位 3D 实体 ——
  twinAlarm: {
    name: '孪生告警',
    icon: createElement(WarningOutlined),
    category: '数字孪生',
    defaultStyle: { x: 620, y: 460, w: 360, h: 300 },
    defaultProps: {
      title: '孪生告警清单',
      filterField: 'entityId',
      maxItems: 30
    }
  },
  // —— AI 生成源码组件：HTML 走沙箱 iframe，React 走白名单安全子集 ——
  htmlComponent: {
    name: 'HTML 组件',
    icon: createElement(FileTextOutlined),
    category: 'AI 生成',
    defaultStyle: { x: 80, y: 80, w: 420, h: 280 },
    defaultProps: {
      title: 'AI HTML 组件',
      sourceCode: '<div style="height:100%;display:flex;align-items:center;justify-content:center;font-family:system-ui;background:linear-gradient(135deg,#f5f5f7,#e8e8ed);color:#1d1d1f;border-radius:12px">\n  <div style="text-align:center">\n    <div style="font-size:22px;font-weight:600">AI HTML 组件</div>\n    <div style="margin-top:8px;font-size:13px;color:#6e6e73">window.__DASHBOARD__.data 已注入</div>\n  </div>\n</div>',
      sandboxMode: 'sandbox',
      interactive: true,
      filterField: 'name'
    }
  },
  reactComponent: {
    name: 'React 组件',
    icon: createElement(CodeOutlined),
    category: 'AI 生成',
    defaultStyle: { x: 540, y: 80, w: 420, h: 280 },
    defaultProps: {
      title: 'AI React 组件',
      sourceCode: "export default function AICard({ data, filter, pick }) {\n  const total = data.reduce((s, d) => s + Number(d.value || 0), 0)\n  return (\n    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#f5f5f7', borderRadius: 12, fontFamily: 'system-ui', color: '#1d1d1f' }}>\n      <div style={{ textAlign: 'center' }}>\n        <div style={{ fontSize: 22, fontWeight: 600 }}>AI React 组件</div>\n        <div style={{ marginTop: 8, fontSize: 13, color: '#6e6e73' }}>数据 {data.length} 项 · 合计 {total}</div>\n        <button onClick={() => pick({ field: 'name', value: data[0]?.name || 'A' })} style={{ marginTop: 12, padding: '6px 14px', borderRadius: 8, border: 0, background: '#0071e3', color: '#fff', cursor: 'pointer' }}>联动点击</button>\n      </div>\n    </div>\n  )\n}",
      sandboxMode: 'sandbox',
      interactive: true,
      filterField: 'name'
    }
  }
}

export const widgetCategories: string[] = ['基础', '图表', 'ECharts', '指标', '布局', '数字孪生', 'AI 生成']

export type { WidgetType, WidgetMeta }
