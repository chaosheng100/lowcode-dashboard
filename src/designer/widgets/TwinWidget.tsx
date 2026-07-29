import { useEffect, useRef, useState } from 'react'
import { Slider, Button, Empty } from 'antd'
import type { WidgetViewProps, Filter } from '../../data/types'
import { TwinRenderer } from '../../twin/TwinRenderer'
import { createDemoScene } from '../../twin/sceneFactory'
import {
  subscribeTwinLive,
  subscribeTwinSource,
  type TelemetrySample
} from '../../twin/TwinDataBridge'
import { createSource } from '../../twin/sources/TwinSource'
import { TwinSim } from '../../twin/TwinSim'
import { TwinControlHub } from '../../twin/control'
import { useTwinRuntimeStore } from '../../twin/twinRuntimeStore'
import { healthToState, STATE_COLORS, CONTROL_LABELS, type TwinEntityState, type ControlAction } from '../../twin/twinTypes'

// ============================================================
// TwinWidget：嵌入数据大屏的「数字孪生组件」（进阶/高级能力落地）
// 在 MVP 双向联动基础上新增：
//  - TwinSim 仿真：实时遥测 → 健康指数/RUL/预测状态 → 预测性维护告警（写运行时 store）
//  - 多源适配：默认 simulated 源，可切换 industrial/bim/gis（经 TwinDataBridge.subscribeTwinSource）
//  - 闭环控制：选中实体后下发 启停/复位 指令（TwinControlHub → 运行时 store 指令日志）
//  - What-if 决策沙盘：调参推演产能/能耗/故障风险，结果驱动大屏动态展示
// ============================================================

interface EntityLive extends TelemetrySample {
  state: TwinEntityState
}

const CONTROL_ACTIONS: ControlAction[] = ['start', 'stop', 'reset']

export default function TwinWidget({ component, filter, onPick }: WidgetViewProps) {
  const mountRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<TwinRenderer | null>(null)
  const sceneRef = useRef(createDemoScene())
  const p = component.props
  const filterField = p.filterField || 'entityId'
  const rt = useTwinRuntimeStore()

  const [live, setLive] = useState<Record<string, EntityLive>>(() => {
    const init: Record<string, EntityLive> = {}
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

  const liveRef = useRef<Record<string, TelemetrySample>>({})
  const simRef = useRef<TwinSim | null>( null)
  const controlRef = useRef(new TwinControlHub())

  // ---- 初始化渲染器（仅一次） ----
  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    const renderer = new TwinRenderer(el, sceneRef.current, {
      lighting: p.lighting === 'night' ? 'night' : 'day',
      fog: !!p.fog,
      autoRotate: !!p.autoRotate
    })
    renderer.setLabelVisible(p.showLabels !== false)
    renderer.setClickHandler((id) => {
      const { onPick, interactive, filterField } = cbRef.current
      useTwinRuntimeStore.getState().setSelectedEntity(id)
      if (interactive !== false && onPick) onPick({ field: filterField, value: id })
    })
    rendererRef.current = renderer
    simRef.current = new TwinSim(sceneRef.current.entities)

    const ro = new ResizeObserver(() => renderer.resize())
    ro.observe(el)
    return () => {
      ro.disconnect()
      renderer.dispose()
      rendererRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ---- 实时遥测：多源适配 or liveClient，并驱动孪生体状态 ----
  useEffect(() => {
    const entities = sceneRef.current.entities
    const apply = (id: string, sample: TelemetrySample) => {
      const state = healthToState(sample.health, sample.temperature)
      rendererRef.current?.setEntityState(id, state)
      setLive((m) => ({ ...m, [id]: { ...sample, state } }))
      liveRef.current[id] = sample
    }

    let stopSim: (() => void) | undefined
    let stopLive: (() => void) | undefined

    if (p.liveSourceId) {
      stopLive = subscribeTwinLive(p.liveSourceId, entities, apply, p.liveIntervalMs ?? 2000)
    } else {
      const sourceKind = (p.sourceKind as 'simulated' | 'industrial' | 'bim' | 'gis') || 'simulated'
      const source = createSource(sourceKind, entities)
      useTwinRuntimeStore.getState().setSourceStatus(source.status())
      stopSim = subscribeTwinSource(source, entities, apply, 1500)
    }

    // ---- 仿真 tick：把实时遥测算出预测 + 预测性维护告警，写入运行时 store ----
    const simTimer = setInterval(() => {
      if (!simRef.current) return
      const res = simRef.current.tick(liveRef.current)
      useTwinRuntimeStore.getState().setPredictions(res.predictions)
      res.alarms.forEach((a) => useTwinRuntimeStore.getState().pushAlarm(a))
    }, 2000)

    return () => {
      stopSim?.()
      stopLive?.()
      clearInterval(simTimer)
    }
  }, [p.liveSourceId, p.liveIntervalMs, p.sourceKind])

  // ---- 属性变更 → 渲染器 ----
  useEffect(() => { rendererRef.current?.setLighting(p.lighting === 'night' ? 'night' : 'day') }, [p.lighting])
  useEffect(() => { rendererRef.current?.setFog(!!p.fog) }, [p.fog])
  useEffect(() => { rendererRef.current?.setAutoRotate(!!p.autoRotate) }, [p.autoRotate])
  useEffect(() => { rendererRef.current?.setLabelVisible(p.showLabels !== false) }, [p.showLabels])

  // ---- 下行联动：大屏筛选 → 聚焦/高亮孪生体 ----
  useEffect(() => {
    const r = rendererRef.current
    if (!r) return
    const f = filter as Filter | null | undefined
    if (f && f.field === filterField && f.value) {
      r.highlightEntity(f.value, 'warn')
      r.focusEntity(f.value)
      useTwinRuntimeStore.getState().setSelectedEntity(f.value)
    } else {
      r.highlightEntity(null)
    }
  }, [filter, filterField])

  const onHudClick = (id: string) => {
    useTwinRuntimeStore.getState().setSelectedEntity(id)
    if (p.interactive !== false && onPick) onPick({ field: filterField, value: id })
  }

  // ---- What-if 决策沙盘：推演 ----
  const runWhatIf = () => {
    if (!simRef.current) return
    const res = simRef.current.runWhatIf({
      speed: scenario.speed,
      targetOutput: scenario.targetOutput,
      energyBudget: scenario.energyBudget,
      maintenanceHours: scenario.maintenanceHours
    })
    setWhatIfLocal(res)
    useTwinRuntimeStore.getState().setWhatIf(scenario, res)
  }

  // ---- 闭环控制：下发指令 ----
  const dispatchControl = async (action: ControlAction) => {
    const id = rt.selectedEntityId
    const ent = sceneRef.current.entities.find((e) => e.id === id)
    if (!ent) return
    await controlRef.current.dispatch(ent, action)
  }

  const selectedEntity = rt.selectedEntityId ? sceneRef.current.entities.find((e) => e.id === rt.selectedEntityId) : null
  const pred = rt.selectedEntityId ? rt.predictions[rt.selectedEntityId] : undefined

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#05080f', overflow: 'hidden' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100%' }} />

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
                  onClick={() => onHudClick(e.id)}
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
