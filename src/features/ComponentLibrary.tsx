import { useEffect, useMemo, useState } from 'react'
import { Alert, App, Button, Select, Table, Tabs } from 'antd'
import { Input as AntInput } from 'antd'
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
  registeredAssetsFromWidgets,
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
import { Field, Input, Modal, PageHeader, Tag, Textarea } from './common'
import ComponentLibraryAIAdjustModal from './ComponentLibraryAIAdjustModal'
import {
  applySchemaFileToWidget,
  parseWidgetSchemaFile,
  widgetToSchemaFile,
  type WidgetSchemaFile,
} from '../data/widgetSchemaIO'

/** 语义化版本号递增（1.0.0 → 1.0.1；非法值兜底 0.0.1） */
function bumpVersion(version?: string): string {
  const parts = String(version || '0.0.0')
    .split('.')
    .map((p) => parseInt(p, 10) || 0)
  while (parts.length < 3) parts.push(0)
  parts[2] += 1
  return parts.join('.')
}

const WIDGET_STATUS: Record<WidgetLifecycleStatus, { label: string; color: string }> = {
  draft: { label: '草稿', color: '#86868b' },
  published: { label: '已上架', color: '#34c759' },
  deprecated: { label: '已弃用', color: '#ff9500' },
  offline: { label: '已下架', color: '#ff3b30' }
}
type LibraryAsset = ComponentAssetDefinition & { kind?: TwinWidgetKind | IoTWidgetKind }

/** 统一卡片模型：资产视图 + 可选已注册组件引用（注册组件卡片带管理操作） */
type CardItem = {
  asset: LibraryAsset
  widget?: WidgetDefDTO
}

