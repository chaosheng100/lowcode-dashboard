import { useEffect, useRef, useState, useCallback } from 'react'
import { Button, ColorPicker, InputNumber } from 'antd'
import { useApi } from './useApi'
import { api } from '../mock'
import { Input, Tag } from './common'
import { TwinRenderer } from '../twin/TwinRenderer'
import { TwinSim } from '../twin/TwinSim'
import { TwinControlHub } from '../twin/control'
import { useTwinRuntimeStore } from '../twin/twinRuntimeStore'
import { useDesignerStore } from '../data/store/useDesignerStore'
import {
  healthToState,
  CONTROL_LABELS,
  type ControlAction,
  type GeoType,
  type TelemetrySample,
  type TwinEntity,
  type TwinScene
} from '../twin/twinTypes'

// ============================================================
// 数字孪生 3D 编辑器（复用 TwinRenderer 内核，不再维护独立 Three.js 场景）
// 功能：拖拽式场景搭建、模型选中/拖拽/旋转/缩放、关键帧轨迹、日照/夜景/雾效；
//       + 仿真面板（TwinSim 健康指数/RUL）、控制面板（TwinControlHub 闭环下发）、
//       + 告警面板（运行时 store 预测性维护告警）、实体数据绑定（liveSourceId）。
// 编辑与展示共用同一内核（TwinRenderer），实现“一次建模、到处渲染”。
// ============================================================

type Keyframe = { time: number; x: number; z: number; rotationY: number }

const PRESETS: { geoType: GeoType; name: string; color: string }[] = [
  { geoType: 'box', name: '建筑A', color: '#4f8cff' },
  { geoType: 'box', name: '建筑B', color: '#22d3ee' },
  { geoType: 'cylinder', name: '储罐', color: '#a855f7' },
  { geoType: 'sphere', name: '球形罐', color: '#4ade80' },
  { geoType: 'cone', name: '塔楼', color: '#f59e0b' },
  { geoType: 'torus', name: '环形设施', color: '#ec4899' },
  { geoType: 'box', name: '厂房', color: '#64748b' },
  { geoType: 'cylinder', name: '烟囱', color: '#ef4444' },
  { geoType: 'plane', name: '平台', color: '#3b82f6' }
]

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

let idCounter = 0
const nextId = () => `obj_${Date.now()}_${idCounter++}`

function makeEntity(preset: (typeof PRESETS)[number], x: number, z: number): TwinEntity {
  return {
    id: nextId(),
    name: preset.name,
    geoType: preset.geoType,
    color: preset.color,
    x,
    y: preset.geoType === 'plane' ? 0.05 : 0.6,
    z,
    rotationY: 0,
    scale: 1,
    state: 'normal',
    metrics: { temperature: 40, health: 80, load: 40 }
  }
}

interface TwinPageProps {
  scene?: TwinScene
  readOnly?: boolean
  onSave?: (patch: Partial<TwinScene>) => void
}

