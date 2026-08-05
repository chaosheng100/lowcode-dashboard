// ============================================================
// DTO 适配器：TwinSceneDTO（API 层） ↔ TwinScene（store/渲染层）
// 数字孪生列表（mock API）与大屏编辑器孪生模块之间的数据桥梁。
// ============================================================

import type { TwinSceneDTO, TwinSceneModel } from '../mock/types'
import type { TwinEntity, TwinScene } from './twinTypes'
import { healthToState } from './twinTypes'

/** TwinSceneModel → TwinEntity（API 模型 → 渲染实体） */
export function modelToEntity(m: TwinSceneModel): TwinEntity {
  return {
    id: m.id || m.modelId,
    modelId: m.modelId,
    assetUrl: m.assetUrl,
    name: m.name,
    geoType: m.geoType,
    color: m.color,
    x: m.x,
    y: m.y,
    z: m.z,
    rotationY: m.ry,
    scale: m.scale,
    state: 'normal',
    metrics: { temperature: 45, health: 80, load: 50 },
    visible: m.visible,
    locked: m.locked,
    material: m.material,
    animation: m.animation,
    bindings: m.bindings
  }
}

/** TwinEntity → TwinSceneModel（渲染实体 → API 模型） */
export function entityToModel(e: TwinEntity, modelId?: string): TwinSceneModel {
  return {
    id: e.id,
    modelId: modelId ?? e.id,
    assetUrl: e.assetUrl,
    name: e.name,
    geoType: e.geoType,
    color: e.color,
    x: e.x,
    y: e.y,
    z: e.z,
    rx: 0,
    ry: e.rotationY ?? 0,
    rz: 0,
    scale: e.scale ?? 1,
    visible: e.visible,
    locked: e.locked,
    material: e.material,
    animation: e.animation,
    bindings: e.bindings
  }
}

/** TwinSceneDTO → TwinScene（API 场景 → store 场景） */
export function dtoToScene(dto: TwinSceneDTO): TwinScene {
  return {
    id: dto.id,
    name: dto.name,
    entities: (dto.models ?? []).map(modelToEntity),
    env: { lighting: dto.lighting, fog: dto.fog },
    camera: { x: 8, y: 7, z: 10 },
    annotations: dto.annotations
  }
}

/** TwinScene → Partial<TwinSceneDTO>（store 场景 → API 更新 payload） */
export function sceneToDTO(scene: Partial<TwinScene>): Partial<TwinSceneDTO> {
  const patch: Partial<TwinSceneDTO> = {}
  if (scene.id !== undefined) patch.id = scene.id
  if (scene.name !== undefined) patch.name = scene.name
  if (scene.entities) patch.models = scene.entities.map((e) => entityToModel(e))
  if (scene.env) {
    patch.lighting = scene.env.lighting
    patch.fog = scene.env.fog
  }
  if (scene.annotations) patch.annotations = scene.annotations
  return patch
}

/**
 * 根据场景实体遥测聚合出整体状态。
 * 规则：任一实体 fault → maintenance；全部 normal → online；否则 offline。
 */
export function deriveSceneStatus(
  entities: TwinEntity[],
  live?: Record<string, { temperature: number; health: number; load: number }>
): 'online' | 'maintenance' | 'offline' {
  if (!entities.length) return 'offline'
  const states = entities.map((e) => {
    const lv = live?.[e.id]
    if (lv) return healthToState(lv.health, lv.temperature)
    return e.state
  })
  if (states.some((s) => s === 'fault')) return 'maintenance'
  if (states.every((s) => s === 'normal' || s === 'running')) return 'online'
  return 'offline'
}
