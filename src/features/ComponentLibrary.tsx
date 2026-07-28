import { useState } from 'react'
import { api } from '../mock'
import { useApi } from './useApi'
import EChartBox from './EChartBox'
import { Tag } from './common'

type PreviewKind = 'echart' | 'html' | 'vue' | 'three' | 'basic'
interface CatalogItem {
  key: string
  name: string
  category: string
  preview: PreviewKind
  desc: string
  option?: Record<string, unknown>
}

// 海量内置组件（节选代表性样例，可继续扩展）
const CATALOG: CatalogItem[] = [
  { key: 'line', name: '折线图', category: 'EChart', preview: 'echart', desc: '时序趋势', option: { xAxis: { type: 'category', data: ['周一', '周二', '周三', '周四', '周五'], axisLine: { lineStyle: { color: '#5b6b82' } }, axisLabel: { color: '#9fb0c3' } }, yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1b2636' } } }, series: [{ type: 'line', smooth: true, data: [120, 200, 150, 80, 170], areaStyle: { color: 'rgba(79,140,255,.25)' }, itemStyle: { color: '#4f8cff' } }] } },
  { key: 'bar', name: '柱状图', category: 'EChart', preview: 'echart', desc: '分类对比', option: { xAxis: { type: 'category', data: ['华东', '华北', '华南', '西部'], axisLabel: { color: '#9fb0c3' } }, yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1b2636' } } }, series: [{ type: 'bar', data: [320, 210, 260, 150], itemStyle: { color: '#22d3ee', borderRadius: [4, 4, 0, 0] } }] } },
  { key: 'pie', name: '饼图', category: 'EChart', preview: 'echart', desc: '占比构成', option: { series: [{ type: 'pie', radius: ['40%', '70%'], data: [{ value: 40, name: 'A' }, { value: 30, name: 'B' }, { value: 30, name: 'C' }], label: { color: '#cfd9e6' }, color: ['#4f8cff', '#22d3ee', '#a855f7'] }] } },
  { key: 'gauge', name: '仪表盘', category: 'EChart', preview: 'echart', desc: '关键指标', option: { series: [{ type: 'gauge', progress: { show: true }, detail: { color: '#e6edf3' }, data: [{ value: 72, name: '完成率' }], axisLine: { lineStyle: { color: [[1, '#1b2636']] } } }] } },
  { key: 'radar', name: '雷达图', category: 'EChart', preview: 'echart', desc: '多维评估', option: { radar: { indicator: [{ name: '性能' }, { name: '稳定' }, { name: '安全' }, { name: '体验' }], axisName: { color: '#9fb0c3' } }, series: [{ type: 'radar', data: [{ value: [80, 90, 70, 85], areaStyle: { color: 'rgba(168,85,247,.3)' } }] }] } },
  { key: 'scatter', name: '散点图', category: 'EChart', preview: 'echart', desc: '分布关系', option: { xAxis: { type: 'value', splitLine: { lineStyle: { color: '#1b2636' } } }, yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1b2636' } } }, series: [{ type: 'scatter', data: [[10, 20], [30, 50], [50, 30], [70, 80], [90, 40]], itemStyle: { color: '#4ade80' } }] } },
  { key: 'html', name: 'HTML 组件', category: '自定义', preview: 'html', desc: '任意 HTML/CSS/JS 片段' },
  { key: 'vue', name: 'Vue 组件', category: '自定义', preview: 'vue', desc: '导入 .vue 单文件组件' },
  { key: 'src', name: '源码组件', category: '自定义', preview: 'three', desc: 'React/Vue 源码二次开发' },
  { key: 'three', name: '3D 模型', category: '3D', preview: 'three', desc: 'Three.js 在线预览' },
  { key: 'text', name: '文本', category: '基础', preview: 'basic', desc: '标题 / 说明' },
  { key: 'image', name: '图片', category: '基础', preview: 'basic', desc: '封面 / 背景' },
  { key: 'metric', name: '指标卡', category: '基础', preview: 'basic', desc: '关键 KPI' },
  { key: 'table', name: '表格', category: '基础', preview: 'basic', desc: '明细列表' },
  { key: 'container', name: '容器', category: '基础', preview: 'basic', desc: '分组布局' },
  { key: 'marquee', name: '滚动播报', category: '动效', preview: 'basic', desc: '跑马灯 / 轮播' }
]

function Preview({ item }: { item: CatalogItem }) {
  if (item.preview === 'echart' && item.option) return <EChartBox option={item.option} height={150} />
  if (item.preview === 'html') return <div style={{ padding: 14, fontSize: 12, color: '#9fb0c3' }}>&lt;div class="marquee"&gt;实时滚动播报&lt;/div&gt;</div>
  if (item.preview === 'vue') return <div style={{ padding: 14, fontSize: 12, color: '#9fb0c3' }}>&lt;template&gt; &lt;div&gt;&#123;&#123; msg &#125;&#125;&lt;/div&gt; &lt;/template&gt;</div>
  if (item.preview === 'three') return <div style={{ padding: 14, fontSize: 12, color: '#9fb0c3' }}>Three.js 场景 / GLTF 模型预览</div>
  return <div style={{ padding: 14, fontSize: 12, color: '#9fb0c3' }}>{item.desc}</div>
}

/** 组件库：海量内置组件（EChart / HTML / Vue / 源码 / 3D / 基础），画布组件面板的数据来源 */
export default function ComponentLibrary() {
  const { data } = useApi(() => api.listWidgets({ pageSize: 50 }), [])
  const [cat, setCat] = useState<string>('全部')
  const cats = ['全部', ...Array.from(new Set(CATALOG.map((c) => c.category)))]
  const items = CATALOG.filter((c) => cat === '全部' || c.category === cat)

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">组件库</h2>
          <p className="fp-sub">画布组件面板来源 · 已注册 {data?.list.length ?? 0} 个标准组件 + {CATALOG.length} 个内置样例</p>
        </div>
      </div>
      <div className="tabs">
        {cats.map((c) => <span key={c} className={'tab' + (cat === c ? ' active' : '')} onClick={() => setCat(c)}>{c}</span>)}
      </div>
      <div className="grid3">
        {items.map((it) => (
          <div key={it.key} className="card">
            <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
              <b style={{ color: '#e6edf3' }}>{it.name}</b>
              <Tag>{it.category}</Tag>
            </div>
            <div style={{ background: '#0b111b', borderRadius: 8, margin: '10px 0', border: '1px solid #1a2433' }}>
              <Preview item={it} />
            </div>
            <div className="muted2">{it.desc}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