export default function TwinPage(_props: TwinPageProps = {}) {
  const { data: models } = useApi(() => api.listTwinModels({ pageSize: 30 }), [])
  const rt = useTwinRuntimeStore()

  const mountRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<TwinRenderer | null>(null)
  const simRef = useRef<TwinSim | null>(null)
  const controlRef = useRef(new TwinControlHub())

  // 初始场景：从全局孪生场景库读取（模块与大屏共享同一份，实现互通 + 持久化）
  const activeSceneId = useDesignerStore.getState().activeTwinSceneId || 'main'
  const storeScene = useDesignerStore.getState().twinScenes[activeSceneId]
  const initialEntities = (storeScene?.entities?.length ? storeScene.entities : buildDefaultEntities())
  const entitiesRef = useRef<TwinEntity[]>(initialEntities)
  const [entities, setEntities] = useState<TwinEntity[]>(initialEntities)

  const [lighting, setLighting] = useState<'day' | 'night'>(storeScene?.env?.lighting ?? 'day')
  const [fog, setFog] = useState<boolean>(storeScene?.env?.fog ?? false)
  const [activePreset, setActivePreset] = useState(0)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [keyframes, setKeyframes] = useState<Record<string, Keyframe[]>>({})
  const keyframesRef = useRef(keyframes)

  const [duration, setDuration] = useState(10)
  const [currentTime, setCurrentTime] = useState(0)
  const playingRef = useRef(false)
  const currentTimeRef = useRef(0)
  const lastRef = useRef(performance.now())
  const [playing, setPlaying] = useState(false)

  const liveRef = useRef<Record<string, TelemetrySample>>({})
  const draggingRef = useRef<string | null>(null)

  const syncRefs = useCallback(() => {
    entitiesRef.current = entities
    keyframesRef.current = keyframes
  }, [entities, keyframes])

  const sceneOf = useCallback(
    (ents: TwinEntity[]): TwinScene => ({ id: 'editor', name: '编辑场景', entities: ents, env: { lighting, fog } }),
    [lighting, fog]
  )

  // ---- 初始化渲染器（复用内核，仅一次） ----
  useEffect(() => {
    const el = mountRef.current
    if (!el) return
    const renderer = new TwinRenderer(el, sceneOf(entitiesRef.current), { lighting, fog })
    renderer.setClickHandler((id) => setSelectedId(id))
    rendererRef.current = renderer
    simRef.current = new TwinSim(entitiesRef.current)

    const canvas = renderer.getCanvas()
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return
      const id = renderer.pickEntityAt(ev.clientX, ev.clientY)
      if (id) {
        draggingRef.current = id
        renderer.setControlsEnabled(false)
        setSelectedId(id)
      }
    }
    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return
      const gp = renderer.groundPointAt(ev.clientX, ev.clientY)
      if (gp) renderer.updateEntityTransform(draggingRef.current, { x: gp.x, z: gp.z })
    }
    const onUp = () => {
      if (!draggingRef.current) return
      const id = draggingRef.current
      draggingRef.current = null
      renderer.setControlsEnabled(true)
      const t = renderer.getEntityTransform(id)
      if (t) setEntities((prev) => prev.map((e) => (e.id === id ? { ...e, x: t.x, y: t.y, z: t.z } : e)))
    }
    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)

    // 仿真 tick：遥测随机游走 → 状态/告警/预测写入运行时 store
    const simTimer = setInterval(() => {
      if (!simRef.current) return
      const live: Record<string, TelemetrySample> = {}
      entitiesRef.current.forEach((e) => {
        const prev = liveRef.current[e.id] ?? { temperature: e.metrics?.temperature ?? 40, health: e.metrics?.health ?? 80, load: e.metrics?.load ?? 40 }
        const s: TelemetrySample = {
          temperature: clamp(prev.temperature + (Math.random() - 0.5) * 9, 20, 95),
          health: clamp(prev.health + (Math.random() - 0.5) * 7, 5, 100),
          load: clamp(prev.load + (Math.random() - 0.5) * 16, 0, 100)
        }
        liveRef.current[e.id] = s
        live[e.id] = s
        renderer.setEntityState(e.id, healthToState(s.health, s.temperature))
      })
      const res = simRef.current.tick(live)
      useTwinRuntimeStore.getState().setPredictions(res.predictions)
      res.alarms.forEach((a) => useTwinRuntimeStore.getState().pushAlarm(a))
    }, 2500)

    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      clearInterval(simTimer)
      renderer.dispose()
      rendererRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // 同步 refs
  useEffect(() => { syncRefs() }, [syncRefs])

  // 编辑结果写回全局孪生场景库：使大屏数字孪生组件同步同一份场景，且切换路由不丢失
  useEffect(() => {
    const id = useDesignerStore.getState().activeTwinSceneId || 'main'
    useDesignerStore.getState().updateTwinSceneEntities(id, entities, { lighting, fog })
  }, [entities, lighting, fog])

  // 退出编辑页时清理编辑期产生的仿真告警，避免残留到告警清单组件
  useEffect(() => () => { useTwinRuntimeStore.getState().clearAlarms() }, [])

  // 环境变更 → 渲染器
  useEffect(() => { rendererRef.current?.setLighting(lighting) }, [lighting])
  useEffect(() => { rendererRef.current?.setFog(fog) }, [fog])

  // ---- 关键帧播放（独立 rAF，驱动渲染器实体变换） ----
  useEffect(() => {
    let raf = 0
    const loop = () => {
      raf = requestAnimationFrame(loop)
      if (!playingRef.current) return
      const now = performance.now()
      const dt = (now - lastRef.current) / 1000
      lastRef.current = now
      let t = currentTimeRef.current + dt
      if (t >= duration) t = 0
      currentTimeRef.current = t
      setCurrentTime(t)
      for (const e of entitiesRef.current) {
        const kfs = keyframesRef.current[e.id]
        if (!kfs || kfs.length === 0) continue
        const sorted = [...kfs].sort((a, b) => a.time - b.time)
        let pose: { x: number; z: number; rotationY: number }
        if (t <= sorted[0].time) pose = { x: sorted[0].x, z: sorted[0].z, rotationY: sorted[0].rotationY }
        else if (t >= sorted[sorted.length - 1].time) {
          const lastK = sorted[sorted.length - 1]
          pose = { x: lastK.x, z: lastK.z, rotationY: lastK.rotationY }
        } else {
          let pose2 = { x: sorted[0].x, z: sorted[0].z, rotationY: sorted[0].rotationY }
          for (let i = 0; i < sorted.length - 1; i++) {
            if (t >= sorted[i].time && t <= sorted[i + 1].time) {
              const span = sorted[i + 1].time - sorted[i].time || 1
              const a = (t - sorted[i].time) / span
              pose2 = {
                x: sorted[i].x + (sorted[i + 1].x - sorted[i].x) * a,
                z: sorted[i].z + (sorted[i + 1].z - sorted[i].z) * a,
                rotationY: sorted[i].rotationY + (sorted[i + 1].rotationY - sorted[i].rotationY) * a
              }
              break
            }
          }
          pose = pose2
        }
        rendererRef.current?.updateEntityTransform(e.id, pose)
      }
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [duration])

  // ---- 操作 ----
  const handleDrop = useCallback((ev: React.DragEvent) => {
    ev.preventDefault()
    const idx = parseInt(ev.dataTransfer.getData('text/plain'), 10)
    if (isNaN(idx) || idx < 0 || idx >= PRESETS.length) return
    const preset = PRESETS[idx]
    const renderer = rendererRef.current
    if (!renderer) return
    const gp = renderer.groundPointAt(ev.clientX, ev.clientY)
    const ent = makeEntity(preset, gp?.x ?? 0, gp?.z ?? 0)
    renderer.addEntity(ent)
    setEntities((prev) => [...prev, ent])
  }, [])

  const deleteSelected = () => {
    if (!selectedId) return
    rendererRef.current?.removeEntity(selectedId)
    setEntities((prev) => prev.filter((o) => o.id !== selectedId))
    setKeyframes((prev) => {
      const n = { ...prev }
      delete n[selectedId]
      return n
    })
    setSelectedId(null)
  }

  const updateSelected = (patch: Partial<TwinEntity>) => {
    if (!selectedId) return
    setEntities((prev) => prev.map((o) => (o.id === selectedId ? { ...o, ...patch } : o)))
    const r = rendererRef.current
    if (!r) return
    if (patch.color) r.setEntityColor(selectedId, patch.color)
    if (patch.x !== undefined || patch.z !== undefined || patch.rotationY !== undefined || patch.scale !== undefined) {
      const t = r.getEntityTransform(selectedId)
      if (t) r.updateEntityTransform(selectedId, { x: patch.x ?? t.x, y: t.y, z: patch.z ?? t.z, rotationY: patch.rotationY ?? t.rotationY, scale: patch.scale })
    }
  }

  const recordKeyframe = () => {
    if (!selectedId) return
    const t = rendererRef.current?.getEntityTransform(selectedId)
    if (!t) return
    const kf: Keyframe = { time: parseFloat(currentTime.toFixed(2)), x: t.x, z: t.z, rotationY: t.rotationY }
    setKeyframes((prev) => {
      const list = prev[selectedId] || []
      const filtered = list.filter((k) => Math.abs(k.time - kf.time) > 0.05)
      return { ...prev, [selectedId]: [...filtered, kf].sort((a, b) => a.time - b.time) }
    })
  }

  const deleteKeyframe = (objId: string, time: number) => {
    setKeyframes((prev) => ({ ...prev, [objId]: (prev[objId] || []).filter((k) => Math.abs(k.time - time) > 0.05) }))
  }

  const play = () => {
    if (playing) { setPlaying(false); playingRef.current = false; return }
    setCurrentTime(0); currentTimeRef.current = 0; lastRef.current = performance.now()
    setPlaying(true); playingRef.current = true
  }
  const stop = () => { setPlaying(false); playingRef.current = false; setCurrentTime(0); currentTimeRef.current = 0 }
  const scrub = (t: number) => { setCurrentTime(t); currentTimeRef.current = t }

  const dispatchControl = async (action: ControlAction) => {
    const ent = entities.find((e) => e.id === selectedId)
    if (!ent) return
    await controlRef.current.dispatch(ent, action)
  }

  const selected = entities.find((o) => o.id === selectedId)
  const totalKeyframes = Object.values(keyframes).reduce((s, k) => s + k.length, 0)
  const pred = selectedId ? rt.predictions[selectedId] : undefined
  const entityAlarms = rt.alarms.filter((a) => a.entityId === selectedId)

  const TL_WIDTH = 760
  const TL_HEIGHT = 140
  const RULER_H = 22
  const ROW_H = 22
  const objectsWithKfs = entities.filter((o) => (keyframes[o.id]?.length ?? 0) > 0)
  const tlRows = Math.max(objectsWithKfs.length, 1)
  const tlContentH = RULER_H + tlRows * ROW_H + 4

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">数字孪生 3D 编辑器</h2>
          <p className="fp-sub">
            拖拽搭建 · 关键帧轨迹 · 日照/夜景/雾效 · {entities.length} 个场景对象 · {totalKeyframes} 个关键帧 · 仿真/控制/告警已接入
          </p>
        </div>
        <span className="fp-count">预置模型 91 种</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 260px', gap: 12 }}>
        {/* 左：模型库 */}
        <div>
          <div className="muted2" style={{ marginBottom: 8 }}>模型库（拖拽到画布放置）</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 360, overflow: 'auto' }}>
            {PRESETS.map((p, i) => (
              <div
                draggable
                key={i}
                className={'card' + (activePreset === i ? ' sel' : '')}
                style={{ padding: 8, textAlign: 'center', cursor: 'grab', borderColor: activePreset === i ? 'var(--accent)' : undefined }}
                onDragStart={(ev) => { ev.dataTransfer.setData('text/plain', String(i)); ev.dataTransfer.effectAllowed = 'copy' }}
                onClick={() => setActivePreset(i)}
              >
                <div style={{ width: 32, height: 32, margin: '0 auto 4px', background: p.color, borderRadius: p.geoType === 'sphere' ? '50%' : 6, opacity: 0.8 }} />
                <div style={{ fontSize: 11, color: '#cfd9e6' }}>{p.name}</div>
              </div>
            ))}
          </div>
          {(models?.list ?? []).length > 0 && (
            <div style={{ marginTop: 10 }}>
              <div className="muted2" style={{ marginBottom: 6 }}>在线模型库（共 91 种）</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 120, overflow: 'auto' }}>
                {(models?.list ?? []).slice(0, 12).map((m) => (
                  <div key={m.id} className="card" style={{ padding: 4, textAlign: 'center' }}>
                    <img src={m.thumbnail} alt={m.name} width={36} height={36} style={{ borderRadius: 4 }} />
                    <div className="muted2" style={{ fontSize: 10 }}>{m.name}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* 中：3D 视口 */}
        <div>
          <div className="flex" style={{ marginBottom: 8 }}>
            <Button size="small" type={lighting === 'day' ? 'primary' : 'default'} onClick={() => setLighting('day')}>☀ 日照</Button>
            <Button size="small" type={lighting === 'night' ? 'primary' : 'default'} onClick={() => setLighting('night')}>🌙 夜景</Button>
            <Button size="small" type={fog ? 'primary' : 'default'} onClick={() => setFog((v) => !v)}>🌫 雾效 {fog ? '开' : '关'}</Button>
            <span className="muted2" style={{ marginLeft: 'auto', lineHeight: '30px' }}>
              左键：放置/选中/拖拽 · 右键：旋转视角 · 滚轮：缩放
            </span>
          </div>
          <div
            ref={mountRef}
            style={{ width: '100%', height: 420, background: '#05080f', borderRadius: 10, border: '1px solid #1a2433', overflow: 'hidden' }}
            onDragOver={(ev) => ev.preventDefault()}
            onDrop={handleDrop}
          />
          {entities.length === 0 && (
            <div className="muted2" style={{ textAlign: 'center', marginTop: 8 }}>从模型库拖拽模型到 3D 视口放置</div>
          )}
        </div>

        {/* 右：属性 / 仿真 / 控制 / 告警 */}
        <div>
          {selected ? (
            <div className="sec">
              <div className="sec-head">
                <span className="sec-title">选中对象</span>
                <Button size="small" danger onClick={deleteSelected}>删除</Button>
              </div>
              <div className="sec-body">
                <div className="field">
                  <span className="field-label" style={{ width: 70 }}>名称</span>
                  <Input value={selected.name} onChange={(e) => updateSelected({ name: e.target.value })} />
                </div>
                <div className="field">
                  <span className="field-label" style={{ width: 70 }}>颜色</span>
                  <ColorPicker value={selected.color} onChange={(c) => updateSelected({ color: c.toHexString() })} />
                </div>
                <div className="field">
                  <span className="field-label" style={{ width: 70 }}>旋转°</span>
                  <InputNumber style={{ width: '100%' }} value={Math.round((selected.rotationY ?? 0) * 180 / Math.PI)}
                    onChange={(v) => updateSelected({ rotationY: (v ?? 0) * Math.PI / 180 })} />
                </div>
                <div className="field">
                  <span className="field-label" style={{ width: 70 }}>缩放</span>
                  <InputNumber style={{ width: '100%' }} step={0.1} value={selected.scale ?? 1}
                    onChange={(v) => updateSelected({ scale: v || 1 })} />
                </div>
                <div className="field">
                  <span className="field-label" style={{ width: 70 }}>绑定源</span>
                  <Input placeholder="liveSourceId（OPC-UA/WS/MQTT）" value={selected.bindings?.liveSourceId ?? ''}
                    onChange={(e) => updateSelected({ bindings: { liveSourceId: e.target.value, fields: selected.bindings?.fields ?? {} } })} />
                </div>

                {pred && (
                  <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)', fontSize: 11, color: '#9fb0c3' }}>
                    仿真预测：健康指数 <b style={{ color: '#7dd3fc' }}>{pred.healthIndex}</b>
                    {pred.rul != null && <> · RUL <b style={{ color: '#7dd3fc' }}>{pred.rul}h</b></>} · 状态 {pred.state}
                  </div>
                )}

                <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid var(--line)' }}>
                  <div className="muted2" style={{ marginBottom: 6 }}>闭环控制</div>
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                    {(['start', 'stop', 'reset'] as ControlAction[]).map((a) => (
                      <Button key={a} size="small" onClick={() => dispatchControl(a)}>{CONTROL_LABELS[a]}</Button>
                    ))}
                  </div>
                  {entityAlarms.length > 0 && (
                    <div style={{ marginTop: 6, color: '#f59e0b', fontSize: 11 }}>
                      {entityAlarms[0].message}
                    </div>
                  )}
                </div>

                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                  <div className="muted2" style={{ marginBottom: 6 }}>关键帧轨迹（{keyframes[selected.id]?.length ?? 0} 个）</div>
                  <Button size="small" block style={{ marginBottom: 6 }} onClick={recordKeyframe}>⏺ 录制关键帧 @ {currentTime.toFixed(1)}s</Button>
                  {(keyframes[selected.id] ?? []).map((kf, i) => (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#9fb0c3', marginBottom: 3 }}>
                      <span style={{ color: '#4ade80' }}>◆</span>
                      <span>{kf.time.toFixed(1)}s</span>
                      <span>x:{kf.x.toFixed(1)} z:{kf.z.toFixed(1)}</span>
                      <Button type="text" size="small" style={{ marginLeft: 'auto' }} onClick={() => deleteKeyframe(selected.id, kf.time)}>✕</Button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <div className="sec">
              <div className="sec-title">属性面板</div>
              <div className="muted2" style={{ marginTop: 8 }}>点击 3D 视口中的对象查看属性 / 仿真 / 控制</div>
            </div>
          )}

          {/* 场景对象列表 */}
          <div className="sec">
            <div className="sec-title">场景对象（{entities.length}）</div>
            <div style={{ maxHeight: 160, overflow: 'auto', marginTop: 8 }}>
              {entities.map((o) => (
                <div key={o.id} className={'card' + (o.id === selectedId ? ' sel' : '')}
                  style={{ padding: '6px 8px', marginBottom: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={() => setSelectedId(o.id)}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: o.color }} />
                  <span style={{ fontSize: 12, color: '#cfd9e6' }}>{o.name}</span>
                  {(keyframes[o.id]?.length ?? 0) > 0 && <Tag>{keyframes[o.id].length}帧</Tag>}
                </div>
              ))}
              {entities.length === 0 && <div className="muted2">暂无对象</div>}
            </div>
          </div>
        </div>
      </div>

      {/* 时间轴 */}
      <div className="sec" style={{ marginTop: 4 }}>
        <div className="sec-head">
          <div>
            <span className="sec-title">关键帧时间轴</span>
            <span className="muted2" style={{ marginLeft: 8 }}>点击轨道空白处移动播放头 · 录制按钮在右侧属性面板</span>
          </div>
          <div className="flex" style={{ alignItems: 'center' }}>
            <span className="muted2">时长</span>
            <InputNumber size="small" min={1} max={60} value={duration} style={{ width: 64 }} onChange={(v) => setDuration(Math.max(1, v ?? 1))} />
            <span className="muted2">s</span>
            <span className="muted2" style={{ marginLeft: 12 }}>{currentTime.toFixed(1)}s / {duration}s</span>
            <Button size="small" onClick={play}>{playing ? '⏸ 暂停' : '▶ 播放'}</Button>
            <Button size="small" onClick={stop}>⏹ 停止</Button>
          </div>
        </div>

        <svg width={TL_WIDTH} height={Math.max(tlContentH, TL_HEIGHT)} style={{ background: '#080d16', borderRadius: 8, border: '1px solid var(--line)', display: 'block' }}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect()
            const x = e.clientX - rect.left
            scrub(Math.max(0, Math.min(duration, (x / TL_WIDTH) * duration)))
          }}>
          {Array.from({ length: duration + 1 }).map((_, i) => {
            const x = (i / duration) * TL_WIDTH
            return (
              <g key={i}>
                <line x1={x} y1={0} x2={x} y2={RULER_H} stroke="#2a3340" strokeWidth={1} />
                <text x={x + 3} y={14} fill="#6b7d8f" fontSize={10}>{i}s</text>
              </g>
            )
          })}
          {objectsWithKfs.length === 0 ? (
            <text x={TL_WIDTH / 2 - 60} y={RULER_H + 30} fill="#6b7d8f" fontSize={12}>选中对象后点击「录制关键帧」添加轨迹</text>
          ) : (
            objectsWithKfs.map((o, rowIdx) => {
              const y = RULER_H + rowIdx * ROW_H
              const kfs = keyframes[o.id] || []
              return (
                <g key={o.id}>
                  <line x1={0} y1={y} x2={TL_WIDTH} y2={y} stroke="#1a2433" strokeWidth={1} />
                  <text x={4} y={y + 14} fill="#9fb0c3" fontSize={10}>{o.name}</text>
                  {kfs.map((kf, i) => {
                    const kx = (kf.time / duration) * TL_WIDTH
                    return (
                      <polygon key={i} points={`${kx - 5},${y + 10} ${kx},${y + 4} ${kx + 5},${y + 10} ${kx},${y + 16}`} fill={o.color} stroke="#0a0e1a" strokeWidth={0.5} style={{ cursor: 'pointer' }} />
                    )
                  })}
                </g>
              )
            })
          )}
          <line x1={(currentTime / duration) * TL_WIDTH} y1={0} x2={(currentTime / duration) * TL_WIDTH} y2={Math.max(tlContentH, TL_HEIGHT)} stroke="#ef4444" strokeWidth={1.5} />
          <polygon points={`${(currentTime / duration) * TL_WIDTH - 5},0 ${(currentTime / duration) * TL_WIDTH + 5},0 ${(currentTime / duration) * TL_WIDTH},8`} fill="#ef4444" />
        </svg>
      </div>
    </div>
  )
}

function buildDefaultEntities(): TwinEntity[] {
  const demo = [
    { p: PRESETS[0], x: -4, z: -2 },
    { p: PRESETS[2], x: 4, z: 2 },
    { p: PRESETS[3], x: 0, z: 4 }
  ]
  return demo.map((d) => makeEntity(d.p, d.x, d.z))
}
