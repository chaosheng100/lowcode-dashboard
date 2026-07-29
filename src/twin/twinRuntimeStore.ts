import { create } from 'zustand'
import type { AlarmRecord, ControlCommand, TwinPrediction, TwinSourceStatus } from './twinTypes'

// ============================================================
// 孪生运行时 store：每个“孪生视图”拥有独立的运行时会话，互不串数据。
//
// 重要边界：
//  - 场景几何数据（twinScenes）由 useDesignerStore 全局共享 → 实现“模块 ↔ 大屏互通”。
//  - 运行时状态（选中实体 / 预测 / 告警 / 控制 / 数据源 / What-if）按 instanceId 隔离，
//    每个数字孪生组件、模块编辑器都是独立会话，避免多实例之间点击/编辑数据串行。
// 实例包括：大屏中每个 digitalTwin 组件（以 component.id 为键）、数字孪生模块编辑器（固定键 twin-module）。
// ============================================================

export interface EntityLive {
  temperature: number
  health: number
  load: number
  state: string
}

export interface WhatIfResult {
  scenario: Record<string, number>
  result: { predictedOutput: number; energy: number; faultRisk: number; recommendations: string[] }
}

export interface TwinInstanceState {
  /** 当前选中实体（点击实体 / 点击告警时同步，仅作用于本实例） */
  selectedEntityId: string | null
  /** 仿真预测结果（id → TwinPrediction），由本实例的 TwinWidget/TwinPage 持续写入 */
  predictions: Record<string, TwinPrediction>
  /** 告警清单（预测性维护产出），按 ts 倒序 */
  alarms: AlarmRecord[]
  /** 已下发控制指令日志（闭环可追溯） */
  controls: ControlCommand[]
  /** 数据源连接状态（多源接入层上报） */
  sourceStatus: TwinSourceStatus | null
  /** What-if 推演结果（决策沙盘） */
  whatIf: WhatIfResult | null
}

export function emptyTwinInstance(): TwinInstanceState {
  return {
    selectedEntityId: null,
    predictions: {},
    alarms: [],
    controls: [],
    sourceStatus: null,
    whatIf: null
  }
}

/** 渲染期稳定空引用，避免 selector 返回新对象导致无限重渲染 */
export const EMPTY_TWIN_INSTANCE: TwinInstanceState = emptyTwinInstance()

interface TwinRuntimeState {
  instances: Record<string, TwinInstanceState>

  ensureInstance: (id: string) => void
  setSelectedEntity: (instanceId: string, id: string | null) => void
  setPredictions: (instanceId: string, preds: Record<string, TwinPrediction>) => void
  pushAlarm: (instanceId: string, a: AlarmRecord) => void
  clearAlarms: (instanceId: string) => void
  pushControl: (instanceId: string, c: ControlCommand) => void
  setSourceStatus: (instanceId: string, s: TwinSourceStatus | null) => void
  setWhatIf: (instanceId: string, scenario: Record<string, number>, result: WhatIfResult['result']) => void
}

const touch = (
  s: TwinRuntimeState,
  id: string,
  patch: Partial<TwinInstanceState>
): { instances: Record<string, TwinInstanceState> } => ({
  instances: { ...s.instances, [id]: { ...(s.instances[id] ?? emptyTwinInstance()), ...patch } }
})

export const useTwinRuntimeStore = create<TwinRuntimeState>((set, get) => ({
  instances: {},

  ensureInstance: (id) => {
    if (!get().instances[id]) set((s) => ({ instances: { ...s.instances, [id]: emptyTwinInstance() } }))
  },

  setSelectedEntity: (instanceId, id) => set((s) => touch(s, instanceId, { selectedEntityId: id })),

  setPredictions: (instanceId, preds) => set((s) => touch(s, instanceId, { predictions: preds })),

  pushAlarm: (instanceId, a) =>
    set((s) => {
      const inst = s.instances[instanceId] ?? emptyTwinInstance()
      const now = Date.now()
      // 同实体同级别 60s 内去重，避免告警刷屏
      const dup = inst.alarms.find((x) => x.entityId === a.entityId && x.level === a.level && now - x.ts < 60000)
      if (dup) return s
      const next = [a, ...inst.alarms].sort((x, y) => y.ts - x.ts).slice(0, 200)
      return { instances: { ...s.instances, [instanceId]: { ...inst, alarms: next } } }
    }),

  clearAlarms: (instanceId) => set((s) => touch(s, instanceId, { alarms: [] })),

  pushControl: (instanceId, c) =>
    set((s) => {
      const inst = s.instances[instanceId] ?? emptyTwinInstance()
      return { instances: { ...s.instances, [instanceId]: { ...inst, controls: [c, ...inst.controls].slice(0, 100) } } }
    }),

  setSourceStatus: (instanceId, src) => set((s) => touch(s, instanceId, { sourceStatus: src })),

  setWhatIf: (instanceId, scenario, result) => set((s) => touch(s, instanceId, { whatIf: { scenario, result } }))
}))

/** 聚合所有实例的告警（供全局告警清单组件使用），按「实体+级别」去重保留最新 */
export function selectAllAlarms(s: TwinRuntimeState): AlarmRecord[] {
  const map = new Map<string, AlarmRecord>()
  for (const inst of Object.values(s.instances)) {
    for (const a of inst.alarms) {
      const key = `${a.entityId}|${a.level}`
      const prev = map.get(key)
      if (!prev || a.ts > prev.ts) map.set(key, a)
    }
  }
  return [...map.values()].sort((x, y) => y.ts - x.ts)
}

/** 聚合所有实例的预测结果（供全局告警清单组件计算平均健康指数） */
export function selectAllPredictions(s: TwinRuntimeState): Record<string, TwinPrediction> {
  const out: Record<string, TwinPrediction> = {}
  for (const inst of Object.values(s.instances)) Object.assign(out, inst.predictions)
  return out
}