const PREVIEW_SCENE: TwinSceneDTO = {
  id: 'preview',
  name: '智慧园区',
  status: 'online',
  lighting: 'day',
  fog: false,
  models: [
    { id: 'a', modelId: 'a', name: '设备 A', geoType: 'box', color: '#0a84ff', x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
    { id: 'b', modelId: 'b', name: '设备 B', geoType: 'cylinder', color: '#0a84ff', x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 },
    { id: 'c', modelId: 'c', name: '设备 C', geoType: 'box', color: '#34c759', x: 0, y: 0, z: 0, rx: 0, ry: 0, rz: 0, scale: 1 }
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
  if (asset.sourceCode && (asset.type === 'htmlComponent' || asset.type === 'reactComponent')) {
    const definition = widgetRegistry[asset.type]
    return {
      id: `preview_${asset.key}`,
      type: asset.type,
      style: definition.defaultStyle,
      props: {
        ...definition.defaultProps,
        sourceCode: asset.sourceCode,
        sandboxMode: asset.sandboxMode ?? 'sandbox',
        catalogRenderer: asset.rendererType,
        catalogSourceId: `catalog:${asset.key}`,
      }
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
    () => registeredAssetsFromWidgets(data?.list ?? []),
    [data],
  )
  const assets = useMemo<LibraryAsset[]>(
    () => [...standardComponentAssets, ...registeredAssets, ...twinComponentAssets, ...iotComponentAssets],
    [registeredAssets],
  )
  const categories = useMemo(() => ['全部', ...Array.from(new Set(assets.map((asset) => asset.category)))], [assets])
  const { message } = App.useApp()
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
  const [adjustTarget, setAdjustTarget] = useState<WidgetDefDTO | null>(null)
  // 组件 schema 导入：文件解析 → 选择目标组件 → 保存即记版
  const [importOpen, setImportOpen] = useState(false)
  const [importError, setImportError] = useState('')
  const [importFile, setImportFile] = useState<WidgetSchemaFile | null>(null)
  const [importTarget, setImportTarget] = useState('')
  const [importVersion, setImportVersion] = useState('')
  const [importBusy, setImportBusy] = useState(false)
  // 搜索条件：关键词 / 生命周期状态 / 资产类型
  const [searchText, setSearchText] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | WidgetLifecycleStatus>('all')
  const [typeFilter, setTypeFilter] = useState<'all' | 'standard' | 'twin' | 'iot' | 'ai'>('all')
  const items = assets.filter((asset) => category === '全部' || asset.category === category)
  const scenes = twinData?.list ?? []
  const devices = iotData?.list ?? []
  const widgetRows = data?.list ?? []

  // 注册组件 → 卡片：按 widget.type 关联资产；无资产映射的注册组件（未收录）也展示为卡片
  const widgetByType = useMemo(
    () => new Map(widgetRows.map((w) => [w.type, w])),
    [widgetRows],
  )
  const cards = useMemo<CardItem[]>(() => {
    const mapped: CardItem[] = items.map((asset) => {
      const widget =
        asset.widgetId && widgetByType.get(asset.widgetId)
        || widgetByType.get(asset.type)
      return widget ? { asset, widget } : { asset }
    })
    // 已注册但未出现在资产网格的组件（如老数据），补为管理卡片（仅限有源码/option 的 AI 资产）
    for (const w of widgetRows) {
      if (!(w.sourceCode || w.optionJson)) continue
      if (items.some((a) => a.widgetId === (w.id ?? w.type) || a.type === w.type)) continue
      const asset = registeredAssetsFromWidgets([w])[0]
      if (asset) mapped.push({ asset, widget: w })
    }
    return mapped
  }, [items, widgetRows, widgetByType])

  /** 搜索/状态/类型过滤后的可见卡片 */
  const visibleCards = useMemo(() => {
    const kw = searchText.trim().toLowerCase()
    return cards.filter(({ asset, widget }) => {
      if (kw) {
        const hit =
          asset.name.toLowerCase().includes(kw) ||
          asset.type.toLowerCase().includes(kw) ||
          asset.description.toLowerCase().includes(kw)
        if (!hit) return false
      }
      if (statusFilter !== 'all') {
        const cur = widget?.status ?? 'draft'
        if (cur !== statusFilter) return false
      }
      if (typeFilter !== 'all') {
        const t = asset.businessType === 'twin'
          ? 'twin'
          : asset.category === '物联组态'
          ? 'iot'
          : (widget && (widget.sourceCode || widget.optionJson)) || asset.sourceCode || asset.optionJson
          ? 'ai'
          : 'standard'
        if (t !== typeFilter) return false
      }
      return true
    })
  }, [cards, searchText, statusFilter, typeFilter])

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

  /** 导出组件 → JSON schema 文件（下载） */
  const exportSchema = (w: WidgetDefDTO) => {
    const file = widgetToSchemaFile(w)
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${w.type || w.name}.schema.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** 读取导入文件 → 解析校验 → 打开导入弹窗 */
  const pickImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const { file: parsed, error } = parseWidgetSchemaFile(String(reader.result ?? ''))
      if (error || !parsed) {
        setImportError(error ?? '文件解析失败')
        setImportFile(null)
        setImportOpen(true)
        return
      }
      setImportError('')
      setImportFile(parsed)
      setImportTarget((cur) =>
        widgetRows.some((w) => w.type === cur) ? cur : (parsed.type ?? ''),
      )
      setImportOpen(true)
    }
    reader.readAsText(file)
  }

  /** 导入 schema → 应用到目标组件 → 发布新版本（保存即记版） */
  const confirmImport = async () => {
    if (!importFile) return
    const target = widgetRows.find((w) => w.type === importTarget)
    if (!target) {
      message.warning('请选择要导入的目标组件')
      return
    }
    setImportBusy(true)
    try {
      const r = await api.saveWidget(applySchemaFileToWidget(target, importFile))
      if (r.code !== 0) {
        message.error(r.message)
        return
      }
      const nextVersion = importVersion.trim() || bumpVersion(target.version)
      const vr = await api.publishWidgetVersion(target.type, {
        version: nextVersion,
        changelog: `从 schema 导入：${importFile.name}（${importFile.type}）`,
      })
      if (vr.code !== 0) {
        message.warning(`内容已更新，但版本记录失败：${vr.message}`)
      } else {
        message.success(`已导入为组件 ${target.type} 的新版本 v${nextVersion}`)
      }
      reload()
      setImportOpen(false)
      setImportFile(null)
      setImportTarget('')
      setImportVersion('')
    } finally {
      setImportBusy(false)
    }
  }

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
        } else if (deploying.sourceCode && (deploying.type === 'htmlComponent' || deploying.type === 'reactComponent')) {
          await saveScreenRoute(
            patchScreenRoute(route, deployStandardAsset(route, {
              ...deploying,
              type: deploying.type,
            }))
          )
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
      <PageHeader
        className="component-library-head"
        title="组件库"
        subtitle="统一管理标准组件与数字孪生业务组件，按资产键幂等投放到大屏"
        actions={<div className="component-library-summary" aria-label="组件资产统计">
              <span>标准组件 <strong>{standardComponentAssets.length}</strong></span>
              <span>孪生组件 <strong>{twinComponentAssets.length}</strong></span>
              <span>AI 源码组件 <strong>{registeredAssets.filter((a) => a.sourceCode).length}</strong></span>
              <span>服务已注册 <strong>{data?.list.length ?? 0}</strong></span>
            </div>}
      />

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

      {/* 搜索条件：关键词 / 状态 / 类型 */}
      <div className="component-library-toolbar">
        <AntInput.Search
          allowClear
          placeholder="搜索组件名称 / 类型 / 描述"
          value={searchText}
          onChange={(e) => setSearchText(e.target.value)}
          onSearch={(v) => setSearchText(v)}
          style={{ width: 260 }}
        />
        <Select
          style={{ width: 130 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: '全部状态' },
            ...Object.entries(WIDGET_STATUS).map(([value, m]) => ({ value, label: m.label })),
          ]}
        />
        <Select
          style={{ width: 130 }}
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'all', label: '全部类型' },
            { value: 'standard', label: '标准组件' },
            { value: 'twin', label: '孪生组件' },
            { value: 'iot', label: '物联组态' },
            { value: 'ai', label: 'AI 生成' },
          ]}
        />
        <span className="component-library-count">{visibleCards.length} 个组件</span>
      </div>

      <div className="component-library-grid">
        {visibleCards.map(({ asset, widget }) => (
          <article key={asset.key} className="card component-asset-card">
            <header>
              <div><b>{asset.name}</b><span>{asset.type}</span></div>
              <Tag>{asset.category}</Tag>
            </header>
            {widget && (
              <div className="component-card-status">
                <span className={'status-dot ' + ((widget.status ?? 'draft') === 'published' ? 'active' : 'disabled')}>
                  {WIDGET_STATUS[widget.status ?? 'draft'].label}
                </span>
                <span className="component-card-version">v{widget.version}</span>
              </div>
            )}
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
              {widget ? (
                <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                  {(widget.widget || widget.sourceCode || widget.optionJson) && (
                    <Button size="small" onClick={() => setAdjustTarget(widget)}>AI 调整</Button>
                  )}
                  <Button size="small" onClick={() => openVersions(widget)}>版本</Button>
                  <Button size="small" onClick={() => exportSchema(widget)}>导出</Button>
                  <Button size="small" onClick={() => { setImportTarget(widget.type); setImportOpen(true) }}>导入</Button>
                  <Button
                    size="small"
                    loading={statusBusy === widgetId(widget) && widget.status !== 'published'}
                    disabled={statusBusy === widgetId(widget) || widget.status === 'published'}
                    onClick={() => setLifecycle(widget, 'published')}
                  >
                    上架
                  </Button>
                  <Button
                    size="small"
                    danger
                    loading={statusBusy === widgetId(widget) && widget.status !== 'offline'}
                    disabled={statusBusy === widgetId(widget) || widget.status === 'offline' || !widget.status}
                    onClick={() => setLifecycle(widget, 'offline')}
                  >
                    下架
                  </Button>
                  <Button type="primary" size="small" onClick={() => setDeploying(asset)}>投放到大屏</Button>
                </span>
              ) : (
                <Button type="primary" size="small" onClick={() => setDeploying(asset)}>投放到大屏</Button>
              )}
            </footer>
          </article>
        ))}
      </div>
      {visibleCards.length === 0 && (
        <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--sub)', fontSize: 13 }}>
          没有符合条件的组件，试试调整搜索条件
        </div>
      )}

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

      {/* AI 调整已注册组件：迭代生成新源码/option，保存即记版 */}
      {adjustTarget && (
        <ComponentLibraryAIAdjustModal
          widget={adjustTarget}
          open
          onClose={() => setAdjustTarget(null)}
          onSaved={reload}
        />
      )}

      {/* 导入组件 schema：选择文件 → 解析校验 → 应用到目标组件（保存即记版） */}
      {importOpen && (
        <Modal title="导入组件 Schema" onClose={() => { if (!importBusy) { setImportOpen(false); setImportFile(null); setImportError('') } }} width={560}>
          <p style={{ marginTop: 0, color: 'var(--sub)' }}>
            导入 JSON schema 作为某个已注册组件的新版本（保存即记版），或先选择文件再应用到目标组件。
          </p>
          <Field label="Schema 文件">
            <input type="file" accept=".json,application/json" onChange={pickImportFile} />
          </Field>
          {importError && (
            <div style={{ color: '#ff3b30', fontSize: 12, marginBottom: 10 }}>⚠️ {importError}</div>
          )}
          {importFile && (
            <>
              <div style={{ fontSize: 12, color: 'var(--sub)', marginBottom: 10 }}>
                已解析：<b>{importFile.name}</b>（{importFile.type} · v{importFile.version ?? '—'}）
              </div>
              <Field label="目标组件">
                <Select
                  style={{ width: '100%' }}
                  value={importTarget || undefined}
                  placeholder="选择要导入到的已注册组件"
                  onChange={(v) => setImportTarget(v)}
                  options={widgetRows.map((w) => ({ value: w.type, label: `${w.name}（${w.type} · v${w.version}）` }))}
                />
              </Field>
              <Field label="新版本号" hint="留空则自动递增小版本">
                <Input value={importVersion} placeholder="如 1.1.0" onChange={(e) => setImportVersion(e.target.value)} />
              </Field>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
                <Button disabled={importBusy} onClick={() => { setImportOpen(false); setImportFile(null); setImportError('') }}>取消</Button>
                <Button
                  type="primary"
                  loading={importBusy}
                  disabled={!importFile || !importTarget}
                  onClick={confirmImport}
                >
                  导入为组件新版本
                </Button>
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
