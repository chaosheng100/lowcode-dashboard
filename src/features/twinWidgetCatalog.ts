import type { ComponentInstance, RouteConfig } from '../data/types'
import { mergeManagedComponents, type ComponentAssetDefinition } from '../data/registry/componentAssetRegistry'
import type { TwinGeometryType, TwinSceneDTO, TwinSceneStatus } from '../mock/types'

export type TwinWidgetKind = 'summary' | 'models' | 'geometry'

const STATUS_LABELS: Record<TwinSceneStatus, string> = {
  online: '在线运行',
  maintenance: '维护中',
  offline: '已离线'
}

const GEOMETRY_LABELS: Record<TwinGeometryType, string> = {
  box: '立方体',
  cylinder: '圆柱体',
  sphere: '球体',
  cone: '圆锥体',
  torus: '环形体',
  plane: '平面'
}

export const twinComponentAssets: Array<ComponentAssetDefinition & { kind: TwinWidgetKind }> = [
  { key: 'twin:summary', name: '孪生场景摘要', category: '数字孪生', description: '场景名称、运行状态与环境摘要', type: 'text', businessType: 'twin', kind: 'summary' },
  { key: 'twin:models', name: '孪生模型总数', category: '数字孪生', description: '当前场景模型资产总量', type: 'metric', businessType: 'twin', kind: 'models' },
  { key: 'twin:geometry', name: '模型类型分布', category: '数字孪生', description: '按几何类型展示场景模型构成', type: 'echartPie', businessType: 'twin', kind: 'geometry' }
]

export function twinSource(sceneId: string, kind: TwinWidgetKind): string {
  return `twin:${sceneId}:${kind}`
}

function assetFor(kind: TwinWidgetKind) {
  return twinComponentAssets.find((asset) => asset.kind === kind)!
}

export function createTwinComponent(scene: TwinSceneDTO, kind: TwinWidgetKind): ComponentInstance {
  const sourceId = twinSource(scene.id, kind)
  const asset = assetFor(kind)
  const sourceProps = {
    catalogKey: asset.key,
    catalogName: asset.name,
    catalogSourceId: sourceId,
    businessType: 'twin' as const,
    dataSourceId: sourceId,
    dataSourceName: scene.name
  }
  if (kind === 'models') {
    return {
      id: `twin_${scene.id}_models`,
      type: 'metric',
      style: { x: 60, y: 250, w: 360, h: 180 },
      props: {
        ...sourceProps,
        label: `${scene.name} · 场景模型`,
        unit: '个',
        data: [{ name: '模型数', value: scene.models?.length ?? 0 }]
      }
    }
  }
  if (kind === 'geometry') {
    const counts = (scene.models ?? []).reduce<Partial<Record<TwinGeometryType, number>>>((result, model) => {
      result[model.geoType] = (result[model.geoType] ?? 0) + 1
      return result
    }, {})
    const data = Object.entries(counts).map(([type, value]) => ({
      name: GEOMETRY_LABELS[type as TwinGeometryType],
      value
    }))
    return {
      id: `twin_${scene.id}_geometry`,
      type: 'echartPie',
      style: { x: 450, y: 250, w: 440, h: 300 },
      props: {
        ...sourceProps,
        title: `${scene.name} · 模型类型`,
        showLegend: true,
        data
      }
    }
  }
  return {
    id: `twin_${scene.id}_summary`,
    type: 'text',
    style: { x: 60, y: 150, w: 760, h: 72 },
    props: {
      ...sourceProps,
      content: `${scene.name} | ${STATUS_LABELS[scene.status]} | ${scene.lighting === 'day' ? '日照' : '夜景'}${scene.fog ? ' · 雾效' : ''}`,
      fontSize: 24,
      color: scene.status === 'online' ? '#5eead4' : scene.status === 'maintenance' ? '#fbbf24' : '#94a3b8',
      bold: true
    }
  }
}

function sceneSnapshot(scene: TwinSceneDTO, syncedAt: string) {
  return {
    sceneId: scene.id,
    sceneName: scene.name,
    status: scene.status,
    modelCount: scene.models?.length ?? 0,
    lighting: scene.lighting,
    fog: scene.fog,
    syncedAt
  }
}

export function syncTwinWidgetsToDashboard(
  route: RouteConfig,
  scene: TwinSceneDTO,
  syncedAt: string,
  kinds: TwinWidgetKind[] = twinComponentAssets.map((asset) => asset.kind)
): Partial<RouteConfig> {
  const managed = kinds.map((kind) => createTwinComponent(scene, kind))
  const sources = new Set(managed.map((component) => component.props.catalogSourceId))
  const migrated = route.components.map((component) => {
    const sourceId = component.props.catalogSourceId ?? component.props.dataSourceId
    return sourceId && sources.has(sourceId)
      ? { ...component, props: { ...component.props, catalogSourceId: sourceId } }
      : component
  })
  const previousScenes = typeof route.state.twinScenes === 'object' && route.state.twinScenes
    ? route.state.twinScenes as Record<string, unknown>
    : {}
  return {
    components: mergeManagedComponents(migrated, managed),
    state: {
      ...route.state,
      activeTwinSceneId: scene.id,
      twinScenes: { ...previousScenes, [scene.id]: sceneSnapshot(scene, syncedAt) }
    },
    updatedAt: syncedAt
  }
}

export function unlinkTwinFromDashboard(route: RouteConfig, sceneId: string): Partial<RouteConfig> {
  const previousScenes = typeof route.state.twinScenes === 'object' && route.state.twinScenes
    ? route.state.twinScenes as Record<string, unknown>
    : {}
  const twinScenes = { ...previousScenes }
  delete twinScenes[sceneId]
  const state: Record<string, unknown> = { ...route.state, twinScenes }
  if (state.activeTwinSceneId === sceneId) delete state.activeTwinSceneId
  return {
    components: route.components.filter((component) => {
      const sourceId = component.props.catalogSourceId ?? component.props.dataSourceId
      return !sourceId?.startsWith(`twin:${sceneId}:`)
    }),
    state,
    updatedAt: new Date().toISOString()
  }
}
