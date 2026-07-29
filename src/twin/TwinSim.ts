import {
  healthIndex,
  healthToState,
  type AlarmLevel,
  type AlarmRecord,
  type TelemetrySample,
  type TwinEntity,
  type TwinPrediction,
  type WhatIfResult,
  type WhatIfScenario
} from './twinTypes'

// ============================================================
// TwinSim：数字孪生仿真计算层（L4 仿真 / L5 决策）
// - 持续接收实体实时遥测 → 计算健康指数 / RUL(剩余寿命) / 预测状态；
// - 触发预测性维护告警（阈值越界或趋势恶化，带去重）；
// - runWhatIf() 决策沙盘：参数调整 → 产能/能耗/故障风险预测，驱动大屏 KPI 动态重算。
// MVP 用确定性规则 + 抖动；预留接后端 ML / 机理模型的扩展点（replaceHealthModel）。
// ============================================================

export interface SimTickResult {
  predictions: Record<string, TwinPrediction>
  alarms: AlarmRecord[]
}

export class TwinSim {
  private entities: TwinEntity[]
  /** 每个实体的去重基线，避免告警风暴 */
  private lastAlarmAt = new Map<string, number>()
  /** 可替换的健康/寿命模型（进阶接后端 ML 仿真服务） */
  private healthModel: (s: TelemetrySample) => number

  constructor(entities: TwinEntity[], healthModel?: (s: TelemetrySample) => number) {
    this.entities = entities
    this.healthModel = healthModel ?? ((s) => healthIndex(s.health, s.temperature, s.load))
  }

  setEntities(entities: TwinEntity[]): void {
    this.entities = entities
  }

  /** 每帧/每 tick 调用：输入各实体最新遥测，输出预测与新增告警 */
  tick(live: Record<string, TelemetrySample>): SimTickResult {
    const predictions: Record<string, TwinPrediction> = {}
    const alarms: AlarmRecord[] = []
    const now = Date.now()

    for (const e of this.entities) {
      const s = live[e.id]
      if (!s) continue
      const hi = this.healthModel(s)
      const state = healthToState(s.health, s.temperature)
      // RUL：健康指数越高、负载越低，剩余寿命越长（小时）
      const rul = Math.round((hi * 12 * (1 - s.load / 220)) / 1)
      const pred: TwinPrediction = {
        entityId: e.id,
        healthIndex: Math.round(hi),
        rul: Math.max(0, rul),
        state,
        confidence: 0.82 + Math.random() * 0.15,
        horizonH: 24
      }
      predictions[e.id] = pred

      // 预测性维护告警（带 60s 去重）
      const level = this.evaluateAlarm(s, hi)
      if (level) {
        const key = `${e.id}:${level}`
        const last = this.lastAlarmAt.get(key) ?? 0
        if (now - last > 60000) {
          this.lastAlarmAt.set(key, now)
          alarms.push({
            id: `al_${e.id}_${now}`,
            entityId: e.id,
            entityName: e.name,
            level,
            message: this.alarmMessage(level, e.name, s, hi),
            ts: now,
            metric: { temperature: Math.round(s.temperature), health: Math.round(s.health), load: Math.round(s.load) }
          })
        }
      }
    }
    return { predictions, alarms }
  }

  private evaluateAlarm(s: TelemetrySample, hi: number): AlarmLevel | null {
    if (s.temperature > 82 || hi < 40 || s.health < 35) return 'critical'
    if (s.temperature > 70 || hi < 62 || s.load > 92) return 'warning'
    if (hi < 75) return 'info'
    return null
  }

  private alarmMessage(level: AlarmLevel, name: string, s: TelemetrySample, hi: number): string {
    const t = Math.round(s.temperature)
    const h = Math.round(s.health)
    if (level === 'critical') return `${name} 健康度 ${h} / 温度 ${t}℃，已超限，建议立即停机检修`
    if (level === 'warning') return `${name} 健康度偏低(${h})，温度 ${t}℃，请关注运行工况`
    return `${name} 健康指数 ${Math.round(hi)}，存在劣化趋势，建议纳入巡检计划`
  }

  /**
   * What-if 决策沙盘：给定推演参数，输出未来产能/能耗/故障风险。
   * 确定性机理模型（演示用）：速度↑→产能↑但能耗非线性↑、故障风险↑；
   * 检修时长↑→故障风险↓、产能占用↓。
   */
  runWhatIf(scenario: WhatIfScenario): WhatIfResult {
    const speed = scenario.speed ?? 80
    const target = scenario.targetOutput ?? 100
    const budget = scenario.energyBudget ?? 100
    const maint = scenario.maintenanceHours ?? 0

    const predictedOutput = Math.round(target * (speed / 100) * (1 - maint / 600))
    const energy = Math.round(budget * (speed / 100) * (1 + Math.max(0, speed - 80) / 200))
    const faultRisk = Math.max(
      0,
      Math.min(100, Math.round((speed - 70) * 1.1 + (100 - maint) * 0.05 + (200 - budget) * 0.1))
    )

    const recommendations: string[] = []
    if (energy > budget) recommendations.push('能耗将超出预算，建议下调运行速度或扩容制冷')
    if (faultRisk > 60) recommendations.push('故障风险偏高，建议安排预防性检修或降速运行')
    if (maint > 0) recommendations.push(`已计入 ${maint}h 检修窗口，故障风险下降、产能占用相应腾挪`)
    if (recommendations.length === 0) recommendations.push('当前参数组合处于安全区间，可维持运行')

    return { predictedOutput, energy, faultRisk, recommendations }
  }
}
