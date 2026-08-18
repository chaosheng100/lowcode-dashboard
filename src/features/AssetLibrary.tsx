import { Alert, Spin } from 'antd'
import { useApi } from './useApi'
import { api } from '../mock'
import { getRouteCapability } from '../data/capabilities'
import { FeatureCard, FeatureGrid, PageHeader } from './common'
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
      <PageHeader
        title="静态资源"
        subtitle={`画布背景 / 图片组件的素材来源 · ${cap ? `画布能力：${cap.capability}` : ''}`}
        actions={<span className="fp-count">共 {data?.list.length ?? 0} 个素材</span>}
      />
      {loading && <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>}
      {error && <Alert type="error" showIcon message={error} />}
      {!loading && !error && (
        <FeatureGrid>
          {data!.list.map((a) => (
            <FeatureCard
              key={a.id}
              media={<div className="feat-thumb" style={{ backgroundImage: `url(${a.url})` }} />}
              name={a.name}
              category={`${TYPE_LABEL[a.type]} · ${a.sizeKb}KB`}
              desc={`更新：${a.updatedAt}`}
            />
          ))}
        </FeatureGrid>
      )}
    </div>
  )
}
