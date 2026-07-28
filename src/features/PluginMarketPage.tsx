import { useState } from 'react'
import { useApi } from './useApi'
import { api } from '../mock'
import { Tag } from './common'

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
      <div className="fp-head">
        <div><h2 className="fp-title">插件市场</h2><p className="fp-sub">浏览并一键安装市场插件，扩展画布组件生态</p></div>
        <span className="fp-count">共 {data?.list.length ?? 0} 个</span>
      </div>
      {loading && <div className="fp-loading">加载中…</div>}
      {error && <div className="fp-error">{error}</div>}
      {!loading && !error && (
        <div className="grid3">
          {(data?.list ?? []).map((p) => (
            <div key={p.id} className="card">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <b style={{ color: '#e6edf3' }}>{p.name}</b><Tag color={p.installed ? '#4ade80' : '#9fb0c3'}>{p.installed ? '已安装' : '未安装'}</Tag>
              </div>
              <div className="muted2" style={{ margin: '8px 0' }}>{p.desc}</div>
              <div className="muted2">作者 {p.author} · ★ {p.rating} · v{p.version}</div>
              <div className="fp-toolbar" style={{ marginTop: 8 }}>
                <button className="btn sm" disabled={busy === p.id} onClick={() => toggle(p.id, p.installed)}>{p.installed ? '卸载' : '安装'}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
