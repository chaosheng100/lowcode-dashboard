import { useState } from 'react'
import { Alert, Button, Spin } from 'antd'
import { useApi } from './useApi'
import { api } from '../mock'
import { Empty, Tag } from './common'

/** 我的插件：已安装插件管理（封装为画布可复用组件） */
export default function PluginMinePage() {
  const { data, loading, error, reload } = useApi(() => api.listPlugins({ pageSize: 50 }), [])
  const [busy, setBusy] = useState<string | null>(null)
  const toggle = async (id: string, installed: boolean) => {
    setBusy(id)
    await api.togglePlugin(id, !installed)
    setBusy(null); reload()
  }
  const mine = (data?.list ?? []).filter((p) => p.installed)
  return (
    <div className="feature-page">
      <div className="fp-head">
        <div><h2 className="fp-title">我的插件</h2><p className="fp-sub">自有 / 已安装插件，封装为画布可复用组件</p></div>
        <span className="fp-count">已安装 {mine.length} 个</span>
      </div>
      {loading && <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>}
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 14 }} />}
      {!loading && !error && (
        <>
          <div className="grid3">
            {mine.map((p) => (
              <div key={p.id} className="card">
                <div className="flex" style={{ justifyContent: 'space-between' }}>
                  <b style={{ color: '#1d1d1f' }}>{p.name}</b><Tag color="#34c759">v{p.version}</Tag>
                </div>
                <div className="muted2" style={{ margin: '8px 0' }}>{p.desc}</div>
                <div className="muted2">作者 {p.author} · ★ {p.rating}</div>
                <div className="fp-toolbar" style={{ marginTop: 8 }}>
                  <Button size="small" danger disabled={busy === p.id} onClick={() => toggle(p.id, p.installed)}>卸载</Button>
                </div>
              </div>
            ))}
          </div>
          {mine.length === 0 && <Empty>暂无已安装插件</Empty>}
        </>
      )}
    </div>
  )
}
