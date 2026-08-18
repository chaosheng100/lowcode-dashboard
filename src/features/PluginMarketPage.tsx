import { useState } from 'react'
import { Alert, Button, Spin } from 'antd'
import { useApi } from './useApi'
import { api } from '../mock'
import { Tag , PageHeader } from './common'

/** 插件市场：一键安装市场插件为画布组件能力 */
export default function PluginMarketPage() {
  const { data, loading, error, reload } = useApi(() => api.listPlugins({ pageSize: 50 }), [])
  const [busy, setBusy] = useState<string | null>(null)
  const toggle = async (id: string, installed: boolean) => {
    setBusy(id)
    await api.togglePlugin(id, !installed)
    setBusy(null); reload()
  }
  return (
    <div className="feature-page">
      <PageHeader title="插件市场" subtitle="浏览并一键安装市场插件，扩展画布组件生态">
<span className="fp-count">共 {data?.list.length ?? 0} 个</span>
</PageHeader>
      {loading && <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>}
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 14 }} />}
      {!loading && !error && (
        <div className="grid3">
          {(data?.list ?? []).map((p) => (
            <div key={p.id} className="card">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <b style={{ color: '#1d1d1f' }}>{p.name}</b><Tag color={p.installed ? '#34c759' : '#86868b'}>{p.installed ? '已安装' : '未安装'}</Tag>
              </div>
              <div className="muted2" style={{ margin: '8px 0' }}>{p.desc}</div>
              <div className="muted2">作者 {p.author} · ★ {p.rating} · v{p.version}</div>
              <div className="fp-toolbar" style={{ marginTop: 8 }}>
                <Button size="small" disabled={busy === p.id} onClick={() => toggle(p.id, p.installed)}>{p.installed ? '卸载' : '安装'}</Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
