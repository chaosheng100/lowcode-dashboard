import { useEffect, useMemo, useState } from 'react'
import { Button, Select } from 'antd'
import { DesktopOutlined } from '@ant-design/icons'
import PluginManagement from './PluginManagement'
import { api } from '../mock'
import type { TwinSceneDTO } from '../mock/types'
import { Tag, Field, Modal } from './common'
import TwinPage from './TwinPage'
import { useDesignerStore } from '../data/store/useDesignerStore'
import { dtoToScene, sceneToDTO } from '../twin/dtoAdapter'
import {
  syncTwinWidgetsToDashboard,
  unlinkTwinFromDashboard,
  twinComponentAssets
} from './twinWidgetCatalog'

const TWIN_STATUS: Record<TwinSceneDTO['status'], { text: string; color: string }> = {
  online: { text: '在线', color: '#4ade80' },
  maintenance: { text: '维护', color: '#facc15' },
  offline: { text: '离线', color: '#94a3b8' }
}

function formatTime(iso?: string): string {
  if (!iso) return '暂无'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return '暂无'
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function TwinThumb({ scene, label }: { scene: TwinSceneDTO; label: string }) {
  const blocks = scene.models.slice(0, 12)
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
  save?: (patch: Partial<TwinSceneDTO>) => Promise<void>
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
        await save?.({ ...dtoPatch, id: resolved.id })
      }}
    />
  )
}

/** 数字孪生：场景列表 + 进入编辑器（3D 场景编辑器）+ 预览 + 投放到大屏 */
export default function TwinManagement() {
  const upsertTwinScene = useDesignerStore((s) => s.upsertTwinScene)
  const routes = useDesignerStore((s) => s.routes)
  const updateRoute = useDesignerStore((s) => s.updateRoute)
  const dashboards = useMemo(() => routes.filter((r) => r.kind === 'dashboard'), [routes])

  // 投放弹窗状态
  const [deploying, setDeploying] = useState<TwinSceneDTO | null>(null)
  const [dashboardId, setDashboardId] = useState('')
  const [busy, setBusy] = useState(false)

  const openDeploy = (scene: TwinSceneDTO) => {
    setDeploying(scene)
    setDashboardId(dashboards[0]?.id ?? '')
  }

  const deploy = async () => {
    if (!deploying || !dashboardId) return
    const route = routes.find((r) => r.id === dashboardId && r.kind === 'dashboard')
    if (!route) return
    setBusy(true)
    try {
      const syncedAt = new Date().toISOString()
      const resp = await api.saveTwinScene({ id: deploying.id, dashboardId, lastSyncAt: syncedAt })
      if (resp.code !== 0) return
      // 如果之前关联了其他大屏，先从旧大屏解绑
      if (deploying.dashboardId && deploying.dashboardId !== dashboardId) {
        const prevRoute = routes.find((r) => r.id === deploying.dashboardId)
        if (prevRoute) updateRoute(prevRoute.id, unlinkTwinFromDashboard(prevRoute, deploying.id))
      }
      // 同步孪生组件到大屏（全部三种：summary/models/geometry）
      updateRoute(
        route.id,
        syncTwinWidgetsToDashboard(route, resp.data, syncedAt, twinComponentAssets.map((a) => a.kind))
      )
      // 同步 store 镜像
      upsertTwinScene(dtoToScene(resp.data))
    } finally {
      setBusy(false)
      setDeploying(null)
    }
  }

  return (
    <>
      <PluginManagement<TwinSceneDTO>
        title="数字孪生"
        subtitle="三维可视化场景搭建与预览，支持 3D 编辑器设计"
        countLabel="场景"
        fetcher={() => api.listTwinScenes({ pageSize: 50 })}
        saveItem={(b) => api.saveTwinScene(b)}
        deleteItem={(id) => api.deleteTwinScene(id)}
        blankItem={() => ({ id: '', name: '新建场景', models: [], lighting: 'day', fog: false, status: 'offline', updatedAt: '' })}
        askNameOnCreate
        renderThumb={(s) => <TwinThumb scene={s} label="孪生场景" />}
        renderMeta={(s) => [
          `模型数：${s.models.length} · 光照：${s.lighting === 'day' ? '日照' : '夜景'} · 雾效：${s.fog ? '开' : '关'}`,
          `更新：${formatTime(s.updatedAt)}`
        ]}
        renderTags={(s) => {
          const st = TWIN_STATUS[s.status] ?? TWIN_STATUS.offline
          return (
            <div className="twin-status-row">
              <Tag color={st.color}>{st.text}</Tag>
              <Tag color={s.lighting === 'day' ? '#facc15' : '#6366f1'}>{s.lighting === 'day' ? '日照' : '夜景'}</Tag>
              {s.fog && <Tag>雾效</Tag>}
              {s.dashboardId && <Tag color="#2dd4bf">已投放</Tag>}
            </div>
          )
        }}
        renderActions={(scene) => (
          <Button
            size="small"
            type="link"
            icon={<DesktopOutlined />}
            title="投放孪生场景到大屏"
            onClick={(e) => { e.stopPropagation(); openDeploy(scene) }}
          >
            投放到大屏
          </Button>
        )}
        renderEditor={(item, save) => (
          <TwinSceneHost key={item.id || 'blank'} item={item} save={save} />
        )}
        renderPreview={(item) => (
          <TwinSceneHost key={item.id || 'blank'} item={item} readOnly />
        )}
      />

      {/* 投放到大屏弹窗 */}
      {deploying && (
        <Modal title="投放孪生场景到大屏" onClose={() => { if (!busy) setDeploying(null) }}>
          <p style={{ marginTop: 0, color: 'var(--sub)' }}>
            {deploying.name} · {deploying.models.length} 个模型
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
            投放时将场景摘要、模型总数、类型分布组件写入大屏，并建立场景与大屏绑定。同一场景重复投放会原位更新已投组件。
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
    </>
  )
}
