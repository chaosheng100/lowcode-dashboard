import { Alert, Spin } from 'antd'
import { useApi } from './useApi'
import { api } from '../mock'
import { FeatureCard, FeatureGrid, PageHeader } from './common'
import { getRouteCapability } from '../data/capabilities'

/**
 * 运行配置（/system/runtime）—— 画布"主题能力"的底座。
 * 配置中的主题沉淀为画布配色与全局观感（见 Designer 资源中心"主题"标签）。
 */
export default function RuntimeConfig() {
  const { data, loading, error } = useApi(() => api.listThemes(), [])
  const cap = getRouteCapability('/system/runtime')

  return (
    <div className="feature-page">
      <PageHeader
        title="运行配置 · 主题"
        subtitle={`画布配色与全局观感来源 · ${cap ? `画布能力：${cap.capability}` : ''}`}
        actions={<span className="fp-count">共 {data?.length ?? 0} 套主题</span>}
      />
      {loading && <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>}
      {error && <Alert type="error" showIcon message={error} />}
      {!loading && !error && (
        <FeatureGrid>
          {data!.map((t) => (
            <FeatureCard
              key={t.id}
              media={
                <div className="feat-swatch" style={{ background: t.background, borderColor: t.accent }}>
                  <span className="feat-dot" style={{ background: t.accent }} />
                </div>
              }
              name={t.name}
              category={`主色 ${t.accent}`}
              desc={t.desc}
            />
          ))}
        </FeatureGrid>
      )}
      <p className="fp-sub" style={{ marginTop: 14 }}>
        提示：进入任一「大屏」→ 大屏编辑器 → 左侧「资源」→「主题」，即可将上述主题应用到画布。
      </p>
    </div>
  )
}
