import { useEffect, useMemo, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Alert, App, Button, Input, Popconfirm, Select, Spin } from 'antd'
import {
  AuditOutlined,
  CheckCircleOutlined,
  CloseCircleOutlined,
  DeleteOutlined,
  DesktopOutlined,
  EditOutlined,
  EyeOutlined,
  FormOutlined,
  PlusOutlined,
  SearchOutlined,
  SortAscendingOutlined,
  SortDescendingOutlined,
  TeamOutlined
} from '@ant-design/icons'
import TwinModelLibrary from './TwinModelLibrary'
import { api } from '../mock'
import type { TwinSceneDTO } from '../mock/types'
import { Tag, Field, Modal, MetricRow, Stat } from './common'
import { useApi } from './useApi'
import { screenApi } from '../api/screenApi'
import { screenToRoute } from '../api/screenAdapter'
import { loadScreenRoute, patchScreenRoute, saveScreenRoute } from '../api/screenRoutes'
import { useAuthStore } from '../auth/store'
import TwinPage from './TwinPage'
import { useDesignerStore } from '../data/store/useDesignerStore'
import { dtoToScene, sceneToDTO } from '../twin/dtoAdapter'
import { syncTwinWidgetsToDashboard, unlinkTwinFromDashboard } from './twinWidgetCatalog'

const TWIN_STATUS: Record<TwinSceneDTO['status'], { text: string; color: string }> = {
  online: { text: '在线', color: '#34c759' },
  maintenance: { text: '维护', color: '#ff9500' },
  offline: { text: '离线', color: '#86868b' }
}

export function canEditScene(scene: TwinSceneDTO, userId?: string | null): boolean {
  const acl = scene.acl
  if (!acl || !acl.owner) return true
  const user = useAuthStore.getState().user
  if (user?.roles?.some((r) => r.code === 'admin' || r.code === 'super_admin')) return true
  if (!userId) return false
  return userId === acl.owner || (acl.editors ?? []).includes(userId)
}

