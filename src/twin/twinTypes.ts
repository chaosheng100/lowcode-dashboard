// ============================================================
// 数字孪生 核心类型 —— 模型层（TwinEngine 数据契约）
// 这些类型被 TwinRenderer（渲染）、TwinDataBridge（数据）、TwinWidget（组件）共用，
// 与现有 WidgetProps / ComponentInstance 解耦，便于后续孪生场景独立于大屏演进。
// ============================================================

/** 几何类型（基元几何体，复用现有 91 预置模型库的几何抽象） */
export type GeoType = 'box' | 'cylinder' | 'sphere' | 'cone' | 'torus' | 'plane'

/** 孪生体运行状态（状态机） */
export type TwinEntityState = 'normal' | 'running' | 'idle' | 'fault' | 'offline'

/** 高亮等级（联动中枢驱动渲染） */
export type HighlightLevel = 'select' | 'warn'

/** 实体实时指标（由 TwinDataBridge 写入） */
export interface TwinEntityMetrics {
  /** 温度 ℃ */
  temperature?: number
  /** 健康度 0~100 */
  health?: number
  /** 负载 % */
  load?: number
  [k: string]: number | undefined
}

/** 材质覆盖参数（图层/材质面板写入，渲染器按实体应用） */
export interface TwinEntityMaterial {
  metalness?: number
  roughness?: number
  opacity?: number
  emissive?: string
  emissiveIntensity?: number
}

/** 单个孪生实体 */
export interface TwinEntity {
  id: string
  name: string
  geoType: GeoType
  color: string
  /** 外部模型资源地址；有值时优先加载 GLTF/GLB，否则渲染内置几何体 */
  assetUrl?: string
  /** 来源模型库 id（上传模型用） */
  modelId?: string
  x: number
  y: number
  z: number
  rotationY?: number
  scale?: number
  state: TwinEntityState
  metrics?: TwinEntityMetrics
  /** 绑定实时源：孪生指标字段 → 源字段（进阶接入预留） */
  bindings?: { liveSourceId?: string; fields?: Record<string, string> }
  /** 图层树：是否可见 */
  visible?: boolean
  /** 图层树：是否锁定（锁定后不可选中/拖拽） */
  locked?: boolean
  /** 材质覆盖（金属度/粗糙度/透明度/自发光） */
  material?: TwinEntityMaterial
}

/** 孪生场景（一组实体 + 环境配置） */
export interface TwinScene {
  id: string
  name: string
  entities: TwinEntity[]
  env: { lighting: 'day' | 'night'; fog: boolean }
  camera?: { x: number; y: number; z: number }
  /** 测量标注（两点地面距离） */
  annotations?: TwinAnnotation[]
}

export interface TwinAnnotation {
  id: string
  name: string
  start: { x: number; z: number }
  end: { x: number; z: number }
  color?: string
}

/** 状态 → 显示颜色 */
export const STATE_COLORS: Record<TwinEntityState, string> = {
  normal: '#4f8cff',
  running: '#22d3ee',
  idle: '#64748b',
  fault: '#ef4444',
  offline: '#475569'
}

/** 根据健康度 + 温度推导出状态（阈值规则，MVP 用确定性规则，进阶可接 ML） */
export function healthToState(health: number, temperature: number): TwinEntityState {
  if (health < 45 || temperature > 82) return 'fault'
  if (health < 70 || temperature > 66) return 'idle'
  return 'running'
}

// ============================================================
// 仿真 / 告警 / 控制 / 多源接入 类型（进阶 + 高级能力数据契约）
// ============================================================

/** 实时遥测采样（实体指标快照）。收敛到类型层，供数据桥 / 多源适配器 / 仿真共用 */
export interface TelemetrySample {
  temperature: number
  health: number
  load: number
}

/** 告警级别 */
export type AlarmLevel = 'info' | 'warning' | 'critical'

/** 单条告警记录（由 TwinSim 预测性维护产出，进入运行时 store 供告警清单组件消费） */
export interface AlarmRecord {
  id: string
  entityId: string
  entityName: string
  level: AlarmLevel
  message: string
  ts: number
  /** 触发指标快照，便于详情展示 */
  metric?: { temperature: number; health: number; load: number }
}

/** 孪生仿真预测结果（RUL / 健康度指数 / 预测状态） */
export interface TwinPrediction {
  entityId: string
  /** 综合健康指数 0~100（融合温度/负载/健康度） */
  healthIndex: number
  /** 剩余使用寿命（小时），未计算则为 undefined */
  rul?: number
  /** 当前派生状态 */
  state: TwinEntityState
  /** 预测未来状态（what-if 或趋势推演） */
  predictedState?: TwinEntityState
  /** 置信度 0~1 */
  confidence: number
  /** 预测时域（小时） */
  horizonH?: number
}

/** 闭环控制动作 */
export type ControlAction =
  | 'start'
  | 'stop'
  | 'reset'
  | 'setTarget'
  | 'openValve'
  | 'closeValve'
  | 'setSpeed'
  | 'acknowledge'

/** 已下发的控制指令（进入运行时 store 指令日志，形成闭环可追溯） */
export interface ControlCommand {
  id: string
  entityId: string
  entityName: string
  action: ControlAction
  params?: Record<string, number | string>
  ts: number
  status: 'sent' | 'ok' | 'failed'
  result?: string
}

/** 数据源连接状态（多源接入层上报） */
export interface TwinSourceStatus {
  kind: string
  connected: boolean
  lastTs?: number
  message?: string
}

/** What-if 决策沙盘输入参数 */
export interface WhatIfScenario {
  /** 目标产能（归一化 0~200） */
  targetOutput?: number
  /** 能耗上限（归一化 0~200） */
  energyBudget?: number
  /** 计划检修时长（小时） */
  maintenanceHours?: number
  /** 运行速度（%） */
  speed?: number
}

/** What-if 推演输出（驱动大屏 KPI 动态重算） */
export interface WhatIfResult {
  predictedOutput: number
  energy: number
  faultRisk: number
  recommendations: string[]
}

/** 综合健康指数：融合健康度/温度/负载，越接近 100 越健康 */
export function healthIndex(health: number, temperature: number, load: number): number {
  const tempPenalty = temperature > 66 ? (temperature - 66) * 1.6 : 0
  const loadPenalty = load > 85 ? (load - 85) * 0.8 : 0
  return Math.max(0, Math.min(100, health - tempPenalty - loadPenalty))
}

/** 告警级别 → 展示色 */
export const ALARM_COLORS: Record<AlarmLevel, string> = {
  info: '#4f8cff',
  warning: '#f59e0b',
  critical: '#ef4444'
}

/** 控制动作 → 中文标签 */
export const CONTROL_LABELS: Record<ControlAction, string> = {
  start: '启动',
  stop: '停机',
  reset: '复位',
  setTarget: '设定目标',
  openValve: '开阀',
  closeValve: '关阀',
  setSpeed: '设定转速',
  acknowledge: '确认告警'
}
