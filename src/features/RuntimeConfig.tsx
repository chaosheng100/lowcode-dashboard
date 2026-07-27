import { useApi } from './useApi'
import { api } from '../mock'
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
      <div className="fp-head">
        <div>
          <h2 className="fp-title">运行配置 · 主题</h2>
          <p className="fp-sub">
            画布配色与全局观感来源 · {cap ? `画布能力：${cap.capability}` : ''}
          </p>
        </div>
        <span className="fp-count">共 {data?.length ?? 0} 套主题</span>
      </div>
      {loading && <div className="fp-loading">加载中…</div>}
      {error && <div className="fp-error">{error}</div>}
      {!loading && !error && (
        <div className="feat-grid">
          {data!.map((t) => (
            <div className="feat-card" key={t.id}>
              <div className="feat-swatch" style={{ background: t.background, borderColor: t.accent }}>
                <span className="feat-dot" style={{ background: t.accent }} />
              </div>
              <div className="feat-name">{t.name}</div>
              <div className="feat-cat">主色 {t.accent}</div>
              <div className="feat-desc">{t.desc}</div>
            </div>
          ))}
        </div>
      )}
      <p className="fp-sub" style={{ marginTop: 14 }}>
        提示：进入任一「大屏」→ 大屏编辑器 → 左侧「资源」→「主题」，即可将上述主题应用到画布。
      </p>
    </div>
  )
}
