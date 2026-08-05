import { type CSSProperties, forwardRef, useImperativeHandle, useEffect, useRef } from 'react'
import { TwinRenderer } from './TwinRenderer'
import { TwinSim } from './TwinSim'
import { TwinControlHub } from './control'
import { useTwinRuntimeStore } from './twinRuntimeStore'
import {
  healthToState,
  type ControlAction,
  type HighlightLevel,
  type TelemetrySample,
  type TwinAnnotation,
  type TwinEntity,
  type TwinEntityMaterial,
  type TwinEntityState,
  type TwinScene,
  type WhatIfResult,
  type WhatIfScenario
} from './twinTypes'

// ============================================================
// TwinSceneView：数字孪生 3D 场景的「共享视口内核」（组件级复用基础）
// 同时被 大屏组件 TwinWidget 与 模块编辑器 TwinPage 使用，消除两处重复的
// 渲染器生命周期 / 仿真 tick / 控制 hub / 运行时会话 样板代码。
//
// 职责边界：
//  - 负责：渲染器初始化与销毁、自适应（ResizeObserver）、ensureInstance 运行时会话、
//          仿真 tick（消费遥测 → 应用实体状态 + 预测/告警写运行时 store）、选中回调、
//          实体增删改/拾取/聚焦/控制/what-if 的 imperative 接口。
//  - 不负责：遥测「来源」（由 getTelemetry 注入，Widget 走数据源订阅、Page 走随机游走）、
//            HUD/联动/沙盘/模型库/属性面板/关键帧时间轴（各组件在外部叠加）。
// ============================================================

/** HUD/联动用的单实体实时视图（遥测 + 派生状态） */
export interface TwinEntityLive extends TelemetrySample {
  state: TwinEntityState
}

export interface TwinSceneViewOptions {
  lighting?: 'day' | 'night'
  fog?: boolean
  autoRotate?: boolean
  showLabels?: boolean
}

/** TwinSceneView 暴露给父组件的命令式接口（供编辑/联动/控制操作） */
export interface TwinSceneViewController {
  /** 聚焦并高亮实体（联动中枢调用）。level=warn 用橙色边框，默认 select 用绿色 */
  focus: (id: string | null, level?: HighlightLevel) => void
  /** 仅高亮边框，不移动相机 */
  highlight: (id: string | null, level?: HighlightLevel) => void
  addEntity: (e: TwinEntity) => void
  removeEntity: (id: string) => void
  addAnnotation: (a: TwinAnnotation) => void
  removeAnnotation: (id: string) => void
  setAnnotations: (list: TwinAnnotation[]) => void
  updateEntityTransform: (id: string, t: { x?: number; y?: number; z?: number; rotationY?: number; scale?: number }) => void
  setEntityColor: (id: string, color: string) => void
  setEntityVisible: (id: string, visible: boolean) => void
  setEntityMaterial: (id: string, patch: TwinEntityMaterial) => void
  getAnimationClips: (id: string) => string[]
  playAnimation: (id: string, clipName: string | null) => void
  getEntityTransform: (id: string) => { x: number; y: number; z: number; rotationY: number } | null
  /** 屏幕坐标拾取实体 */
  pickEntityAt: (clientX: number, clientY: number) => string | null
  /** 屏幕坐标投射到地面 */
  groundPointAt: (clientX: number, clientY: number) => { x: number; z: number } | null
  setControlsEnabled: (b: boolean) => void
  getCanvas: () => HTMLCanvasElement | null
  /** 闭环控制：下发指令（写入对应实例的运行时会话） */
  dispatchControl: (entity: TwinEntity, action: ControlAction) => Promise<void>
  /** What-if 决策沙盘推演 */
  runWhatIf: (scenario: WhatIfScenario) => WhatIfResult
}

export interface TwinSceneViewProps {
  /** 初始场景（实体 + 环境）。切换场景请通过给本组件加 key 触发整体重建 */
  scene: TwinScene
  /** 运行时隔离实例键（大屏组件用 component.id，模块编辑器用固定键如 twin-module） */
  instanceId: string
  options?: TwinSceneViewOptions
  /** 遥测来源：返回各实体最新采样，由本组件统一消费并写运行时 store */
  getTelemetry: () => Record<string, TelemetrySample>
  /** 仿真 tick 间隔（ms），默认 2000 */
  simIntervalMs?: number
  /** 渲染器点击实体时回调（外部决定选中 / 联动 / 拖拽） */
  onSelectEntity?: (id: string | null) => void
  /** 每次仿真消费遥测后回调，供外部 HUD 展示 */
  onTelemetry?: (live: Record<string, TwinEntityLive>) => void
  className?: string
  style?: CSSProperties
}

