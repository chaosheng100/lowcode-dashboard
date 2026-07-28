import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Select, Tabs } from 'antd'
import { api } from '../mock'
import type { TwinSceneDTO } from '../mock/types'
import { useDesignerStore } from '../data/store/useDesignerStore'
import {
  deployStandardAsset,
  standardComponentAssets,
  type ComponentAssetDefinition
} from '../data/registry/componentAssetRegistry'
import { widgetRegistry } from '../data/registry/widgetRegistry'
import type { ComponentInstance } from '../data/types'
import WidgetRenderer from '../designer/widgets/WidgetRenderer'
import { openEditorWindow, openPreviewWindow } from '../designer/window'
import { useApi } from './useApi'
import {
  createTwinComponent,
  syncTwinWidgetsToDashboard,
  twinComponentAssets,
  unlinkTwinFromDashboard,
  type TwinWidgetKind
} from './twinWidgetCatalog'
import { Field, Modal, Tag } from './common'

type LibraryAsset = ComponentAssetDefinition & { kind?: TwinWidgetKind }

const PREVIEW_SCENE: TwinSceneDTO = {
  id: 'preview',
  name: '智慧园区',
  status: 'online',
  lighting: 'day',
  fog: false,
  models: [
    { id: 'a', modelId: 'a', name: '设备 A', geoType: 'box', color: '#22d3ee', x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
    { id: 'b', modelId: 'b', name: '设备 B', geoType: 'cylinder', color: '#4f8cff', x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
    { id: 'c', modelId: 'c', name: '设备 C', geoType: 'box', color: '#4ade80', x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }
  ],
  updatedAt: ''
}

function previewComponent(asset: LibraryAsset): ComponentInstance {
  if (asset.businessType === 'twin' && asset.kind) return createTwinComponent(PREVIEW_SCENE, asset.kind)
  const definition = widgetRegistry[asset.type]
  return {
    id: `preview_${asset.type}`,
    type: asset.type,
    style: definition.defaultStyle,
    props: definition.defaultProps
  }
}

function AssetPreview({ asset }: { asset: LibraryAsset }) {
  const component = useMemo(() => previewComponent(asset), [asset])
  return (
    <div className="component-preview" aria-hidden="true">
      <WidgetRenderer component={component} />
    </div>
  )
}

export default function ComponentLibrary() {
  const { data } = useApi(() => api.listWidgets({ pageSize: 50 }), [])
  const { data: twinData, reload: reloadTwins } = useApi(() => api.listTwinScenes({ pageSize: 100 }), [])
  const routes = useDesignerStore((state) => state.routes)
  const updateRoute = useDesignerStore((state) => state.updateRoute)
  const dashboards = useMemo(() => routes.filter((route) => route.kind === 'dashboard'), [routes])
  const assets = useMemo<LibraryAsset[]>(() => [...standardComponentAssets, ...twinComponentAssets], [])
  const categories = useMemo(() => ['全部', ...Array.from(new Set(assets.map((asset) => asset.category)))], [assets])
  const [category, setCategory] = useState('全部')
  const [deploying, setDeploying] = useState<LibraryAsset | null>(null)
  const [dashboardId, setDashboardId] = useState('')
  const [sceneId, setSceneId] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ message: string; routeId?: string } | null>(null)
  const items = assets.filter((asset) => category === '全部' || asset.category === category)
  const scenes = twinData?.list ?? []

  useEffect(() => {
    if (!deploying) return
    setDashboardId((current) => dashboards.some((route) => route.id === current) ? current : dashboards[0]?.id ?? '')
    setSceneId((current) => scenes.some((scene) => scene.id === current) ? current : scenes[0]?.id ?? '')
  }, [dashboards, deploying, scenes])

  const deploy = async () => {
    if (!deploying || !dashboardId) return
    const route = routes.find((item) => item.id === dashboardId && item.kind === 'dashboard')
    if (!route) return setNotice({ message: '目标大屏不存在，请重新选择' })
    setBusy(true)
    if (deploying.businessType === 'twin' && deploying.kind) {
      const scene = scenes.find((item) => item.id === sceneId)
      if (!scene) {
        setBusy(false)
        return setNotice({ message: '请选择可用的数字孪生场景' })
      }
      const syncedAt = new Date().toISOString()
      const response = await api.saveTwinScene({ id: scene.id, dashboardId, lastSyncAt: syncedAt })
      if (response.code !== 0) {
        setBusy(false)
        return setNotice({ message: response.message })
      }
      if (scene.dashboardId && scene.dashboardId !== dashboardId) {
        const previousRoute = routes.find((item) => item.id === scene.dashboardId)
        if (previousRoute) updateRoute(previousRoute.id, unlinkTwinFromDashboard(previousRoute, scene.id))
      }
      updateRoute(route.id, syncTwinWidgetsToDashboard(route, response.data, syncedAt, [deploying.kind]))
      reloadTwins()
    } else {
      updateRoute(route.id, deployStandardAsset(route, deploying))
    }
    setBusy(false)
    setDeploying(null)
    setNotice({ message: `「${deploying.name}」已投放到「${route.name}」`, routeId: route.id })
  }

  return (
    <div className="feature-page component-library-page">
      <div className="fp-head component-library-head">
        <div>
          <h2 className="fp-title">组件库</h2>
          <p className="fp-sub">统一管理标准组件与数字孪生业务组件，按资产键幂等投放到大屏</p>
        </div>
        <div className="component-library-summary" aria-label="组件资产统计">
          <span>标准组件 <strong>{standardComponentAssets.length}</strong></span>
          <span>孪生组件 <strong>{twinComponentAssets.length}</strong></span>
          <span>服务已注册 <strong>{data?.list.length ?? 0}</strong></span>
        </div>
      </div>

      {/* 投放结果提示：带快捷操作（打开编辑器 / 预览大屏） */}
      {notice && (
        <Alert
          showIcon
          closable
          style={{ marginBottom: 12 }}
          message={notice.message}
          onClose={() => setNotice(null)}
          action={
            notice.routeId && (
              <>
                <Button size="small" onClick={() => openEditorWindow(notice.routeId!)}>打开编辑器</Button>
                <Button size="small" onClick={() => openPreviewWindow(notice.routeId!)}>预览大屏</Button>
              </>
            )
          }
        />
      )}

      <Tabs
        className="component-library-tabs"
        activeKey={category}
        onChange={setCategory}
        items={categories.map((item) => ({ key: item, label: item }))}
      />

      <div className="component-library-grid">
        {items.map((asset) => (
          <article key={asset.key} className="card component-asset-card">
            <header>
              <div><b>{asset.name}</b><span>{asset.type}</span></div>
              <Tag>{asset.category}</Tag>
            </header>
            <AssetPreview asset={asset} />
            <p>{asset.description}</p>
            <footer>
              <span>{asset.businessType === 'twin' ? '场景数据驱动' : '设计器原生组件'}</span>
              <Button type="primary" size="small" onClick={() => setDeploying(asset)}>投放到大屏</Button>
            </footer>
          </article>
        ))}
      </div>

      {/* 投放弹窗：Esc/遮罩关闭由 antd Modal 托管（busy 时禁止关闭） */}
      {deploying && (
        <Modal title="投放组件到大屏" onClose={() => { if (!busy) setDeploying(null) }}>
          <p style={{ marginTop: 0, color: 'var(--sub)' }}>{deploying.name} · {deploying.description}</p>
          {deploying.businessType === 'twin' && (
            <Field label="数字孪生场景">
              <Select
                style={{ width: '100%' }}
                value={sceneId || undefined}
                placeholder={scenes.length ? '请选择场景' : '暂无可用场景'}
                onChange={setSceneId}
                options={scenes.map((scene) => ({ value: scene.id, label: `${scene.name} · ${scene.models.length} 个模型` }))}
              />
            </Field>
          )}
          <Field label="目标大屏">
            <Select
              style={{ width: '100%' }}
              value={dashboardId || undefined}
              placeholder={dashboards.length ? '请选择大屏' : '暂无可用大屏'}
              onChange={setDashboardId}
              options={dashboards.map((dashboard) => ({ value: dashboard.id, label: `${dashboard.name} · ${dashboard.components.length} 个组件` }))}
            />
          </Field>
          <p style={{ color: 'var(--sub)', fontSize: 12, lineHeight: 1.6 }}>
            {deploying.businessType === 'twin' ? '投放时将建立场景与大屏绑定；同一场景业务组件会原位更新。' : '同一组件资产重复投放会更新已有实例，并保留已调整的布局。'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button disabled={busy} onClick={() => setDeploying(null)}>取消</Button>
            <Button
              type="primary"
              loading={busy}
              disabled={!dashboardId || (deploying.businessType === 'twin' && !sceneId)}
              onClick={deploy}
            >
              {busy ? '投放中...' : '确认投放'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
