import type { TwinEntity, TelemetrySample } from './twinTypes'
import type { TwinSource } from './sources/TwinSource'
import { subscribeLive } from '../data/live/liveClient'

export type { TelemetrySample } from './twinTypes'

// ============================================================
// TwinDataBridge：孪生体 ↔ 实时数据的映射层（L1 接入 / L2 数据）
// 把实时指标写入实体属性，并驱动渲染器状态变化（颜色/告警）。
// 数据源可切换：
//   1) createTelemetrySimulator —— 本地随机游走模拟（无后端也能演示）
//   2) subscribeTwinLive —— 复用现有 liveClient（SQL/WS/MQTT 经代理推送）
//   3) subscribeTwinSource —— 接入多源适配器（Simulated/Industrial/BIM/GIS）
// 三者都回调 onUpdate(id, sample)，由调用方写入渲染器与 HUD。
// ============================================================

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** 本地模拟遥测：每个实体指标随机游走，体现"实时数据驱动孪生体" */
export function createTelemetrySimulator(
  entities: TwinEntity[],
  onUpdate: (id: string, sample: TelemetrySample) => void,
  intervalMs = 1500
): { stop: () => void } {
  const state = new Map<string, TelemetrySample>()
  entities.forEach((e) =>
    state.set(e.id, {
      temperature: e.metrics?.temperature ?? 30 + Math.random() * 40,
      health: e.metrics?.health ?? 60 + Math.random() * 35,
      load: e.metrics?.load ?? 30 + Math.random() * 50
    })
  )

  const tick = () => {
    entities.forEach((e) => {
      const s = state.get(e.id)!
      const temperature = clamp(s.temperature + (Math.random() - 0.5) * 9, 20, 95)
      const health = clamp(s.health + (Math.random() - 0.5) * 7, 5, 100)
      const load = clamp(s.load + (Math.random() - 0.5) * 16, 0, 100)
      const next = { temperature, health, load }
      state.set(e.id, next)
      onUpdate(e.id, next)
    })
  }

  tick()
  const timer = setInterval(tick, intervalMs)
  return { stop: () => clearInterval(timer) }
}

/**
 * 接入真实实时源：复用 liveClient 订阅，把推送点按序映射到各实体（MVP 轮询映射）。
 * 进阶可改为按 bindings.fields 做字段级映射。
 */
export function subscribeTwinLive(
  liveSourceId: string,
  entities: TwinEntity[],
  onUpdate: (id: string, sample: TelemetrySample) => void,
  intervalMs = 2000
): () => void {
  return subscribeLive(
    liveSourceId,
    (points) => {
      entities.forEach((e, i) => {
        const pt = points[i % Math.max(points.length, 1)]
        if (!pt) return
        onUpdate(e.id, {
          temperature: 40 + (pt.value % 60),
          health: 100 - (pt.value % 70),
          load: pt.value % 100
        })
      })
    },
    intervalMs
  )
}

/**
 * 多源适配器接入：周期性调用 source.read() 拉取各实体最新遥测快照，
 * 按实体 id 映射到 onUpdate。支持 Simulated / Industrial / BIM / GIS 等任意 TwinSource 实现。
 */
export function subscribeTwinSource(
  source: TwinSource,
  entities: TwinEntity[],
  onUpdate: (id: string, sample: TelemetrySample) => void,
  intervalMs = 1500
): () => void {
  const timer = setInterval(async () => {
    try {
      const snap = await source.read()
      entities.forEach((e) => {
        const s = snap[e.id]
        if (s) onUpdate(e.id, s)
      })
    } catch {
      /* 读取失败：静默跳过，下一次重试 */
    }
  }, intervalMs)
  source.connect().catch(() => undefined)
  return () => {
    clearInterval(timer)
    source.disconnect()
  }
}
