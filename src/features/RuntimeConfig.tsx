import { useState } from 'react'
import { Alert, Button, Card, Empty, Input, Select, Spin, Tag as AntTag } from 'antd'
import { CheckOutlined, CloudUploadOutlined, PlusOutlined, ReloadOutlined, SafetyCertificateOutlined } from '@ant-design/icons'
import { useApi } from './useApi'
import { governanceApi, type RuntimeEnvironmentDTO, type RuntimeProfileDTO } from '../api/governanceResourceApi'
import { Field, Modal, PageHeader } from './common'
import { isString } from '../data/utils/typeGuards'

export default function RuntimeConfig() {
  const envState = useApi(() => governanceApi.listEnvironments({ pageSize: 50 }), [])
  const profileState = useApi(() => governanceApi.listProfiles({ pageSize: 100 }), [])
  const [environment, setEnvironment] = useState<Partial<RuntimeEnvironmentDTO> | null>(null)
  const [profile, setProfile] = useState<Partial<RuntimeProfileDTO> | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const saveEnvironment = async () => { if (!environment) return; await governanceApi.saveEnvironment(environment); setEnvironment(null); envState.reload(); profileState.reload() }
  const saveProfile = async () => { if (!profile) return; await governanceApi.saveProfile({ ...profile, config: isString(profile.config) ? JSON.parse(profile.config) : profile.config }); setProfile(null); profileState.reload() }
  const action = async (id: string, operation: 'validate' | 'preflight' | 'publish') => { setBusy(`${operation}:${id}`); try { const response = operation === 'validate' ? await governanceApi.validateProfile(id) : operation === 'preflight' ? await governanceApi.preflightProfile(id) : await governanceApi.publishProfile(id); if (response.code === 0) profileState.reload() } finally { setBusy(null) } }

  return <div className="feature-page">
    <PageHeader title="运行配置" subtitle="按开发、测试、生产环境管理主题、地址、绑定和发布快照" actions={<div className="fp-head-actions"><Button icon={<ReloadOutlined />} onClick={() => { envState.reload(); profileState.reload() }} aria-label="刷新运行配置" /><Button icon={<PlusOutlined />} onClick={() => setEnvironment({ name: '', kind: 'dev', baseUrl: '', isDefault: false, status: 'active' })}>新建环境</Button></div>} />
    {envState.error && <Alert type="error" showIcon message={envState.error} />}
    {envState.loading && <div className="fp-loading"><Spin size="small" />正在加载环境</div>}
    <div className="grid3">{envState.data?.map((env) => <Card key={env.id} size="small" title={env.name} extra={<AntTag color={env.kind === 'prod' ? 'green' : 'blue'}>{env.kind}</AntTag>}><div className="muted2">{env.baseUrl || '未配置运行地址'}</div><div className="fp-toolbar"><Button size="small" onClick={() => setEnvironment(env)}>编辑环境</Button><AntTag>{env.isDefault ? '默认环境' : '已启用'}</AntTag></div></Card>)}</div>
    <div style={{ marginTop: 18 }}><div className="fp-toolbar"><b>运行 Profile</b><Button size="small" icon={<PlusOutlined />} onClick={() => setProfile({ name: '', environmentId: envState.data?.[0]?.id || '', config: { theme: 'apple-light', background: '#f5f5f7', baseUrl: envState.data?.[0]?.baseUrl || '' }, status: 'draft', currentVersion: 1 })}>新建 Profile</Button></div>
      {profileState.error && <Alert type="error" showIcon message={profileState.error} />}{profileState.loading && <div className="fp-loading"><Spin size="small" />正在加载 Profile</div>}{!profileState.loading && !profileState.error && !profileState.data?.length && <Empty description="暂无运行 Profile" />}
      <div className="grid3">{profileState.data?.map((item) => <Card key={item.id} size="small" title={item.name} extra={<AntTag color={item.status === 'published' ? 'green' : 'orange'}>{item.status}</AntTag>}><div className="muted2">版本 v{item.currentVersion} · 环境 {envState.data?.find((env) => env.id === item.environmentId)?.name || item.environmentId}</div><div className="fp-toolbar"><Button size="small" onClick={() => setProfile(item)}>编辑</Button><Button size="small" icon={<SafetyCertificateOutlined />} loading={busy === `preflight:${item.id}`} onClick={() => action(item.id, 'preflight')}>预检</Button>{item.status !== 'published' && <Button size="small" icon={<CloudUploadOutlined />} loading={busy === `publish:${item.id}`} onClick={() => action(item.id, 'publish')}>发布</Button>}<Button size="small" icon={<CheckOutlined />} loading={busy === `validate:${item.id}`} onClick={() => action(item.id, 'validate')}>校验</Button></div></Card>)}</div>
    </div>
    {environment && <Modal title={environment.id ? '编辑环境' : '新建环境'} onClose={() => setEnvironment(null)}><Field label="名称"><Input value={environment.name || ''} onChange={(e) => setEnvironment({ ...environment, name: e.target.value })} /></Field><Field label="类型"><Select style={{ width: '100%' }} value={environment.kind || 'dev'} options={[{ value: 'dev', label: '开发' }, { value: 'test', label: '测试' }, { value: 'prod', label: '生产' }]} onChange={(kind) => setEnvironment({ ...environment, kind })} /></Field><Field label="运行地址"><Input value={environment.baseUrl || ''} onChange={(e) => setEnvironment({ ...environment, baseUrl: e.target.value })} /></Field><Button type="primary" onClick={saveEnvironment}>保存</Button></Modal>}
    {profile && <Modal title={profile.id ? '编辑运行 Profile' : '新建运行 Profile'} onClose={() => setProfile(null)} width={680}><Field label="名称"><Input value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></Field><Field label="环境"><Select style={{ width: '100%' }} value={profile.environmentId} options={(envState.data || []).map((env) => ({ value: env.id, label: env.name }))} onChange={(environmentId) => setProfile({ ...profile, environmentId })} /></Field><Field label="配置 JSON"><Input.TextArea rows={12} value={isString(profile.config) ? profile.config : JSON.stringify(profile.config || {}, null, 2)} onChange={(e) => setProfile({ ...profile, config: e.target.value })} /></Field><Button type="primary" onClick={saveProfile}>保存草稿</Button></Modal>}
  </div>
}
