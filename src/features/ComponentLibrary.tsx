import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Select, Table, Tabs, type TableProps } from 'antd'
import { api } from '../mock'
import type {
  TwinSceneDTO,
  IoTDeviceDTO,
  WidgetDefDTO,
  WidgetVersionDTO,
  WidgetLifecycleStatus
} from '../mock/types'
import { screenApi } from '../api/screenApi'
import { screenToRoute } from '../api/screenAdapter'
import { loadScreenRoute, patchScreenRoute, saveScreenRoute } from '../api/screenRoutes'
import {
  deployEchartAsset,
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
import {
  createIoTComponent,
  syncIoTDeviceToDashboard,
  iotComponentAssets,
  type IoTWidgetKind
} from './iotWidgetCatalog'
import { Field, Input, Modal, Tag, Textarea } from './common'

const WIDGET_STATUS: Record<WidgetLifecycleStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: '#94a3b8' },
  published: { label: '已上架', color: '#4ade80' },
  deprecated: { label: '已弃用', color: '#facc15' },
  offline: { label: '已下架', color: '#f87171' }
}
const LIFECYCLE_ACTIONS: { status: WidgetLifecycleStatus; label: string }[] = [
  { status: 'published', label: '上架' },
  { status: 'deprecated', label: '弃用' },
  { status: 'offline', label: '下架' }
]

type LibraryAsset = ComponentAssetDefinition & { kind?: TwinWidgetKind | IoTWidgetKind }

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

const PREVIEW_IOT_DEVICE: IoTDeviceDTO = {
  id: 'preview_iot',
  name: 'PLC-01',
  type: 'PLC',
  status: 'online',
  metrics: { 温度: 36.5, 压力: 8.2, 流量: 120 },
  updatedAt: '2026-07-29'
}

