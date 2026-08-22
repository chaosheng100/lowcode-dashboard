import { useState } from 'react'
import { Alert, Button, Empty, Spin, Tag as AntTag } from 'antd'
import { ReloadOutlined } from '@ant-design/icons'
import { useApi } from './useApi'
import { governanceApi } from '../api/governanceResourceApi'
import { PageHeader, Tag } from './common'

export default function PluginMinePage() {
  const state = useApi(() => governanceApi.listInstalledPlugins({ pageSize: 100 }), [])
  const [busy, setBusy] = useState<string | null>(null)
  const action = async (id: string, operation: 'enable' | 'disable' | 'uninstall') => { setBusy(id); try { await governanceApi.pluginAction(id, operation); state.reload() } finally { setBusy(null) } }
  return <div className="feature-page">
    <PageHeader title="我的插件" subtitle="按空间隔离管理已安装插件的版本、状态与能力" actions={<div className="fp-head-actions"><AntTag color="blue">已安装 {state.data?.total || 0} 个</AntTag><Button icon={<ReloadOutlined />} onClick={state.reload} aria-label="刷新已安装插件" /></div>} />
    {state.loading && <div className="fp-loading"><Spin size="small" />正在加载插件安装实例</div>}{state.error && <Alert type="error" showIcon message={state.error} />}{!state.loading && !state.error && !state.data?.list.length && <Empty description="暂无已安装插件" />}
    <div className="grid3">{state.data?.list.map((install) => <div className="card" key={install.id}><div className="flex" style={{ justifyContent: 'space-between' }}><b>{install.package?.name || install.packageId}</b><Tag color={install.status === 'enabled' ? '#34c759' : '#ff9500'}>{install.status}</Tag></div><div className="muted2" style={{ margin: '8px 0' }}>版本 {install.version || install.versionId} · 安装实例 {install.id.slice(0, 8)}</div><div className="fp-toolbar"><Button size="small" disabled={busy === install.id} onClick={() => action(install.id, install.status === 'enabled' ? 'disable' : 'enable')}>{install.status === 'enabled' ? '停用' : '启用'}</Button><Button size="small" danger loading={busy === install.id} onClick={() => action(install.id, 'uninstall')}>卸载</Button></div></div>)}</div>
  </div>
}
