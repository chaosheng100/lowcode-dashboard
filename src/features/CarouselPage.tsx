import { useApi } from './useApi'
import { api } from '../mock'
import { Tag } from './common'

/** 轮播管理：大屏巡播 / 翻页方案，沉淀为画布轮播模板 */
export default function CarouselPage() {
  const { data, loading, error } = useApi(() => api.listCarousels({ pageSize: 50 }), [])
  return (
    <div className="feature-page">
      <div className="fp-head">
        <div><h2 className="fp-title">轮播管理</h2><p className="fp-sub">大屏巡播 / 翻页方案，沉淀为画布轮播模板能力</p></div>
        <span className="fp-count">共 {data?.list.length ?? 0} 个方案</span>
      </div>
      {loading && <div className="fp-loading">加载中…</div>}
      {error && <div className="fp-error">{error}</div>}
      {!loading && !error && (
        <div className="grid3">
          {(data?.list ?? []).map((c) => (
            <div key={c.id} className="card">
              <b style={{ color: '#e6edf3' }}>{c.name}</b>
              <div className="flex" style={{ margin: '8px 0' }}>{c.slides.map((s) => <Tag key={s}>{s}</Tag>)}</div>
              <div className="muted2">切换间隔 {c.intervalSec}s</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
