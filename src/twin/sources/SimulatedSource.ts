import type { TelemetrySample, TwinEntity, TwinSourceStatus } from '../twinTypes'
import type { TwinSource } from './TwinSource'

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

/** 本地模拟遥测源：每个实体指标随机游走，无需后端即可演示“实时数据驱动孪生体”。 */
export class SimulatedSource implements TwinSource {
  kind = 'simulated'
  protected state = new Map<string, TelemetrySample>()
  protected statusObj: TwinSourceStatus = { kind: 'simulated', connected: false }

  constructor(protected entities: TwinEntity[], seedHealth = 70) {
    entities.forEach((e) =>
      this.state.set(e.id, {
        temperature: 30 + Math.random() * 30,
        health: seedHealth + Math.random() * 25,
        load: 30 + Math.random() * 40
      })
    )
  }

  async connect(): Promise<void> {
    this.statusObj = { kind: 'simulated', connected: true, message: '本地模拟源已连接' }
  }

  async read(): Promise<Record<string, TelemetrySample>> {
    const out: Record<string, TelemetrySample> = {}
    for (const [id, s] of this.state) {
      const next: TelemetrySample = {
        temperature: clamp(s.temperature + (Math.random() - 0.5) * 9, 20, 95),
        health: clamp(s.health + (Math.random() - 0.5) * 7, 5, 100),
        load: clamp(s.load + (Math.random() - 0.5) * 16, 0, 100)
      }
      this.state.set(id, next)
      out[id] = next
    }
    this.statusObj.lastTs = Date.now()
    return out
  }

  disconnect(): void {
    this.statusObj = { kind: 'simulated', connected: false }
  }

  status(): TwinSourceStatus {
    return this.statusObj
  }
}
