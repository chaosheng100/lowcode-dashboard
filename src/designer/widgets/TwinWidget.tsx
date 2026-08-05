import { useEffect, useRef, useState } from 'react'
import { Slider, Button, Empty } from 'antd'
import type { WidgetViewProps, Filter } from '../../data/types'
import { createDemoScene } from '../../twin/sceneFactory'
import {
  subscribeTwinLive,
  subscribeTwinSource,
  type TelemetrySample
} from '../../twin/TwinDataBridge'
import { createSource } from '../../twin/sources/TwinSource'
import { useTwinRuntimeStore, EMPTY_TWIN_INSTANCE } from '../../twin/twinRuntimeStore'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import { STATE_COLORS, CONTROL_LABELS, type ControlAction, type TwinScene } from '../../twin/twinTypes'
import { TwinSceneView, type TwinSceneViewController, type TwinEntityLive, type TwinSceneViewOptions } from '../../twin/TwinSceneView'

// ============================================================
// TwinWidget：嵌入数据大屏的「数字孪生组件」
// 复用共享内核 TwinSceneView（与数字孪生模块 TwinPage 同一套渲染/仿真/控制实现），
// 在此之上叠加：HUD 实体列表、大屏联动（filter → 聚焦/高亮）、What-if 决策沙盘、
// 多源适配数据源订阅。运行时会话以 component.id 隔离，场景几何来自全局 twinScenes。
// ============================================================

const CONTROL_ACTIONS: ControlAction[] = ['start', 'stop', 'reset']

