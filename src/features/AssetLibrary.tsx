import { useApi } from './useApi'
import { api } from '../mock'
import { getRouteCapability } from '../data/capabilities'
import type { AssetType } from '../mock/types'

const TYPE_LABEL: Record<AssetType, string> = { image: '图片', map: '地图', icon: '图标' }

/**
 * 静态资源（/resources/static）—— 画布"素材能力"的底座。
 * 资源可作画布背景或图片组件（见 Designer 资源中心"素材"标签）。
 */
export default function AssetLibrary() {
  const { data, loading, error } = useApi(() => api.listAssets({ pageSize: 50 }), [])
  const cap = getRouteCapability('/resources/static')

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">静态资源</h2>
          <p className="fp-sub">
            画布背景 / 图片组件的素材来源 · {cap ? `画布能力：${cap.capability}` : ''}
          </p>
        </div>
        <span className="fp-count">共 {data?.list.length ?? 0} 个素材</span>
      </div>
      {loading && <div className="fp-loading">加载中…</div>}
      {error && <div className="fp-error">{error}</div>}
      {!loading && !error && (
        <div className="feat-grid">
          {data!.list.map((a) => (
            <div className="feat-card" key={a.id}>
              <div className="feat-thumb" style={{ backgroundImage: `url(${a.url})` }} />
              <div className="feat-name">{a.name}</div>
              <div className="feat-cat">{TYPE_LABEL[a.type]} · {a.sizeKb}KB</div>
              <div className="feat-desc">更新：{a.updatedAt}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
