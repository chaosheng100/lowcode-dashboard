import { useMemo, useState } from 'react'
import { Button, Select } from 'antd'
import PluginManagement from './PluginManagement'
import { api } from '../mock'
import type { TwinSceneDTO } from '../mock/types'
import { Tag, Field, Modal } from './common'
import TwinPage from './TwinPage'
import { useDesignerStore } from '../data/store/useDesignerStore'
import { dtoToScene, sceneToDTO } from '../twin/dtoAdapter'
import type { TwinScene } from '../twin/twinTypes'
import {
  syncTwinWidgetsToDashboard,
  unlinkTwinFromDashboard,
  twinComponentAssets
} from './twinWidgetCatalog'

/** 数字孪生：场景列表 + 进入编辑器（3D 场景编辑器）+ 预览 + 投放到大屏 */
export default function TwinManagement() {
  const upsertTwinScene = useDesignerStore((s) => s.upsertTwinScene)
  const setActiveTwinScene = useDesignerStore((s) => s.setActiveTwinScene)
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
        renderMeta={(s) => [`模型数：${s.models.length}`, `光照：${s.lighting === 'day' ? '日照' : '夜景'}`, s.fog ? '雾效：开' : '雾效：关']}
        renderTags={(s) => (
          <div className="flex" style={{ margin: '6px 0' }}>
            <Tag color={s.lighting === 'day' ? '#facc15' : '#6366f1'}>{s.lighting === 'day' ? '日照' : '夜景'}</Tag>
            {s.fog && <Tag>雾效</Tag>}
          </div>
        )}
        renderActions={(scene) => (
          <span
            className="mg-open"
            style={{ color: '#4ade80' }}
            onClick={(e) => { e.stopPropagation(); openDeploy(scene) }}
          >
            投放到大屏
          </span>
        )}
        renderEditor={(item, save) => {
          const scene: TwinScene = dtoToScene(item)
          upsertTwinScene(scene)
          setActiveTwinScene(item.id)
          return (
            <TwinPage
              scene={scene}
              onSave={async (patch) => {
                const dtoPatch = sceneToDTO(patch)
                await save({ ...dtoPatch, id: item.id })
                // 同步更新 store 镜像
                if (patch.entities) {
                  useDesignerStore.getState().updateTwinSceneEntities(
                    item.id,
                    patch.entities,
                    patch.env ?? { lighting: 'day', fog: false }
                  )
                } else if (patch.name) {
                  useDesignerStore.getState().renameTwinScene(item.id, patch.name)
                }
              }}
            />
          )
        }}
        renderPreview={(item) => {
          const scene: TwinScene = dtoToScene(item)
          upsertTwinScene(scene)
          setActiveTwinScene(item.id)
          return <TwinPage scene={scene} readOnly />
        }}
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