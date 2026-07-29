import { create } from 'zustand'
import type { AlarmRecord, ControlCommand, TwinPrediction, TwinSourceStatus } from './twinTypes'

// ============================================================
// 孪生运行时 store：跨组件共享的“仿真 / 告警 / 控制 / 数据源”状态。
// 与设计师主 store（useDesignerStore，承载 routes/components）解耦，
// 由 TwinWidget（写入遥测/仿真结果）、AlarmListWidget（读取告警）、
// TwinPage（控制面板/告警面板）共享。属于孪生模块的“决策/应用层”内存态。
// ============================================================

interface TwinRuntimeState {
  /** 当前选中实体（点击实体 / 点击告警时同步） */
  selectedEntityId: string | null
  /** 实体实时指标快照（id → 温度/健康/负载/状态），由 TwinWidget 持续写入 */
  live: Record<string, { temperature: number; health: number; load: number; state: string }>
  /** 仿真预测结果（id → TwinPrediction） */
  predictions: Record<string, TwinPrediction>
  /** 告警清单（预测性维护产出），按 ts 倒序 */
  alarms: AlarmRecord[]
  /** 已下发控制指令日志（闭环可追溯） */
  controls: ControlCommand[]
  /** 数据源连接状态（多源接入层上报） */
  sourceStatus: TwinSourceStatus | null
  /** What-if 推演结果（决策沙盘） */
  whatIf: { scenario: Record<string, number>; result: { predictedOutput: number; energy: number; faultRisk: number; recommendations: string[] } } | null

  setSelectedEntity: (id: string | null) => void
  setLive: (id: string, v: { temperature: number; health: number; load: number; state: string }) => void
  setPredictions: (preds: Record<string, TwinPrediction>) => void
  pushAlarm: (a: AlarmRecord) => void
  clearAlarms: () => void
  pushControl: (c: ControlCommand) => void
  setSourceStatus: (s: TwinSourceStatus | null) => void
  setWhatIf: (scenario: Record<string, number>, result: { predictedOutput: number; energy: number; faultRisk: number; recommendations: string[] }) => void
}

export const useTwinRuntimeStore = create<TwinRuntimeState>((set) => ({
  selectedEntityId: null,
  live: {},
  predictions: {},
  alarms: [],
  controls: [],
  sourceStatus: null,
  whatIf: null,

  setSelectedEntity: (id) => set({ selectedEntityId: id }),
  setLive: (id, v) => set((s) => ({ live: { ...s.live, [id]: v } })),
  setPredictions: (preds) => set({ predictions: preds }),
  pushAlarm: (a) =>
    set((s) => {
      // 同实体同级别 60s 内去重，避免告警刷屏
      const now = Date.now()
      const dup = s.alarms.find(
        (x) => x.entityId === a.entityId && x.level === a.level && now - x.ts < 60000
      )
      if (dup) return s
      const next = [a, ...s.alarms].sort((x, y) => y.ts - x.ts).slice(0, 200)
      return { alarms: next }
    }),
  clearAlarms: () => set({ alarms: [] }),
  pushControl: (c) => set((s) => ({ controls: [c, ...s.controls].slice(0, 100) })),
  setSourceStatus: (sourceStatus) => set({ sourceStatus }),
  setWhatIf: (scenario, result) => set({ whatIf: { scenario, result } })
}))
