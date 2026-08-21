import { useMemo, useState } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { Input, Select } from 'antd'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import { widgetRegistry } from '../../data/registry/widgetRegistry'
import {
  standardComponentAssets,
  registeredAssetsFromWidgets,
  type ComponentAssetDefinition,
} from '../../data/registry/componentAssetRegistry'
import {
  twinComponentAssets,
  type TwinWidgetKind,
} from '../../features/twinWidgetCatalog'
import {
  iotComponentAssets,
  type IoTWidgetKind,
} from '../../features/iotWidgetCatalog'

/**
 * 左侧组件面板：不显示后端系统组件目录，完全以「组件库」页的资产为准
 * （标准组件 + 组件中心 AI 资产 + 数字孪生 + 物联组态），分类与组件库一致。
 * 孪生/物联资产需先选择场景/设备再拖入画布。
 */

type PanelDragData =
  | { type: string; preset?: { type: string; props?: Record<string, unknown> } }
  | {
      type: string
      asset: ComponentAssetDefinition
      twinKind?: TwinWidgetKind
      iotKind?: IoTWidgetKind
      sceneId?: string
      deviceId?: string
    }

interface PanelItem {
  key: string
  category: string
  name: string
  icon: React.ReactNode
  description?: string
  data: PanelDragData
  /** 孪生/物联资产：在组内渲染带选择器的特殊条目 */
  twinKind?: TwinWidgetKind
  iotKind?: IoTWidgetKind
}

function DraggableItem({
  item,
  disabled,
  hint,
}: {
  item: PanelItem
  disabled?: boolean
  hint?: string
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `panel-${item.key}`,
    disabled,
    data: item.data,
  })
  return (
    <div
      ref={setNodeRef}
      className={`cp-item${isDragging ? ' dragging' : ''}${disabled ? ' disabled' : ''}`}
      title={item.description ? `${item.name} · ${item.description}` : item.name}
      style={
        transform
          ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
          : undefined
      }
      {...listeners}
      {...attributes}
    >
      <span className="ico">{item.icon || '◆'}</span>
      <span>{item.name}</span>
      {hint && <span className="cp-hint">{hint}</span>}
    </div>
  )
}

function TwinAssetItem({
  item,
  scenes,
  selected,
  onSelect,
}: {
  item: PanelItem
  scenes: Array<{ id: string; name: string }>
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="cp-asset">
      <DraggableItem item={item} disabled={!selected} hint={selected ? undefined : '请先选择场景'} />
      <Select
        className="cp-asset-select"
        size="small"
        placeholder={scenes.length ? '选择数字孪生场景' : '暂无可用场景'}
        value={selected || undefined}
        onChange={onSelect}
        options={scenes.map((scene) => ({ value: scene.id, label: scene.name }))}
      />
    </div>
  )
}

function IoTAssetItem({
  item,
  devices,
  selected,
  onSelect,
}: {
  item: PanelItem
  devices: Array<{ id: string; name: string }>
  selected: string
  onSelect: (id: string) => void
}) {
  return (
    <div className="cp-asset">
      <DraggableItem item={item} disabled={!selected} hint={selected ? undefined : '请先选择设备'} />
      <Select
        className="cp-asset-select"
        size="small"
        placeholder={devices.length ? '选择物联设备' : '暂无可用设备'}
        value={selected || undefined}
        onChange={onSelect}
        options={devices.map((device) => ({ value: device.id, label: device.name }))}
      />
    </div>
  )
}