function formatTime(iso?: string): string {
  if (!iso) return '暂无'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '暂无'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function TwinThumb({ scene, label }: { scene: TwinSceneDTO; label: string }) {
  const blocks = scene.models?.slice(0, 12) ?? []
  return (
    <>
      <div className="twin-thumb-grid" aria-hidden>
        {Array.from({ length: 12 }).map((_, i) => {
          const m = blocks[i]
          return (
            <i
              key={i}
              className="twin-thumb-block"
              style={m ? { background: m.color, opacity: 0.75 } : undefined}
            />
          )
        })}
      </div>
      <span className="mg-badge">{label}</span>
    </>
  )
}

function TwinSceneHost({ item, save, readOnly }: {
  item: TwinSceneDTO
  save?: (patch: Partial<TwinSceneDTO>) => Promise<unknown>
  readOnly?: boolean
}) {
  const upsertTwinScene = useDesignerStore((s) => s.upsertTwinScene)
  const setActiveTwinScene = useDesignerStore((s) => s.setActiveTwinScene)
  // 历史脏数据可能存在空 id 场景：编辑前先让后端补发一个真实 id，避免重复 POST 触发 409
  const [resolved, setResolved] = useState<TwinSceneDTO | null>(item.id ? item : readOnly ? item : null)

  useEffect(() => {
    if (item.id || resolved || readOnly) return
    let alive = true
    api.saveTwinScene({ ...item, id: undefined })
      .then((r) => {
        if (alive && r.code === 0 && r.data?.id) setResolved(r.data)
      })
    return () => { alive = false }
  }, [item, resolved, readOnly])

  useEffect(() => {
    if (!resolved?.id) return
    upsertTwinScene(dtoToScene(resolved))
    setActiveTwinScene(resolved.id)
  }, [resolved?.id])

  if (!resolved) return <div className="empty-tip">正在修复空白场景…</div>

  return (
    <TwinPage
      scene={dtoToScene(resolved)}
      readOnly={readOnly}
      onSave={readOnly ? undefined : async (patch) => {
        const dtoPatch = sceneToDTO(patch)
        return save?.({ ...dtoPatch, id: resolved.id })
      }}
    />
  )
}

/** 数字孪生：场景列表 + 进入编辑器（3D 场景编辑器）+ 预览 + 投放到大屏 */
export default function TwinManagement() {
  const upsertTwinScene = useDesignerStore((s) => s.upsertTwinScene)
  const { data: screenData } = useApi(() => screenApi.list(), [])
  const dashboards = useMemo(() => (screenData ?? []).map(screenToRoute), [screenData])
  const location = useLocation()
  const view = new URLSearchParams(location.search || '').get('view') || ''

  // 投放弹窗状态
  const [deploying, setDeploying] = useState<TwinSceneDTO | null>(null)
  const [dashboardId, setDashboardId] = useState('')
  const [busy, setBusy] = useState(false)
  const { message } = App.useApp()
  const { data: envData } = useApi(() => api.listDeployEnvs(), [])
  const envs = envData?.list ?? []
  const { data: userData } = useApi(() => api.rbac.listUsers({ pageSize: 100 }), [])
  const users = userData?.list ?? []
  const currentUserId = useAuthStore((s) => s.user?.id)
  const [listTick, setListTick] = useState(0)
  const scenes = useApi(() => api.listTwinScenes({ pageSize: 50 }), [listTick])
  const [cview, setCview] = useState<
    { mode: 'list' } | { mode: 'edit'; item: TwinSceneDTO } | { mode: 'preview'; item: TwinSceneDTO }
  >({ mode: 'list' })
  const [kw, setKw] = useState('')
  const [status, setStatus] = useState<'all' | 'online' | 'maintenance' | 'offline'>('all')
  const [desc, setDesc] = useState(true)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [approval, setApproval] = useState<{ scene: TwinSceneDTO; env: string; note: string } | null>(null)
  const [approving, setApproving] = useState(false)
  const [aclModal, setAclModal] = useState<{ scene: TwinSceneDTO; owner: string; editors: string[]; viewers: string[] } | null>(null)
  const [aclSaving, setAclSaving] = useState(false)

  const openDeploy = (scene: TwinSceneDTO) => {
    setDeploying(scene)
    setDashboardId(dashboards[0]?.id ?? '')
  }

  const deploy = async () => {
    if (!deploying || !dashboardId) return
    const route = await loadScreenRoute(dashboardId)
    if (!route) return
    setBusy(true)
    try {
      const syncedAt = new Date().toISOString()
      const resp = await api.saveTwinScene({ id: deploying.id, dashboardId, lastSyncAt: syncedAt })
      if (resp.code !== 0) return
      // 如果之前关联了其他大屏，先从旧大屏解绑
      if (deploying.dashboardId && deploying.dashboardId !== dashboardId) {
        const prevRoute = await loadScreenRoute(deploying.dashboardId)
        if (prevRoute) {
          await saveScreenRoute(patchScreenRoute(prevRoute, unlinkTwinFromDashboard(prevRoute, deploying.id)))
        }
      }
      // 同步 3D 场景组件到大屏，并清理该场景历史投放的旧组件
      await saveScreenRoute(patchScreenRoute(route, syncTwinWidgetsToDashboard(route, resp.data, syncedAt, ['scene'])))
      // 同步 store 镜像
      upsertTwinScene(dtoToScene(resp.data))
    } finally {
      setBusy(false)
      setDeploying(null)
    }
  }

  const openApproval = (scene: TwinSceneDTO) => {
    setApproval({
      scene,
      env: scene.deployEnv ?? envs[0]?.name ?? '开发',
      note: scene.approvalNote ?? ''
    })
  }

  const submitApproval = async () => {
    if (!approval) return
    setApproving(true)
    try {
      const resp = await api.saveTwinScene({
        id: approval.scene.id,
        deployStatus: 'pending',
        deployEnv: approval.env,
        approvalNote: approval.note,
        deployedAt: ''
      })
      if (resp.code !== 0) {
        message.error(resp.message)
        return
      }
      message.success('已提交审批')
      setApproval(null)
      setListTick((t) => t + 1)
    } finally {
      setApproving(false)
    }
  }

  const decideApproval = async (pass: boolean) => {
    if (!approval) return
    setApproving(true)
    try {
      const resp = await api.saveTwinScene({
        id: approval.scene.id,
        deployStatus: pass ? 'approved' : 'rejected',
        deployEnv: approval.env,
        approvalNote: approval.note,
        ...(pass ? { deployedAt: new Date().toISOString() } : {})
      })
      if (resp.code !== 0) {
        message.error(resp.message)
        return
      }
      message.success(pass ? '审批通过，已发布' : '已驳回')
      setApproval(null)
      setListTick((t) => t + 1)
    } finally {
      setApproving(false)
    }
  }

  const openAcl = (scene: TwinSceneDTO) => {
    const acl = scene.acl ?? {}
    setAclModal({
      scene,
      owner: acl.owner ?? currentUserId ?? '',
      editors: acl.editors ?? [],
      viewers: acl.viewers ?? []
    })
  }

  const saveAcl = async () => {
    if (!aclModal) return
    setAclSaving(true)
    try {
      const resp = await api.saveTwinScene({
        id: aclModal.scene.id,
        acl: { owner: aclModal.owner, editors: aclModal.editors, viewers: aclModal.viewers }
      })
      if (resp.code !== 0) {
        message.error(resp.message)
        return
      }
      message.success('协同权限已保存')
      setAclModal(null)
      setListTick((t) => t + 1)
    } finally {
      setAclSaving(false)
    }
  }

  const twinItems = useMemo(() => {
    const list = (scenes.data?.list ?? []) as TwinSceneDTO[]
    const q = kw.trim().toLowerCase()
    const filtered = list
      .filter((it) => !q || it.name.toLowerCase().includes(q))
      .filter((it) => status === 'all' || it.status === status)
    return filtered.sort((a, b) => {
      const av = new Date(a.updatedAt ?? 0).getTime()
      const bv = new Date(b.updatedAt ?? 0).getTime()
      return desc ? bv - av : av - bv
    })
  }, [scenes.data, kw, status, desc])

  const createScene = async () => {
    if (creating) return
    setCreating(true)
    try {
      const r = await api.saveTwinScene({
        name: '新建场景',
        models: [],
        lighting: 'day',
        fog: false,
        status: 'offline',
        updatedAt: ''
      })
      if (r.code === 0 && r.data?.id) {
        scenes.reload()
        setCview({ mode: 'edit', item: r.data })
      } else {
        message.error(r.message || '创建失败')
      }
    } finally {
      setCreating(false)
    }
  }

  const renameScene = async (scene: TwinSceneDTO, name: string) => {
    if (!name.trim()) {
      setRenameId(null)
      return
    }
    const r = await api.saveTwinScene({ ...scene, name: name.trim() })
    if (r.code !== 0) message.error(r.message || '重命名失败')
    setRenameId(null)
    scenes.reload()
  }

  const deleteScene = async (scene: TwinSceneDTO) => {
    setDeletingId(scene.id)
    try {
      await api.deleteTwinScene(scene.id)
      scenes.reload()
    } finally {
      setDeletingId(null)
    }
  }

  const sceneCount = scenes.data?.total ?? twinItems.length
  const onlineCount = (scenes.data?.list ?? []).filter((s) => s.status === 'online').length
  const maintenanceCount = (scenes.data?.list ?? []).filter((s) => s.status === 'maintenance').length

  if (cview.mode === 'edit') {
    const save = async (patch: Partial<TwinSceneDTO>) => {
      const r = await api.saveTwinScene({ id: cview.item.id, ...patch })
      scenes.reload()
      return r
    }
    return (
      <div className="pm-fullscreen">
        <div className="pm-bar">
          <Button onClick={() => { scenes.reload(); setCview({ mode: 'list' }) }}>← 返回列表</Button>
          <span className="pm-title">数字孪生 · 编辑 · {cview.item.name}</span>
        </div>
        <div className="pm-body">
          <TwinSceneHost
            key={cview.item.id || 'blank'}
            item={cview.item}
            readOnly={!canEditScene(cview.item, currentUserId)}
            save={save}
          />
        </div>
      </div>
    )
  }

  if (cview.mode === 'preview') {
    return (
      <div className="pm-fullscreen">
        <div className="pm-bar">
          <Button onClick={() => setCview({ mode: 'list' })}>← 返回列表</Button>
          <span className="pm-title">数字孪生 · 预览 · {cview.item.name}</span>
        </div>
        <div className="pm-body">
          <TwinSceneHost key={cview.item.id || 'blank'} item={cview.item} readOnly />
        </div>
      </div>
    )
  }

  if (view === 'models') return <TwinModelLibrary />

  return (
    <>
      <main className="feature-page carousel-page">
        <header className="carousel-head">
          <div>
            <h1 className="fp-title">数字孪生</h1>
            <p className="fp-sub">三维可视化场景搭建与预览，支持 3D 编辑器设计</p>
          </div>
          <Button type="primary" icon={<PlusOutlined />} loading={creating} onClick={createScene}>
            新建场景
          </Button>
        </header>
        <MetricRow>
          <Stat label="全部场景" value={sceneCount} accent="#0a84ff" />
          <Stat label="在线" value={onlineCount} accent="#34c759" />
          <Stat label="维护中" value={maintenanceCount} accent="#ff9500" />
          <Stat label="离线" value={Math.max(0, sceneCount - onlineCount - maintenanceCount)} accent="#86868b" />
        </MetricRow>
        <div className="carousel-toolbar">
          <Input
            style={{ width: 320 }}
            placeholder="按名称搜索…"
            prefix={<SearchOutlined />}
            allowClear
            value={kw}
            onChange={(e) => setKw(e.target.value)}
          />
          <Select
            style={{ width: 130 }}
            value={status}
            onChange={(v) => setStatus(v)}
            options={[
              { value: 'all', label: '全部状态' },
              { value: 'online', label: '在线' },
              { value: 'maintenance', label: '维护中' },
              { value: 'offline', label: '离线' }
            ]}
          />
          <Button onClick={() => setDesc((v) => !v)} icon={desc ? <SortDescendingOutlined /> : <SortAscendingOutlined />}>
            {desc ? '倒序' : '升序'}
          </Button>
          <span className="carousel-result">共 {twinItems.length} 个场景</span>
        </div>
        <section className="carousel-list">
          {scenes.loading && <div style={{ padding: 40, textAlign: 'center' }}><Spin /></div>}
          {scenes.error && <Alert type="error" showIcon message={`加载失败：${scenes.error}`} />}
          {!scenes.loading && !scenes.error && (
            <div className="carousel-grid twin-carousel-grid">
              {twinItems.map((scene) => (
                <div className="carousel-card twin-scene-card" key={scene.id}>
                  <div className="carousel-card-thumb">
                    <TwinThumb scene={scene} label="孪生场景" />
                  </div>
                  <div className="carousel-card-info">
                    <div className="carousel-card-title-row">
                      {renameId === scene.id ? (
                        <Input
                          size="small"
                          autoFocus
                          value={renameText}
                          onChange={(e) => setRenameText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') renameScene(scene, renameText)
                            if (e.key === 'Escape') setRenameId(null)
                          }}
                          onBlur={() => renameScene(scene, renameText)}
                        />
                      ) : (
                        <h2 title={scene.name}>{scene.name}</h2>
                      )}
                      <span className={'carousel-state' + (scene.status === 'online' ? ' enabled' : '')}>
                        {TWIN_STATUS[scene.status]?.text ?? '未知'}
                      </span>
                    </div>
                    <div className="carousel-card-meta">
                      <span><b>{scene.models?.length ?? 0}</b> 个模型</span>
                      <span>光照：{scene.lighting === 'day' ? '日照' : '夜景'}</span>
                      <span>雾效：{scene.fog ? '开' : '关'}</span>
                      <span>更新：{formatTime(scene.updatedAt)}</span>
                    </div>
                    <div className="twin-status-row">
                      <Tag color={scene.lighting === 'day' ? '#ff9500' : '#6366f1'}>{scene.lighting === 'day' ? '日照' : '夜景'}</Tag>
                      {scene.fog && <Tag>雾效</Tag>}
                      {scene.dashboardId && <Tag color="#34c759">已投放</Tag>}
                      {scene.deployStatus === 'pending' && <Tag color="#ff9500">待审批</Tag>}
                      {scene.deployStatus === 'approved' && <Tag color="#34c759">已发布{scene.deployEnv ? ` · ${scene.deployEnv}` : ''}</Tag>}
                      {scene.deployStatus === 'rejected' && <Tag color="#ff3b30">已驳回</Tag>}
                      {(scene.acl?.owner || (scene.acl?.editors?.length ?? 0) > 0) && (
                        <Tag color="#818cf8">协同 {1 + (scene.acl?.editors?.length ?? 0) + (scene.acl?.viewers?.length ?? 0)}人</Tag>
                      )}
                    </div>
                    <div className="carousel-card-actions">
                      <Button size="small" icon={<EyeOutlined />} disabled={deletingId === scene.id} onClick={() => setCview({ mode: 'preview', item: scene })}>
                        预览
                      </Button>
                      <Button size="small" type="primary" ghost icon={<EditOutlined />} disabled={deletingId === scene.id} onClick={() => setCview({ mode: 'edit', item: scene })}>
                        编辑
                      </Button>
                      <Button size="small" type="link" icon={<TeamOutlined />} onClick={() => openAcl(scene)}>权限</Button>
                      <Button size="small" type="link" icon={<AuditOutlined />} onClick={() => openApproval(scene)}>发布审批</Button>
                      <Button size="small" type="link" icon={<DesktopOutlined />} onClick={() => openDeploy(scene)}>投放</Button>
                      <Button size="small" type="text" icon={<FormOutlined />} onClick={() => { setRenameId(scene.id); setRenameText(scene.name) }}>重命名</Button>
                      <Popconfirm title={`删除「${scene.name}」？此操作不可恢复。`} onConfirm={() => deleteScene(scene)}>
                        <Button size="small" type="text" danger icon={<DeleteOutlined />} loading={deletingId === scene.id} />
                      </Popconfirm>
                    </div>
                  </div>
                </div>
              ))}
              {!twinItems.length && <div className="carousel-empty">没有匹配的孪生场景</div>}
            </div>
          )}
        </section>
      </main>

      {/* 投放到大屏弹窗 */}
      {deploying && (
        <Modal title="投放孪生场景到大屏" onClose={() => { if (!busy) setDeploying(null) }}>
          <p style={{ marginTop: 0, color: 'var(--sub)' }}>
            {deploying.name} · {deploying.models?.length ?? 0} 个模型
          </p>
          <Field label="目标大屏">
            <Select
              style={{ width: '100%' }}
              value={dashboardId || undefined}
              placeholder={dashboards.length ? '请选择大屏' : '暂无可用大屏'}
              onChange={setDashboardId}
              options={dashboards.map((d) => ({ value: d.id, label: `${d.name} · ${d.components.length} 个组件` }))}
            />
          </Field>
          <p style={{ color: 'var(--sub)', fontSize: 12, lineHeight: 1.6 }}>
            投放时将 3D 场景组件写入大屏，并建立场景与大屏绑定。同一场景重复投放会原位更新已投组件。
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button disabled={busy} onClick={() => setDeploying(null)}>取消</Button>
            <Button
              type="primary"
              loading={busy}
              disabled={!dashboardId}
              onClick={deploy}
            >
              {busy ? '投放中...' : '确认投放'}
            </Button>
          </div>
        </Modal>
      )}

      {approval && (
        <Modal title={`发布审批 · ${approval.scene.name || '未命名场景'}`} onClose={() => !approving && setApproval(null)}>
          <p style={{ marginTop: 0, color: 'var(--sub)' }}>
            {approval.scene.name} · {approval.scene.models?.length ?? 0} 个模型
            {approval.scene.deployStatus === 'pending' ? ' · 当前待审批' : ''}
          </p>
          <Field label="目标环境">
            <Select
              style={{ width: '100%' }}
              value={approval.env}
              onChange={(v) => setApproval((a) => (a ? { ...a, env: v } : a))}
              options={
                envs.length
                  ? envs.map((e) => ({ value: e.name, label: `${e.name} · ${e.kind}` }))
                  : [
                      { value: '开发', label: '开发' },
                      { value: '测试', label: '测试' },
                      { value: '生产', label: '生产' }
                    ]
              }
            />
          </Field>
          <Field label="审批意见">
            <Input.TextArea
              rows={3}
              value={approval.note}
              placeholder="选填"
              onChange={(e) => setApproval((a) => (a ? { ...a, note: e.target.value } : a))}
            />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            {approval.scene.deployStatus === 'pending' ? (
              <>
                <Button danger icon={<CloseCircleOutlined />} disabled={approving} onClick={() => decideApproval(false)}>驳回</Button>
                <Button type="primary" icon={<CheckCircleOutlined />} loading={approving} onClick={() => decideApproval(true)}>通过并发布</Button>
              </>
            ) : (
              <>
                <Button disabled={approving} onClick={() => setApproval(null)}>取消</Button>
                <Button type="primary" loading={approving} onClick={submitApproval}>提交审批</Button>
              </>
            )}
          </div>
        </Modal>
      )}

      {aclModal && (
        <Modal title={`协同权限 · ${aclModal.scene.name || '未命名场景'}`} onClose={() => !aclSaving && setAclModal(null)}>
          <Field label="所有者">
            <Select
              style={{ width: '100%' }}
              value={aclModal.owner || undefined}
              onChange={(v) => setAclModal((a) => (a ? { ...a, owner: v } : a))}
              options={
                users.length
                  ? users.map((u) => ({ value: u.id, label: u.name }))
                  : [{ value: currentUserId ?? '', label: '当前用户' }]
              }
            />
          </Field>
          <Field label="可编辑">
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              value={aclModal.editors}
              onChange={(v) => setAclModal((a) => (a ? { ...a, editors: v } : a))}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              placeholder="选择可编辑成员"
            />
          </Field>
          <Field label="可查看">
            <Select
              mode="multiple"
              style={{ width: '100%' }}
              value={aclModal.viewers}
              onChange={(v) => setAclModal((a) => (a ? { ...a, viewers: v } : a))}
              options={users.map((u) => ({ value: u.id, label: u.name }))}
              placeholder="选择只读成员"
            />
          </Field>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button disabled={aclSaving} onClick={() => setAclModal(null)}>取消</Button>
            <Button type="primary" loading={aclSaving} disabled={!aclModal.owner} onClick={saveAcl}>保存权限</Button>
          </div>
        </Modal>
      )}
    </>
  )
}
