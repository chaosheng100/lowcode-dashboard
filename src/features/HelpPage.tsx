import { Card, Col, Collapse, Row } from 'antd'
import { Section } from './common'

const FAQ = [
  { q: '如何新建一个大屏？', a: '进入「大屏管理」→ 新建大屏，或在画布中点「＋」从组件面板拖入组件，保存即生成大屏路由。' },
  { q: '组件如何绑定数据？', a: '在属性面板选择数据源 / 数据集，组件即按 data 字段实时取数；支持静态、API、SQL、WebSocket 等来源。' },
  { q: '支持哪些数据库？', a: 'MySQL / SQLServer / PostgreSQL / StarRocks / Oracle，并可通过数据源适配器扩展任意数据库。' },
  { q: '如何二次开发？', a: '「代码仓库」维护源码 / Vue / HTML 片段，可封装为自定义组件；平台提供完整源码与组件注册机制。' },
  { q: '怎样独立部署？', a: '进入「独立部署」导出静态资源 / 数据源配置，或命令行批量构建，独立运行。' }
]

const STEPS = [
  { t: '1 · 配置数据源', d: '数据源配置 / 数据集管理，接入你的业务数据。' },
  { t: '2 · 拖拽编排', d: '大屏管理进入编辑器，从组件库拖入并绑定数据。' },
  { t: '3 · 发布部署', d: '独立部署导出，或在线加密分享。' }
]

/** 帮助中心：平台使用指南与最佳实践 */
export default function HelpPage() {
  return (
    <div className="feature-page">
      <div className="fp-head">
        <div><h2 className="fp-title">帮助中心</h2><p className="fp-sub">平台使用指南、最佳实践与常见问题</p></div>
      </div>
      <Section title="快速上手" desc="三步搭建你的第一个数据大屏">
        <Row gutter={12}>
          {STEPS.map((s) => (
            <Col span={8} key={s.t}>
              <Card size="small" hoverable>
                <b>{s.t}</b>
                <div className="muted2" style={{ marginTop: 6 }}>{s.d}</div>
              </Card>
            </Col>
          ))}
        </Row>
      </Section>
      <Section title="常见问题" desc="FAQ">
        <Collapse
          ghost
          items={FAQ.map((f, i) => ({ key: String(i), label: <b>Q：{f.q}</b>, children: <span className="muted2">A：{f.a}</span> }))}
        />
      </Section>
    </div>
  )
}
