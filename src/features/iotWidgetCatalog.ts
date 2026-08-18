// ============================================================
// IoT 组件目录：物联组态 → 大屏投放的标准化组件资产定义
// 参照 twinWidgetCatalog.ts 模式，提供统一的组件创建、同步、解绑工具。
// ============================================================

import type { ComponentInstance, RouteConfig } from '../data/types'
import { mergeManagedComponents, type ComponentAssetDefinition } from '../data/registry/componentAssetRegistry'
import type { IoTDeviceDTO, IoTDeviceStatus } from '../mock/types'

export type IoTWidgetKind = 'summary' | 'metrics' | 'alarm'

const STATUS_LABELS: Record<IoTDeviceStatus, string> = {
  online: '在线运行',
  offline: '已离线',
  alarm: '告警'
}

const STATUS_COLORS: Record<IoTDeviceStatus, string> = {
  online: '#34c759',
  offline: '#86868b',
  alarm: '#ff3b30'
}

export const iotComponentAssets: Array<ComponentAssetDefinition & { kind: IoTWidgetKind }> = [
  {
    key: 'iot:summary',
    name: '设备摘要',
    category: '物联组态',
    description: '设备名称、运行状态与指标摘要',
    type: 'text',
    businessType: 'general',
    kind: 'summary'
  },
  {
    key: 'iot:metrics',
    name: '设备指标卡',
    category: '物联组态',
    description: '设备采集指标实时展示',
    type: 'metric',
    businessType: 'general',
    kind: 'metrics'
  },
  {
    key: 'iot:alarm',
    name: '设备告警清单',
    category: '物联组态',
    description: '设备告警规则与触发状态',
    type: 'table',
    businessType: 'general',
    kind: 'alarm'
  }
]

export function iotSource(deviceId: string, kind: IoTWidgetKind): string {
  return `iot:${deviceId}:${kind}`
}

function assetFor(kind: IoTWidgetKind) {
  return iotComponentAssets.find((a) => a.kind === kind)!
}

/** 创建单个 IoT 设备组件 */
export function createIoTComponent(
  device: IoTDeviceDTO,
  kind: IoTWidgetKind,
  metric?: string
): ComponentInstance {
  const sourceId = iotSource(device.id, kind)
  const asset = assetFor(kind)
  const baseProps = {
    catalogKey: asset.key,
    catalogName: asset.name,
    catalogSourceId: sourceId,
    businessType: 'general' as const,
    dataSourceId: sourceId,
    dataSourceName: device.name,
    iotDeviceId: device.id
  }

  if (kind === 'alarm') {
    return {
      id: `iot_${device.id}_alarm`,
      type: 'table',
      style: { x: 80, y: 500, w: 600, h: 260 },
      props: {
        ...baseProps,
        title: `${device.name} · 告警清单`,
        iotDeviceId: device.id
      }
    }
  }

  if (kind === 'metrics') {
    const metricName = metric ?? Object.keys(device.metrics)[0] ?? '指标'
    const value = device.metrics[metricName] ?? 0
    return {
      id: `iot_${device.id}_metric_${encodeURIComponent(metricName)}`,
      type: 'metric',
      style: { x: 80, y: 250, w: 320, h: 150 },
      props: {
        ...baseProps,
        label: `${device.name} · ${metricName}`,
        unit: '',
        data: [{ name: metricName, value }],
        iotMetric: metricName
      }
    }
  }

  // summary
  return {
    id: `iot_${device.id}_summary`,
    type: 'text',
    style: { x: 80, y: 150, w: 760, h: 72 },
    props: {
      ...baseProps,
      content: `${device.name} · ${STATUS_LABELS[device.status]}`,
      fontSize: 24,
      color: STATUS_COLORS[device.status],
      bold: true
    }
  }
}

/** 设备快照（存入 route.state.iotBindings） */
export interface IoTBindingSnapshot {
  deviceId: string
  deviceName: string
  deviceType: string
  status: IoTDeviceStatus
  metricCount: number
  syncedAt: string
}

function deviceSnapshot(device: IoTDeviceDTO, syncedAt: string): IoTBindingSnapshot {
  return {
    deviceId: device.id,
    deviceName: device.name,
    deviceType: device.type,
    status: device.status,
    metricCount: Object.keys(device.metrics).length,
    syncedAt
  }
}

/** 将设备的所有组件同步到大屏路由 */
export function syncIoTDeviceToDashboard(
  route: RouteConfig,
  device: IoTDeviceDTO,
  syncedAt: string,
  kinds: IoTWidgetKind[] = iotComponentAssets.map((a) => a.kind)
): Partial<RouteConfig> {
  const managed: ComponentInstance[] = []
  for (const kind of kinds) {
    if (kind === 'metrics') {
      // 为每个指标创建独立的指标卡
      for (const metric of Object.keys(device.metrics)) {
        managed.push(createIoTComponent(device, kind, metric))
      }
    } else {
      managed.push(createIoTComponent(device, kind))
    }
  }

  const sources = new Set(managed.map((c) => c.props.catalogSourceId))
  // 清理旧版 syncDeviceToDashboard 投放的同设备组件（无 catalogSourceId），避免与新目录组件重复
  const withoutLegacy = route.components.filter(
    (c) => !(c.props.iotDeviceId === device.id && !c.props.catalogSourceId)
  )
  const migrated = withoutLegacy.map((c) => {
    const sourceId = c.props.catalogSourceId ?? c.props.dataSourceId
    return sourceId && sources.has(sourceId)
      ? { ...c, props: { ...c.props, catalogSourceId: sourceId } }
      : c
  })

  const previousBindings = Array.isArray(route.state.iotBindings)
    ? (route.state.iotBindings as IoTBindingSnapshot[])
    : []
  const nextBindings = previousBindings.some((b) => b.deviceId === device.id)
    ? previousBindings.map((b) =>
        b.deviceId === device.id ? deviceSnapshot(device, syncedAt) : b
      )
    : [...previousBindings, deviceSnapshot(device, syncedAt)]

  return {
    components: mergeManagedComponents(migrated, managed),
    state: {
      ...route.state,
      iotBindings: nextBindings
    },
    updatedAt: syncedAt
  }
}

/** 从大屏路由解绑设备（移除该设备的所有组件） */
export function unlinkIoTFromDashboard(
  route: RouteConfig,
  deviceId: string
): Partial<RouteConfig> {
  const previousBindings = Array.isArray(route.state.iotBindings)
    ? (route.state.iotBindings as IoTBindingSnapshot[])
    : []
  return {
    components: route.components.filter(
      (c) => c.props.iotDeviceId !== deviceId
    ),
    state: {
      ...route.state,
      iotBindings: previousBindings.filter((b) => b.deviceId !== deviceId)
    },
    updatedAt: new Date().toISOString()
  }
}