function previewComponent(asset: LibraryAsset): ComponentInstance {
  if (asset.businessType === 'twin' && asset.kind) {
    const comp = createTwinComponent(PREVIEW_SCENE, asset.kind as TwinWidgetKind)
    if (asset.kind === 'scene') comp.props.preview = true
    return comp
  }
  if (asset.category === '物联组态' && 'kind' in asset && asset.kind) {
    const kind = asset.kind as IoTWidgetKind
    const comp =
      kind === 'metrics'
        ? createIoTComponent(PREVIEW_IOT_DEVICE, kind, '温度')
        : createIoTComponent(PREVIEW_IOT_DEVICE, kind)
    // 预览态：使用本地占位设备数据，避免向后端请求不存在的 preview_iot 而 404
    comp.props.preview = true
    return comp
  }
  if (asset.optionJson) {
    const definition = widgetRegistry.echartCustom
    return {
      id: `preview_${asset.key}`,
      type: 'echartCustom',
      style: definition.defaultStyle,
      props: { ...definition.defaultProps, optionJson: asset.optionJson }
    }
  }
  const definition = widgetRegistry[asset.type]
  const previewProps =
    asset.type === 'echartCustom' && asset.optionJson
      ? { ...definition.defaultProps, optionJson: asset.optionJson }
      : definition.defaultProps
  return {
    id: `preview_${asset.type}`,
    type: asset.type,
    style: definition.defaultStyle,
    props: previewProps
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
  const { data, reload } = useApi(() => api.listWidgets({ pageSize: 50 }), [])
  const { data: stats } = useApi(() => api.getWidgetStats(), [])
  const { data: twinData, reload: reloadTwins } = useApi(() => api.listTwinScenes({ pageSize: 100 }), [])
  const { data: iotData } = useApi(() => api.listIoTDevices({ pageSize: 100 }), [])
  const { data: screenData } = useApi(() => screenApi.list(), [])
  const dashboards = useMemo(() => (screenData ?? []).map(screenToRoute), [screenData])
  const registeredAssets = useMemo<LibraryAsset[]>(
    () =>
      (data?.list ?? [])
        .filter((w) => (w.category === 'ECharts' || w.kind === 'echarts') && !!w.optionJson)
        .map((w) => ({
          key: `registered:${w.type}`,
          name: w.name,
          category: 'ECharts',
          description: w.desc || 'AI 生成的 ECharts 组件',
          type: 'echartCustom' as const,
          businessType: 'general' as const,
          optionJson: w.optionJson,
          widgetId: w.id ?? w.type,
        })),
    [data],
  )
  const assets = useMemo<LibraryAsset[]>(
    () => [...standardComponentAssets, ...registeredAssets, ...twinComponentAssets, ...iotComponentAssets],
    [registeredAssets],
  )
  const categories = useMemo(() => ['全部', ...Array.from(new Set(assets.map((asset) => asset.category)))], [assets])
  const [category, setCategory] = useState('全部')
  const [deploying, setDeploying] = useState<LibraryAsset | null>(null)
  const [dashboardId, setDashboardId] = useState('')
  const [sceneId, setSceneId] = useState('')
  const [deviceId, setDeviceId] = useState('')
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<{ message: string; routeId?: string } | null>(null)
  // 组件中心：生命周期操作 + 版本弹层
  const [statusBusy, setStatusBusy] = useState<string | null>(null)
  const [versionFor, setVersionFor] = useState<WidgetDefDTO | null>(null)
  const [versions, setVersions] = useState<WidgetVersionDTO[] | null>(null)
  const [vForm, setVForm] = useState({ version: '', changelog: '' })
  const [vBusy, setVBusy] = useState(false)
  const items = assets.filter((asset) => category === '全部' || asset.category === category)
  const scenes = twinData?.list ?? []
  const devices = iotData?.list ?? []

  const widgetId = (w: WidgetDefDTO) => w.id ?? w.type

  const setLifecycle = async (w: WidgetDefDTO, status: WidgetLifecycleStatus) => {
    const id = widgetId(w)
    setStatusBusy(id)
    await api.setWidgetLifecycle(id, status)
    setStatusBusy(null)
    reload()
  }

  const openVersions = async (w: WidgetDefDTO) => {
    setVersionFor(w)
    setVersions(null)
    setVForm({ version: '', changelog: '' })
    const r = await api.getWidgetVersions(widgetId(w))
    if (r.code === 0) setVersions(r.data)
  }

  const publishVersion = async () => {
    if (!versionFor || !vForm.version.trim()) return
    setVBusy(true)
    const r = await api.publishWidgetVersion(widgetId(versionFor), { version: vForm.version.trim(), changelog: vForm.changelog.trim() })
    setVBusy(false)
    if (r.code === 0) {
      setVForm({ version: '', changelog: '' })
      const vr = await api.getWidgetVersions(widgetId(versionFor))
      if (vr.code === 0) setVersions(vr.data)
      reload()
    }
  }

  const widgetRows = data?.list ?? []
  const widgetColumns: TableProps<WidgetDefDTO>['columns'] = [
    { title: '类型', dataIndex: 'type', key: 'type' },
    { title: '名称', dataIndex: 'name', key: 'name' },
    { title: '分类', dataIndex: 'category', key: 'category', render: (v: string) => <Tag>{v}</Tag> },
    { title: '版本', dataIndex: 'version', key: 'version' },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s?: WidgetLifecycleStatus) => {
        const cur = s ?? 'draft'
        const m = WIDGET_STATUS[cur]
        return <span className={'status-dot ' + (cur === 'published' ? 'active' : 'disabled')}>{m.label}</span>
      }
    },
    {
      title: '生命周期',
      key: 'lifecycle',
      render: (_, w) => (
        <span style={{ display: 'inline-flex', gap: 4 }}>
          {LIFECYCLE_ACTIONS.map((a) => (
            <Button
              key={a.status}
              size="small"
              loading={statusBusy === widgetId(w) && w.status !== a.status}
              disabled={statusBusy === widgetId(w) || w.status === a.status}
              onClick={() => setLifecycle(w, a.status)}
            >
              {a.label}
            </Button>
          ))}
        </span>
      )
    },
    {
      title: '操作',
      key: 'op',
      render: (_, w) => (
        <Button size="small" type="link" onClick={() => openVersions(w)}>版本</Button>
      )
    }
  ]

  useEffect(() => {
    if (!deploying) return
    setDashboardId((current) => dashboards.some((route) => route.id === current) ? current : dashboards[0]?.id ?? '')
    setSceneId((current) => scenes.some((scene) => scene.id === current) ? current : scenes[0]?.id ?? '')
    setDeviceId((current) => devices.some((d) => d.id === current) ? current : devices[0]?.id ?? '')
  }, [dashboards, deploying, scenes, devices])

  const deploy = async () => {
    if (!deploying || !dashboardId) return
    const target = dashboards.find((item) => item.id === dashboardId)
    const route = await loadScreenRoute(dashboardId)
    if (!route) return setNotice({ message: '目标大屏不存在，请重新选择' })
    setBusy(true)
    try {
      if (deploying.category === '物联组态' && deploying.kind) {
        const device = devices.find((item) => item.id === deviceId)
        if (!device) {
          setNotice({ message: '请选择可用的物联设备' })
          return
        }
        const syncedAt = new Date().toISOString()
        const kinds: IoTWidgetKind[] = [deploying.kind as IoTWidgetKind]
        await saveScreenRoute(patchScreenRoute(route, syncIoTDeviceToDashboard(route, device, syncedAt, kinds)))
      } else if (deploying.businessType === 'twin' && deploying.kind) {
        const scene = scenes.find((item) => item.id === sceneId)
        if (!scene) {
          setNotice({ message: '请选择可用的数字孪生场景' })
          return
        }
        const syncedAt = new Date().toISOString()
        const response = await api.saveTwinScene({ id: scene.id, dashboardId, lastSyncAt: syncedAt })
        if (response.code !== 0) {
          setNotice({ message: response.message })
          return
        }
        if (scene.dashboardId && scene.dashboardId !== dashboardId) {
          const previousRoute = await loadScreenRoute(scene.dashboardId)
          if (previousRoute) {
            await saveScreenRoute(patchScreenRoute(previousRoute, unlinkTwinFromDashboard(previousRoute, scene.id)))
          }
        }
        await saveScreenRoute(patchScreenRoute(route, syncTwinWidgetsToDashboard(route, response.data, syncedAt, [deploying.kind as TwinWidgetKind])))
        reloadTwins()
      } else {
        if (deploying.optionJson) {
          await saveScreenRoute(patchScreenRoute(route, deployEchartAsset(route, deploying)))
        } else {
          await saveScreenRoute(patchScreenRoute(route, deployStandardAsset(route, deploying)))
        }
      }
      setDeploying(null)
      setNotice({ message: `「${deploying.name}」已投放到「${target?.name ?? route.name}」`, routeId: route.id })
    } finally {
      setBusy(false)
    }
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

      {/* 组件中心状态统计条 */}
      {stats && (
        <div className="component-library-summary" style={{ marginTop: 0, marginBottom: 14 }} aria-label="组件状态统计">
          {Object.entries(stats.byStatus).map(([k, v]) => (
            <span key={'s' + k}>{WIDGET_STATUS[k as WidgetLifecycleStatus]?.label ?? k} <strong>{v}</strong></span>
          ))}
          {Object.entries(stats.byCategory).map(([k, v]) => (
            <span key={'c' + k}>{k} <strong>{v}</strong></span>
          ))}
        </div>
      )}

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
              <span>{
                asset.businessType === 'twin'
                  ? '场景数据驱动'
                  : asset.category === '物联组态'
                  ? '物联数据驱动'
                  : '设计器原生组件'
              }</span>
              <Button type="primary" size="small" onClick={() => setDeploying(asset)}>投放到大屏</Button>
            </footer>
          </article>
        ))}
      </div>

      {/* 组件中心 · 已注册组件：生命周期 + 版本 */}
      <div className="component-library-widgets" style={{ marginTop: 18 }}>
        <h3 className="fp-sub" style={{ marginBottom: 8 }}>组件中心 · 已注册组件（生命周期 / 版本）</h3>
        <Table<WidgetDefDTO>
          size="small"
          rowKey={(w) => widgetId(w)}
          pagination={false}
          dataSource={widgetRows}
          locale={{ emptyText: '暂无已注册组件' }}
          columns={widgetColumns}
        />
      </div>

      {/* 版本弹层：列出版本 + 表单发布新版本 */}
      {versionFor && (
        <Modal title={`组件版本 · ${versionFor.name}（${versionFor.type}）`} onClose={() => setVersionFor(null)} width={520}>
          {versions === null ? (
            <div className="muted2">加载版本中…</div>
          ) : (
            <>
              <Table<WidgetVersionDTO>
                size="small"
                rowKey="id"
                pagination={false}
                locale={{ emptyText: '暂无版本' }}
                dataSource={versions}
                columns={[
                  { title: '版本', dataIndex: 'version', key: 'version' },
                  { title: '说明', dataIndex: 'changelog', key: 'changelog', render: (v: string) => <span className="muted">{v || '—'}</span> },
                  { title: '时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => <span className="muted">{v || '—'}</span> }
                ]}
              />
              <div style={{ marginTop: 14, borderTop: '1px solid var(--line)', paddingTop: 12 }}>
                <Field label="新版本号"><Input value={vForm.version} placeholder="如 1.1.0" onChange={(e) => setVForm({ ...vForm, version: e.target.value })} /></Field>
                <Field label="变更说明"><Textarea value={vForm.changelog} placeholder="本次变更内容" onChange={(e) => setVForm({ ...vForm, changelog: e.target.value })} /></Field>
                <div className="fp-toolbar" style={{ justifyContent: 'flex-end' }}>
                  <Button type="primary" loading={vBusy} disabled={!vForm.version.trim()} onClick={publishVersion}>发布新版本</Button>
                </div>
              </div>
            </>
          )}
        </Modal>
      )}

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
                options={scenes.map((scene) => ({ value: scene.id, label: `${scene.name} · ${scene.models?.length ?? 0} 个模型` }))}
              />
            </Field>
          )}
          {deploying.category === '物联组态' && (
            <Field label="物联设备">
              <Select
                style={{ width: '100%' }}
                value={deviceId || undefined}
                placeholder={devices.length ? '请选择设备' : '暂无可用设备'}
                onChange={setDeviceId}
                options={devices.map((d) => ({ value: d.id, label: `${d.name} · ${d.type} · ${Object.keys(d.metrics).length} 项指标` }))}
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
            {deploying.businessType === 'twin'
              ? '投放时将建立场景与大屏绑定；同一场景业务组件会原位更新。'
              : deploying.category === '物联组态'
              ? '投放时按设备状态与指标生成大屏组件；重复投放会更新已有实例，并保留已调整的布局。'
              : '同一组件资产重复投放会更新已有实例，并保留已调整的布局。'}
          </p>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <Button disabled={busy} onClick={() => setDeploying(null)}>取消</Button>
            <Button
              type="primary"
              loading={busy}
              disabled={!dashboardId || (deploying.businessType === 'twin' && !sceneId) || (deploying.category === '物联组态' && !deviceId)}
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
