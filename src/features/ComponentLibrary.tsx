import { useApi } from './useApi'
import { api } from '../mock'
import { getRouteCapability } from '../data/capabilities'

/**
 * 组件库（/components/library）—— 画布"组件能力"的底座。
 * 这里管理的组件，即画布组件面板（Designer 左侧"组件"标签）的数据来源。
 */
export default function ComponentLibrary() {
  const { data, loading, error } = useApi(() => api.listWidgets({ pageSize: 50 }), [])
  const cap = getRouteCapability('/components/library')

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">组件库</h2>
          <p className="fp-sub">
            画布组件面板的数据源 · {cap ? `画布能力：${cap.capability}` : ''}
          </p>
        </div>
        <span className="fp-count">共 {data?.list.length ?? 0} 个组件</span>
      </div>
      {loading && <div className="fp-loading">加载中…</div>}
      {error && <div className="fp-error">{error}</div>}
      {!loading && !error && (
        <div className="feat-grid">
          {data!.list.map((w) => (
            <div className="feat-card" key={w.type}>
              <div className="feat-ico">{w.icon}</div>
              <div className="feat-name">{w.name}</div>
              <div className="feat-cat">{w.category} · v{w.version}</div>
              <div className="feat-desc">{w.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
