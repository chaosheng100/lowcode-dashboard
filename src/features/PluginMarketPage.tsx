import { useMemo, useState } from 'react'
import { Alert, Button, Empty, Input, Spin, Tag as AntTag } from 'antd'
import { DownloadOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { useApi } from './useApi'
import { governanceApi } from '../api/governanceResourceApi'
import { PageHeader, Tag } from './common'

export default function PluginMarketPage() {
  const market = useApi(() => governanceApi.listMarketPlugins({ pageSize: 100 }), [])
  const installs = useApi(() => governanceApi.listInstalledPlugins({ pageSize: 100 }), [])
  const [keyword, setKeyword] = useState('')
  const [busy, setBusy] = useState<string | null>(null)
  const installed = useMemo(() => new Map((installs.data?.list || []).map((item) => [item.packageId, item])), [installs.data])
  const list = (market.data?.list || []).filter((plugin) => !keyword || `${plugin.name} ${plugin.type} ${plugin.code}`.toLowerCase().includes(keyword.toLowerCase()))
  const install = async (packageId: string) => { setBusy(packageId); try { await governanceApi.installPlugin({ packageId }); installs.reload(); market.reload() } finally { setBusy(null) } }
  return <div className="feature-page">
    <PageHeader title="插件市场" subtitle="发现已审核版本，安装后扩展组件菜单与数据管理能力" actions={<div className="fp-head-actions"><AntTag color="blue">{market.data?.total || 0} 个已审核插件</AntTag><Button icon={<ReloadOutlined />} onClick={() => { market.reload(); installs.reload() }} aria-label="刷新插件市场" /></div>} />
    <div className="list-toolbar"><Input allowClear prefix={<SearchOutlined />} placeholder="搜索插件名称、类型或编码" value={keyword} onChange={(e) => setKeyword(e.target.value)} /></div>
    {market.loading && <div className="fp-loading"><Spin size="small" />正在加载插件市场</div>}{market.error && <Alert type="error" showIcon message={market.error} />}{!market.loading && !market.error && !list.length && <Empty description="暂无符合条件的插件" />}
    <div className="grid3">{list.map((plugin) => { const current = installed.get(plugin.id); return <div className="card" key={plugin.id}><div className="flex" style={{ justifyContent: 'space-between' }}><b>{plugin.name}</b><Tag>{plugin.type}</Tag></div><div className="muted2" style={{ margin: '8px 0' }}>{plugin.description || '暂无描述'}</div><div className="muted2">v{plugin.latestVersion?.version || '未知版本'} · {plugin.status}</div><div className="fp-toolbar"><Button type={current ? 'default' : 'primary'} size="small" icon={<DownloadOutlined />} loading={busy === plugin.id} onClick={() => current ? undefined : install(plugin.id)}>{current ? `已安装 · ${current.status}` : '安装到当前空间'}</Button></div></div> })}</div>
  </div>
}
