import { api } from '../mock'
import { useApi } from './useApi'
import { Tag } from './common'

const MENU: { group: string; items: string[] }[] = [
  { group: '基础组件', items: ['文本', '图片', '指标卡', '表格', '容器'] },
  { group: 'EChart 图表', items: ['折线图', '柱状图', '饼图', '仪表盘', '雷达图', '散点图', '地图'] },
  { group: '自定义组件', items: ['HTML 组件', 'Vue 组件', '源码组件', '任意三方组件'] },
  { group: '3D / 数字孪生', items: ['3D 模型', '悬浮数据卡', '关键帧轨迹'] },
  { group: '动效 / 布局', items: ['滚动播报', '轮播', 'Tab', '排行榜', '装饰边框'] }
]

/** 组件菜单：组件分组与导航，沉淀为画布组件分类 */
export default function ComponentMenuPage() {
  const { data } = useApi(() => api.listWidgets({ pageSize: 50 }), [])
  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">组件菜单</h2>
          <p className="fp-sub">组件分组与导航 · 已纳管 {data?.list.length ?? 0} 个标准组件</p>
        </div>
      </div>
      <div className="grid3">
        {MENU.map((m) => (
          <div key={m.group} className="card">
            <b style={{ color: '#e6edf3' }}>{m.group}</b>
            <div className="flex" style={{ marginTop: 10 }}>
              {m.items.map((it) => <Tag key={it}>{it}</Tag>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
