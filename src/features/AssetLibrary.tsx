import { useState } from 'react'
import { Alert, Button, Empty, Input, Spin, Tag as AntTag, Upload } from 'antd'
import { InboxOutlined, ReloadOutlined } from '@ant-design/icons'
import type { UploadProps } from 'antd'
import { useApi } from './useApi'
import { governanceApi } from '../api/governanceResourceApi'
import { FeatureCard, FeatureGrid, PageHeader } from './common'
import { getRouteCapability } from '../data/capabilities'

const TYPE_LABEL: Record<string, string> = { image: '图片', map: '地图', icon: '图标', font: '字体', geojson: 'GeoJSON', model: '模型', file: '文件' }

export default function AssetLibrary() {
  const state = useApi(() => governanceApi.listAssets({ pageSize: 50 }), [])
  const [keyword, setKeyword] = useState('')
  const cap = getRouteCapability('/resources/static')
  const uploadProps: UploadProps = {
    showUploadList: false,
    beforeUpload: async (file) => {
      const response = await governanceApi.uploadAsset(file)
      if (response.code === 0) state.reload()
      return false
    },
  }
  const list = (state.data?.list || []).filter((asset) => !keyword || asset.name.toLowerCase().includes(keyword.toLowerCase()))

  return <div className="feature-page">
    <PageHeader title="静态资源" subtitle={`图片、图标、字体、GeoJSON、模型与插件附件的统一资产中心 · ${cap?.capability || ''}`} actions={<div className="fp-head-actions"><Input allowClear placeholder="搜索资源" value={keyword} onChange={(e) => setKeyword(e.target.value)} /><Button icon={<ReloadOutlined />} onClick={state.reload} aria-label="刷新资产" /><Upload {...uploadProps}><Button type="primary" icon={<InboxOutlined />}>上传资源</Button></Upload></div>} />
    {state.loading && <div className="fp-loading"><Spin size="small" />正在加载资源</div>}
    {state.error && <Alert type="error" showIcon message={state.error} />}
    {!state.loading && !state.error && !list.length && <Empty description="暂无资源，上传第一份素材" />}
    {!state.loading && !state.error && <FeatureGrid>{list.map((asset) => <FeatureCard key={asset.id} media={<div className="feat-thumb" style={{ backgroundImage: asset.url ? `url(${asset.url})` : undefined }}><AntTag>{TYPE_LABEL[asset.type] || asset.type}</AntTag></div>} name={asset.name} category={`${TYPE_LABEL[asset.type] || asset.type} · ${asset.sizeKb}KB`} desc={`更新：${asset.updatedAt}`} onClick={async () => { const refs = await governanceApi.assetReferences(asset.id); if (refs.code === 0 && refs.data.length) window.alert(`该资源有 ${refs.data.length} 个引用`) }} />)}</FeatureGrid>}
  </div>
}