export const TwinSceneView = forwardRef<TwinSceneViewController, TwinSceneViewProps>(function TwinSceneView(
  props,
  ref
) {
  const { scene, instanceId, options, getTelemetry, simIntervalMs = 2000, onSelectEntity, onTelemetry, className, style } = props

  const mountRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<TwinRenderer | null>(null)
  const simRef = useRef<TwinSim | null>(null)
  const controlHubRef = useRef<TwinControlHub | null>(null)

  // 最新回调/配置引用，避免 effect 闭包过期
  const telemetryCbRef = useRef(getTelemetry)
  telemetryCbRef.current = getTelemetry
  const onSelectCbRef = useRef(onSelectEntity)
  onSelectCbRef.current = onSelectEntity
  const onTelemetryCbRef = useRef(onTelemetry)
  onTelemetryCbRef.current = onTelemetry

  const lighting = options?.lighting
  const fog = options?.fog
  const autoRotate = options?.autoRotate
  const showLabels = options?.showLabels

  // ---- 初始化渲染器（仅一次；切换场景请用 key 重建） ----
  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    const renderer = new TwinRenderer(el, scene, {
      lighting: lighting === 'night' ? 'night' : 'day',
      fog: !!fog,
      autoRotate: !!autoRotate
    })
    renderer.setLabelVisible(showLabels !== false)
    renderer.setClickHandler((id) => onSelectCbRef.current?.(id))
    renderer.setAnnotations(scene.annotations ?? [])
    rendererRef.current = renderer
    simRef.current = new TwinSim(scene.entities)
    controlHubRef.current = new TwinControlHub(instanceId)
    // 确保本实例独立的运行时会话存在（选中/遥测/仿真/告警互不串）
    useTwinRuntimeStore.getState().ensureInstance(instanceId)

    const ro = new ResizeObserver(() => renderer.resize())
    ro.observe(el)

    return () => {
      ro.disconnect()
      renderer.dispose()
      rendererRef.current = null
      simRef.current = null
      controlHubRef.current = null
    }
    // scene/options 仅在挂载时读取；切换场景由外部 key 重建，这里不重读
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [instanceId])

  // ---- 环境变更 → 渲染器 ----
  useEffect(() => { rendererRef.current?.setLighting(lighting === 'night' ? 'night' : 'day') }, [lighting])
  useEffect(() => { rendererRef.current?.setFog(!!fog) }, [fog])
  useEffect(() => { rendererRef.current?.setAutoRotate(!!autoRotate) }, [autoRotate])
  useEffect(() => { rendererRef.current?.setLabelVisible(showLabels !== false) }, [showLabels])

  // ---- 仿真 tick：消费遥测 → 应用实体状态 + 预测/告警写运行时 store ----
  useEffect(() => {
    const timer = setInterval(() => {
      const live = telemetryCbRef.current()
      const r = rendererRef.current
      if (r) {
        for (const [id, s] of Object.entries(live)) {
          r.setEntityState(id, healthToState(s.health, s.temperature))
        }
      }
      const sim = simRef.current
      if (!sim) return
      const res = sim.tick(live)
      useTwinRuntimeStore.getState().setPredictions(instanceId, res.predictions)
      res.alarms.forEach((a) => useTwinRuntimeStore.getState().pushAlarm(instanceId, a))
      // 反馈给外部 HUD（派生 state）
      const out: Record<string, TwinEntityLive> = {}
      for (const [id, s] of Object.entries(live)) {
        out[id] = { temperature: s.temperature, health: s.health, load: s.load, state: healthToState(s.health, s.temperature) }
      }
      onTelemetryCbRef.current?.(out)
    }, simIntervalMs)
    return () => clearInterval(timer)
  }, [instanceId, simIntervalMs])

  // ---- 命令式接口（供父组件拖拽/联动/控制/what-if） ----
  useImperativeHandle(ref, () => ({
    focus: (id, level = 'select') => {
      const r = rendererRef.current
      if (!r) return
      r.highlightEntity(id, level)
      r.focusEntity(id)
    },
    highlight: (id, level = 'select') => rendererRef.current?.highlightEntity(id, level),
    addEntity: (e) => {
      rendererRef.current?.addEntity(e)
      const r = rendererRef.current
      if (r && simRef.current) simRef.current.setEntities(r.getEntities())
    },
    removeEntity: (id) => {
      rendererRef.current?.removeEntity(id)
      const r = rendererRef.current
      if (r && simRef.current) simRef.current.setEntities(r.getEntities())
    },
    addAnnotation: (a) => rendererRef.current?.addAnnotation(a),
    removeAnnotation: (id) => rendererRef.current?.removeAnnotation(id),
    setAnnotations: (list) => rendererRef.current?.setAnnotations(list),
    updateEntityTransform: (id, t) => rendererRef.current?.updateEntityTransform(id, t),
    setEntityColor: (id, color) => rendererRef.current?.setEntityColor(id, color),
    setEntityVisible: (id, visible) => rendererRef.current?.setEntityVisible(id, visible),
    setEntityMaterial: (id, patch) => rendererRef.current?.setEntityMaterial(id, patch),
    getAnimationClips: (id) => rendererRef.current?.getAnimationClips(id) ?? [],
    playAnimation: (id, clipName) => rendererRef.current?.playAnimation(id, clipName),
    getEntityTransform: (id) => rendererRef.current?.getEntityTransform(id) ?? null,
    pickEntityAt: (x, y) => rendererRef.current?.pickEntityAt(x, y) ?? null,
    groundPointAt: (x, y) => rendererRef.current?.groundPointAt(x, y) ?? null,
    setControlsEnabled: (b) => rendererRef.current?.setControlsEnabled(b),
    getCanvas: () => rendererRef.current?.getCanvas() ?? null,
    dispatchControl: async (entity, action) => {
      await controlHubRef.current?.dispatch(entity, action)
    },
    runWhatIf: (scenario) =>
      simRef.current?.runWhatIf(scenario) ?? { predictedOutput: 0, energy: 0, faultRisk: 0, recommendations: [] }
  }), [instanceId])

  return <div ref={mountRef} className={className} style={{ width: '100%', height: '100%', ...style }} />
})