export default function TwinWidget({ component, filter, onPick }: WidgetViewProps) {
  const p = component.props
  const sceneId = (p.sceneId as string) || 'main'
  // 运行时状态按组件实例（component.id）隔离，避免同屏多个孪生组件互相串数据；
  // 场景几何数据仍来自全局 twinScenes，因此多组件可共享同一场景、但各自独立遥测/选中/仿真。
  const instanceId = component.id
  const filterField = p.filterField || 'entityId'

  // 优先使用全局孪生场景库中同 sceneId 的场景，实现大屏组件与数字孪生模块数据互通；
  // 取不到时兜底回演示场景，保证永远有可渲染内容。
  const resolveScene = (id: string): TwinScene => {
    const s = useDesignerStore.getState().twinScenes[id]
    return s ?? createDemoScene()
  }
  const sceneRef = useRef<TwinScene>(resolveScene(sceneId))
  const rt = useTwinRuntimeStore((s) => s.instances[instanceId]) ?? EMPTY_TWIN_INSTANCE

  const [live, setLive] = useState<Record<string, TwinEntityLive>>(() => {
    const init: Record<string, TwinEntityLive> = {}
    sceneRef.current.entities.forEach((e) => {
      init[e.id] = {
        temperature: e.metrics?.temperature ?? 0,
        health: e.metrics?.health ?? 0,
        load: e.metrics?.load ?? 0,
        state: e.state
      }
    })
    return init
  })
  // What-if 局部状态（沙盘参数）
  const [scenario, setScenario] = useState<Record<string, number>>({ speed: 80, targetOutput: 100, energyBudget: 100, maintenanceHours: 0 })
  const [whatIf, setWhatIfLocal] = useState<{ predictedOutput: number; energy: number; faultRisk: number; recommendations: string[] } | null>(null)

  // 持有最新回调/配置，避免点击处理器闭包过期
  const cbRef = useRef({ onPick, interactive: p.interactive, filterField })
  cbRef.current = { onPick, interactive: p.interactive, filterField }

  // 遥测累积区（数据源订阅只负责填充，渲染/仿真由 TwinSceneView 统一消费）
  const liveRef = useRef<Record<string, TelemetrySample>>({})
  const viewRef = useRef<TwinSceneViewController | null>(null)

  // 数据源订阅：仅负责把遥测写入 liveRef（实时性由 source 节奏决定，仿真/渲染由内核统一消费）
  useEffect(() => {
    const entities = sceneRef.current.entities
    let stopSim: (() => void) | undefined
    let stopLive: (() => void) | undefined

    if (p.liveSourceId) {
      stopLive = subscribeTwinLive(
        p.liveSourceId,
        entities,
        (id, sample, overrides) => {
          liveRef.current[id] = sample
          const view = viewRef.current
          if (!view) return
          if (overrides?.color) view.setEntityColor(id, overrides.color)
          if (overrides?.state) view.setEntityState(id, overrides.state)
          if (overrides?.animation !== undefined) view.playAnimation(id, overrides.animation)
        },
        p.liveIntervalMs ?? 2000
      )
    } else {
      const sourceKind = (p.sourceKind as 'simulated' | 'industrial' | 'bim' | 'gis') || 'simulated'
      const source = createSource(sourceKind, entities)
      useTwinRuntimeStore.getState().setSourceStatus(instanceId, source.status())
      stopSim = subscribeTwinSource(source, entities, (id, sample) => { liveRef.current[id] = sample }, 1500)
    }

    return () => {
      stopSim?.()
      stopLive?.()
    }
  }, [sceneId, p.liveSourceId, p.liveIntervalMs, p.sourceKind, instanceId])

  // ---- 下行联动：大屏筛选 → 聚焦/高亮孪生体 ----
  useEffect(() => {
    const f = filter as Filter | null | undefined
    if (f && f.field === filterField && f.value) {
      viewRef.current?.focus(f.value, 'warn')
      useTwinRuntimeStore.getState().setSelectedEntity(instanceId, f.value)
    } else {
      viewRef.current?.highlight(null)
    }
  }, [filter, filterField, instanceId])

  // 渲染器点击/选中（HUD 点击同一入口）→ 更新实例选中态 + 大屏联动
  const handleSelect = (id: string | null) => {
    const { onPick, interactive, filterField } = cbRef.current
    useTwinRuntimeStore.getState().setSelectedEntity(instanceId, id)
    if (interactive !== false && onPick && id) onPick({ field: filterField, value: id })
  }

  // ---- What-if 决策沙盘：推演（仿真能力由内核提供） ----
  const runWhatIf = () => {
    const res = viewRef.current?.runWhatIf({
      speed: scenario.speed,
      targetOutput: scenario.targetOutput,
      energyBudget: scenario.energyBudget,
      maintenanceHours: scenario.maintenanceHours
    })
    if (!res) return
    setWhatIfLocal(res)
    useTwinRuntimeStore.getState().setWhatIf(instanceId, scenario, res)
  }

  // ---- 闭环控制：下发指令（控制能力由内核提供） ----
  const dispatchControl = async (action: ControlAction) => {
    const id = rt.selectedEntityId
    const ent = sceneRef.current.entities.find((e) => e.id === id)
    if (!ent) return
    await viewRef.current?.dispatchControl(ent, action)
  }

  const selectedEntity = rt.selectedEntityId ? sceneRef.current?.entities.find((e) => e.id === rt.selectedEntityId) : null
  const pred = rt.selectedEntityId ? rt.predictions[rt.selectedEntityId] : undefined

  const options: TwinSceneViewOptions = {
    lighting: p.lighting === 'night' ? 'night' : 'day',
    fog: !!p.fog,
    autoRotate: !!p.autoRotate,
    showLabels: p.showLabels !== false
  }

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#05080f', overflow: 'hidden' }}>
      <TwinSceneView
        ref={viewRef}
        key={sceneId}
        scene={sceneRef.current}
        instanceId={instanceId}
        options={options}
        getTelemetry={() => liveRef.current}
        simIntervalMs={2000}
        onSelectEntity={handleSelect}
        onTelemetry={setLive}
      />

      {p.showHud !== false && (
        <div style={{ position: 'absolute', top: 6, left: 8, right: 8, pointerEvents: 'none' }}>
          <div style={{ fontSize: 12, color: '#cfd9e6', fontWeight: 600, textShadow: '0 1px 2px #000' }}>
            {p.title || '数字孪生场景'}
            {rt.sourceStatus && (
              <span style={{ marginLeft: 8, fontSize: 10, color: '#7dd3fc', fontWeight: 400 }}>
                · 数据源：{rt.sourceStatus.kind}
              </span>
            )}
          </div>
          <div style={{ marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {sceneRef.current.entities.map((e) => {
              const lv = live[e.id]
              const active = rt.selectedEntityId === e.id
              return (
                <div
                  key={e.id}
                  onClick={() => handleSelect(e.id)}
                  style={{
                    pointerEvents: 'auto',
                    cursor: 'pointer',
                    fontSize: 10,
                    padding: '2px 6px',
                    borderRadius: 6,
                    background: active ? 'rgba(245,158,11,0.22)' : 'rgba(10,14,26,0.6)',
                    border: `1px solid ${active ? '#f59e0b' : 'rgba(255,255,255,0.08)'}`,
                    color: '#cfe3ff'
                  }}
                >
                  <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', marginRight: 4, background: STATE_COLORS[lv?.state ?? e.state] }} />
                  {e.name}
                  {lv ? ` ${Math.round(lv.temperature)}℃/${Math.round(lv.health)}` : ''}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 选中实体：仿真预测 + 闭环控制条 */}
      {p.showControl !== false && selectedEntity && (
        <div style={{ position: 'absolute', left: 8, bottom: 8, right: 8, pointerEvents: 'auto', background: 'rgba(8,13,22,0.82)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 8, padding: '6px 8px', fontSize: 11, color: '#cfe3ff' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
            <span style={{ fontWeight: 600 }}>{selectedEntity.name}</span>
            {pred && (
              <span style={{ color: '#7dd3fc' }}>
                健康指数 {pred.healthIndex}
                {pred.rul != null ? ` · RUL ${pred.rul}h` : ''}
              </span>
            )}
            <span style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              {CONTROL_ACTIONS.map((a) => (
                <Button key={a} size="small" onClick={() => dispatchControl(a)}>
                  {CONTROL_LABELS[a]}
                </Button>
              ))}
            </span>
          </div>
        </div>
      )}

      {/* What-if 决策沙盘 */}
      {p.showSim !== false && (
        <div style={{ position: 'absolute', right: 8, bottom: 8, width: 220, pointerEvents: 'auto', background: 'rgba(8,13,22,0.82)', border: '1px solid rgba(34,211,238,0.25)', borderRadius: 8, padding: '6px 10px', fontSize: 11, color: '#cfe3ff' }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>决策沙盘（What-if）</div>
          {([
            ['speed', '运行速度', 0, 150, '%'],
            ['targetOutput', '目标产能', 0, 200, ''],
            ['energyBudget', '能耗上限', 0, 200, ''],
            ['maintenanceHours', '检修时长', 0, 72, 'h']
          ] as const).map(([key, label, min, max, unit]) => (
            <div key={key} style={{ marginBottom: 2 }}>
              <span style={{ display: 'inline-block', width: 56 }}>{label}</span>
              <Slider
                min={min}
                max={max}
                value={scenario[key]}
                onChange={(v) => setScenario((s) => ({ ...s, [key]: v }))}
                style={{ width: 120, display: 'inline-block', verticalAlign: 'middle' }}
              />
              <span style={{ width: 34, textAlign: 'right', display: 'inline-block' }}>{scenario[key]}{unit}</span>
            </div>
          ))}
          <Button size="small" type="primary" block onClick={runWhatIf} style={{ marginTop: 2 }}>
            推演
          </Button>
          {whatIf && (
            <div style={{ marginTop: 4, color: '#9fb0c3', lineHeight: 1.5 }}>
              产能 {whatIf.predictedOutput} · 能耗 {whatIf.energy} · 故障风险{' '}
              <span style={{ color: whatIf.faultRisk > 60 ? '#ef4444' : '#4ade80' }}>{whatIf.faultRisk}</span>
            </div>
          )}
          {!whatIf && <div style={{ marginTop: 4, color: '#6b7d8f' }}><Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="调参后点推演" /></div>}
        </div>
      )}
    </div>
  )
}