export default function ComponentPanel() {
  const [keyword, setKeyword] = useState('')
  const twinScenesMeta = useDesignerStore((s) => s.twinScenesMeta)
  const iotDevicesMeta = useDesignerStore((s) => s.iotDevicesMeta)
  const registeredWidgets = useDesignerStore((s) => s.registeredWidgets)
  const twinMetaLoading = useDesignerStore((s) => s.twinMetaLoading)
  const iotMetaLoading = useDesignerStore((s) => s.iotMetaLoading)

  const [twinSceneId, setTwinSceneId] = useState('')
  const [iotDeviceId, setIotDeviceId] = useState('')

  const scenes = useMemo(
    () =>
      Object.values(twinScenesMeta)
        .map((item) => {
          const scene = item as { id?: string; name?: string }
          return { id: scene.id ?? '', name: scene.name ?? '未命名场景' }
        })
        .filter((scene) => scene.id),
    [twinScenesMeta],
  )
  const devices = useMemo(
    () => iotDevicesMeta.map((device) => ({ id: device.id, name: device.name })),
    [iotDevicesMeta],
  )

  // 1) 标准组件（注册表，与组件库页共用）
  const standardItems = useMemo<PanelItem[]>(
    () =>
      standardComponentAssets.map((asset) => {
        const def = widgetRegistry[asset.type]
        return {
          key: `standard-${asset.type}`,
          category: def.category,
          name: def.name,
          icon: def.icon,
          description: asset.description,
          data: {
            type: asset.type,
            preset: { type: asset.type },
          },
        }
      }),
    [],
  )
  // 2) 组件中心已注册资产（AI 生成的 ECharts / 源码组件，与组件库页共用同一转换）
  const registeredItems = useMemo<PanelItem[]>(
    () =>
      registeredAssetsFromWidgets(registeredWidgets).map((asset) => ({
        key: `registered-${asset.key}`,
        category: asset.category,
        name: asset.name,
        icon: widgetRegistry[asset.type]?.icon ?? '◆',
        description: asset.description,
        data: {
          type: asset.type,
          asset: {
            ...asset,
            type: asset.type,
          },
        },
      })),
    [registeredWidgets],
  )
  // 3) 孪生资产（选中场景后拖入）
  const twinItems = useMemo<PanelItem[]>(
    () =>
      twinComponentAssets.map((asset) => ({
        key: `twin-${asset.key}`,
        category: asset.category,
        name: asset.name,
        icon: widgetRegistry[asset.type]?.icon ?? '◆',
        description: asset.description,
        data: {
          type: asset.type,
          asset: {
            ...asset,
            type: asset.type,
          },
          twinKind: asset.kind,
          sceneId: twinSceneId || undefined,
        },
        twinKind: asset.kind,
      })),
    [twinSceneId],
  )
  // 4) 物联资产（选中设备后拖入）
  const iotItems = useMemo<PanelItem[]>(
    () =>
      iotComponentAssets.map((asset) => ({
        key: `iot-${asset.key}`,
        category: asset.category,
        name: asset.name,
        icon: widgetRegistry[asset.type]?.icon ?? '◆',
        description: asset.description,
        data: {
          type: asset.type,
          asset: {
            ...asset,
            type: asset.type,
          },
          iotKind: asset.kind,
          deviceId: iotDeviceId || undefined,
        },
        iotKind: asset.kind,
      })),
    [iotDeviceId],
  )

  const allItems = useMemo(
    () => [...standardItems, ...registeredItems, ...twinItems, ...iotItems],
    [standardItems, registeredItems, twinItems, iotItems],
  )

  // 分类顺序与组件库页一致：资产出现顺序去重
  const groups = useMemo(() => {
    const kw = keyword.trim().toLowerCase()
    const filtered = allItems.filter(
      (item) =>
        !kw ||
        item.name.toLowerCase().includes(kw) ||
        item.category.toLowerCase().includes(kw) ||
        (item.description ?? '').toLowerCase().includes(kw),
    )
    const order = new Map<string, number>()
    allItems.forEach((item, index) => {
      if (!order.has(item.category)) order.set(item.category, index)
    })
    const map = new Map<string, PanelItem[]>()
    for (const item of filtered) {
      const list = map.get(item.category) || []
      list.push(item)
      map.set(item.category, list)
    }
    return Array.from(map.entries()).sort(
      (a, b) => (order.get(a[0]) ?? 999) - (order.get(b[0]) ?? 999),
    )
  }, [allItems, keyword])

  return (
    <div className="dlp-inner">
      <Input.Search
        className="cp-search"
        allowClear
        size="small"
        placeholder="搜索组件"
        value={keyword}
        onChange={(e) => setKeyword(e.target.value)}
      />
      {twinMetaLoading && <div className="cp-empty">加载孪生场景...</div>}
      {iotMetaLoading && <div className="cp-empty">加载物联设备...</div>}
      {!twinMetaLoading && !iotMetaLoading && scenes.length === 0 && (
        <div className="cp-empty">暂无孪生场景，可在数字孪生模块创建</div>
      )}
      {!iotMetaLoading && devices.length === 0 && (
        <div className="cp-empty">暂无物联设备</div>
      )}
      {groups.map(([cat, items]) => (
        <div className="cp-group" key={cat}>
          <h4>{cat}</h4>
          {items.map((item) =>
            item.twinKind ? (
              <TwinAssetItem
                key={item.key}
                item={item}
                scenes={scenes}
                selected={twinSceneId}
                onSelect={setTwinSceneId}
              />
            ) : item.iotKind ? (
              <IoTAssetItem
                key={item.key}
                item={item}
                devices={devices}
                selected={iotDeviceId}
                onSelect={setIotDeviceId}
              />
            ) : (
              <DraggableItem key={item.key} item={item} />
            ),
          )}
        </div>
      ))}
      {groups.length === 0 && !twinMetaLoading && !iotMetaLoading && (
        <div className="cp-empty">暂无组件</div>
      )}
    </div>
  )
}
