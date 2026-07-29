import type { TwinScene, TwinEntity } from './twinTypes'

/**
 * 演示孪生场景：一座小型工厂/园区，含多类设备实体。
 * 实体 id 稳定，便于与大屏其它组件通过 filterField='entityId' 联动。
 * MVP 阶段作为 TwinWidget 的默认场景；后续可由 TwinPage 编辑产出并写入 store。
 */
export function createDemoScene(): TwinScene {
  const entities: TwinEntity[] = [
    { id: 'bld-a', name: '综合楼A', geoType: 'box', color: '#4f8cff', x: -4, y: 0.6, z: -2, scale: 1.2, state: 'running', metrics: { temperature: 52, health: 88, load: 60 } },
    { id: 'bld-b', name: '厂房B', geoType: 'box', color: '#22d3ee', x: 2.5, y: 0.6, z: -3, scale: 1.4, state: 'running', metrics: { temperature: 58, health: 82, load: 72 } },
    { id: 'tank-1', name: '储罐01', geoType: 'cylinder', color: '#a855f7', x: -3, y: 0.8, z: 3, scale: 1, state: 'idle', metrics: { temperature: 44, health: 70, load: 35 } },
    { id: 'tank-2', name: '球形罐02', geoType: 'sphere', color: '#4ade80', x: 0.5, y: 0.6, z: 3.2, scale: 1, state: 'running', metrics: { temperature: 47, health: 91, load: 48 } },
    { id: 'tower-1', name: '冷却塔', geoType: 'cone', color: '#f59e0b', x: 5, y: 0.9, z: 1.5, scale: 1.1, state: 'fault', metrics: { temperature: 86, health: 38, load: 90 } },
    { id: 'chimney-1', name: '烟囱', geoType: 'cylinder', color: '#ef4444', x: -6, y: 1.2, z: -4, scale: 0.8, state: 'idle', metrics: { temperature: 61, health: 64, load: 30 } }
  ]

  return {
    id: 'demo-plant',
    name: '示范工厂孪生场景',
    entities,
    env: { lighting: 'day', fog: false },
    camera: { x: 8, y: 7, z: 10 }
  }
}
