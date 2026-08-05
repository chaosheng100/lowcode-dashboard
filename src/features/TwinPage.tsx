import { useEffect, useRef, useState, useCallback } from 'react'
import { Button, ColorPicker, Input as AntInput, InputNumber, Select } from 'antd'
import { useNavigate } from 'react-router-dom'
import {
  AppstoreOutlined,
  CameraOutlined,
  CaretRightOutlined,
  CloudOutlined,
  CloseOutlined,
  DeleteOutlined,
  EyeInvisibleOutlined,
  EyeOutlined,
  LockOutlined,
  MoonOutlined,
  PauseOutlined,
  SearchOutlined,
  SettingOutlined,
  StopOutlined,
  SunOutlined,
  UnlockOutlined
} from '@ant-design/icons'
import { useApi } from './useApi'
import { api, type TwinCategory, type TwinModelDTO } from '../mock'
import { Input, Tag } from './common'
import { useTwinRuntimeStore, EMPTY_TWIN_INSTANCE } from '../twin/twinRuntimeStore'
import { useDesignerStore } from '../data/store/useDesignerStore'
import {
  CONTROL_LABELS,
  type ControlAction,
  type GeoType,
  type TelemetrySample,
  type TwinEntity,
  type TwinScene
} from '../twin/twinTypes'
import { TwinSceneView, type TwinSceneViewController } from '../twin/TwinSceneView'

// ============================================================
// 数字孪生 3D 编辑器（复用 TwinSceneView 共享内核，不再各自维护重复渲染/仿真/控制样板）
// 功能：拖拽式场景搭建、模型选中/拖拽/旋转/缩放、关键帧轨迹、日照/夜景/雾效；
//       + 仿真面板（TwinSim 健康指数/RUL）、控制面板（TwinControlHub 闭环下发）、
//       + 告警面板（运行时 store 预测性维护告警）、实体数据绑定（liveSourceId）。
// 编辑与展示共用同一内核（TwinSceneView），实现“一次建模、到处渲染”。
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

function makeAssetEntity(model: TwinModelDTO, x: number, z: number): TwinEntity {
  return {
    id: nextId(),
    name: model.name,
    geoType: 'box',
    color: '#ffffff', // 白色乘色不改变 GLB 原生材质，用户可在属性面板改色
    assetUrl: model.assetUrl,
    modelId: model.id,
    x,
    y: 0.6,
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

// 模块编辑器作为独立的孪生运行时会话（与大屏中的数字孪生组件互不串数据）
const TWIN_MODULE_INSTANCE = 'twin-module'

export default function TwinPage(props: TwinPageProps = {}) {
  const { scene: externalScene, readOnly, onSave } = props
  const navigate = useNavigate()
  const { data: models } = useApi(() => api.listTwinModels({ pageSize: 200 }), [])
  const rt = useTwinRuntimeStore((s) => s.instances[TWIN_MODULE_INSTANCE]) ?? EMPTY_TWIN_INSTANCE

  // 命令式接口（拖拽/属性/关键帧/控制操作经由共享内核 TwinSceneView）
  const viewRef = useRef<TwinSceneViewController | null>(null)
  const liveRef = useRef<Record<string, TelemetrySample>>({})

  // 初始场景：优先使用外部传入的 scene（列表 → 编辑器互通），
  // 否则从全局孪生场景库读取（模块与大屏共享同一份，实现互通 + 持久化）
  const activeSceneId = externalScene?.id ?? (useDesignerStore.getState().activeTwinSceneId || 'main')
  const storeScene = externalScene ?? useDesignerStore.getState().twinScenes[activeSceneId]
  const initialEntities = storeScene?.entities?.length ? storeScene.entities : buildDefaultEntities()
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

  const draggingRef = useRef<string | null>(null)
  const [modelKw, setModelKw] = useState('')
  const [modelCategory, setModelCategory] = useState<TwinCategory | undefined>(undefined)

  const syncRefs = useCallback(() => {
    entitiesRef.current = entities
    keyframesRef.current = keyframes
  }, [entities, keyframes])

  const sceneOf = useCallback(
    (ents: TwinEntity[]): TwinScene => ({ id: 'editor', name: '编辑场景', entities: ents, env: { lighting, fog } }),
    [lighting, fog]
  )

  // 同步 refs
  useEffect(() => { syncRefs() }, [syncRefs])

  // 随机游走遥测：仅填充 liveRef，渲染/仿真由 TwinSceneView 统一消费（模块编辑器自带数据源）
  useEffect(() => {
    const tick = () => {
      entitiesRef.current.forEach((e) => {
        const prev = liveRef.current[e.id] ?? { temperature: e.metrics?.temperature ?? 40, health: e.metrics?.health ?? 80, load: e.metrics?.load ?? 40 }
        const s: TelemetrySample = {
          temperature: clamp(prev.temperature + (Math.random() - 0.5) * 9, 20, 95),
          health: clamp(prev.health + (Math.random() - 0.5) * 7, 5, 100),
          load: clamp(prev.load + (Math.random() - 0.5) * 16, 0, 100)
        }
        liveRef.current[e.id] = s
      })
    }
    tick()
    const timer = setInterval(tick, 2500)
    return () => clearInterval(timer)
  }, [])

  // 编辑结果写回全局孪生场景库：使大屏数字孪生组件同步同一份场景，且切换路由不丢失
  useEffect(() => {
    const id = externalScene?.id ?? (useDesignerStore.getState().activeTwinSceneId || 'main')
    useDesignerStore.getState().updateTwinSceneEntities(id, entities, { lighting, fog })
  }, [entities, lighting, fog, externalScene])

  // 场景变更时通过 onSave 回调写回 API（防抖 1.5s，避免频繁请求）
  useEffect(() => {
    if (!onSave) return
    const timer = setTimeout(() => {
      const scene: TwinScene = { id: activeSceneId, name: storeScene?.name ?? '', entities, env: { lighting, fog } }
      onSave(scene)
    }, 1500)
    return () => clearTimeout(timer)
  }, [entities, lighting, fog, onSave, activeSceneId, storeScene?.name])

  // 退出编辑页时：清理仿真告警 + 最终回写 API
  useEffect(() => () => {
    useTwinRuntimeStore.getState().clearAlarms(TWIN_MODULE_INSTANCE)
    // 最终保存：确保不丢失未触发的防抖
    if (onSave) {
      const scene: TwinScene = { id: activeSceneId, name: storeScene?.name ?? '', entities: entitiesRef.current, env: { lighting, fog } }
      onSave(scene)
    }
  }, [])

  // ---- 拖拽放置 / 选中 / 移动（经由共享内核的 renderer 接口） ----
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const canvas = view.getCanvas()
    if (!canvas) return
    const onDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return
      const id = view.pickEntityAt(ev.clientX, ev.clientY)
      if (id) {
        const ent = entitiesRef.current.find((e) => e.id === id)
        if (ent?.locked) return
        draggingRef.current = id
        view.setControlsEnabled(false)
        setSelectedId(id)
      }
    }
    const onMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return
      const gp = view.groundPointAt(ev.clientX, ev.clientY)
      if (gp) view.updateEntityTransform(draggingRef.current, { x: gp.x, z: gp.z })
    }
    const onUp = () => {
      if (!draggingRef.current) return
      const id = draggingRef.current
      draggingRef.current = null
      view.setControlsEnabled(true)
      const t = view.getEntityTransform(id)
      if (t) setEntities((prev) => prev.map((e) => (e.id === id ? { ...e, x: t.x, y: t.y, z: t.z } : e)))
    }
    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [])

  const modelList = (models?.list ?? []).filter((m) => !m.builtin && (m.status ?? 'active') === 'active')
  const modelKeyword = modelKw.trim().toLowerCase()
  const filteredModels = modelList.filter((m) => {
    const hitKw =
      !modelKeyword ||
      m.name.toLowerCase().includes(modelKeyword) ||
      (m.tags ?? []).some((t) => t.toLowerCase().includes(modelKeyword))
    const hitCat = !modelCategory || m.category === modelCategory
    return hitKw && hitCat
  })

  const openModelLibrary = () => navigate('/extension/twin?view=models')

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
        viewRef.current?.updateEntityTransform(e.id, pose)
      }
    }
    loop()
    return () => cancelAnimationFrame(raf)
  }, [duration])

  // ---- 操作 ----
  const handleDrop = useCallback((ev: React.DragEvent) => {
    ev.preventDefault()
    const view = viewRef.current
    if (!view) return
    const gp = view.groundPointAt(ev.clientX, ev.clientY)
    const rawModel = ev.dataTransfer.getData('application/x-lowcode-twin-model')
    if (rawModel) {
      try {
        const model = JSON.parse(rawModel) as TwinModelDTO
        const ent = makeAssetEntity(model, gp?.x ?? 0, gp?.z ?? 0)
        view.addEntity(ent)
        setEntities((prev) => [...prev, ent])
        return
      } catch {
        // 拖拽数据异常时回退到内置几何体处理
      }
    }
    const idx = parseInt(ev.dataTransfer.getData('text/plain'), 10)
    if (isNaN(idx) || idx < 0 || idx >= PRESETS.length) return
    const preset = PRESETS[idx]
    const ent = makeEntity(preset, gp?.x ?? 0, gp?.z ?? 0)
    view.addEntity(ent)
    setEntities((prev) => [...prev, ent])
  }, [])

  const deleteSelected = () => {
    if (!selectedId) return
    viewRef.current?.removeEntity(selectedId)
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
    const view = viewRef.current
    if (!view) return
    if (patch.color) view.setEntityColor(selectedId, patch.color)
    if (patch.visible !== undefined) view.setEntityVisible(selectedId, patch.visible)
    if (patch.material) view.setEntityMaterial(selectedId, patch.material)
    if (patch.x !== undefined || patch.z !== undefined || patch.rotationY !== undefined || patch.scale !== undefined) {
      const t = view.getEntityTransform(selectedId)
      if (t) view.updateEntityTransform(selectedId, { x: patch.x ?? t.x, y: t.y, z: patch.z ?? t.z, rotationY: patch.rotationY ?? t.rotationY, scale: patch.scale })
    }
  }

  const toggleEntityVisible = (id: string) => {
    const ent = entities.find((e) => e.id === id)
    if (!ent) return
    const visible = ent.visible === false ? true : false
    setEntities((prev) => prev.map((o) => (o.id === id ? { ...o, visible } : o)))
    viewRef.current?.setEntityVisible(id, visible)
  }

  const toggleEntityLocked = (id: string) => {
    const ent = entities.find((e) => e.id === id)
    if (!ent) return
    const locked = !ent.locked
    setEntities((prev) => prev.map((o) => (o.id === id ? { ...o, locked } : o)))
  }

  const recordKeyframe = () => {
    if (!selectedId) return
    const t = viewRef.current?.getEntityTransform(selectedId)
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
    await viewRef.current?.dispatchControl(ent, action)
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
          <h2 className="fp-title">数字孪生 3D 编辑器{readOnly ? '（预览）' : ''}</h2>
          <p className="fp-sub">
            {readOnly ? '场景预览 · ' : '拖拽搭建 · 关键帧轨迹 · '}日照/夜景/雾效 · {entities.length} 个场景对象 · {totalKeyframes} 个关键帧{readOnly ? '' : ' · 仿真/控制/告警已接入'}
          </p>
        </div>
        <span className="fp-count">模型库 {models?.total ?? (models?.list?.length ?? 0)} 种</span>
      </div>

      <div className={readOnly ? 'twin-editor twin-preview' : 'twin-editor'}>
        {/* 左：模型库（预览模式隐藏） */}
        {!readOnly && (
          <div className="twin-panel twin-left">
            <div className="twin-panel-head">
              <span className="twin-panel-title">模型库（拖拽到画布放置）</span>
              <Button size="small" icon={<SettingOutlined />} onClick={openModelLibrary}>模型库管理</Button>
            </div>
            <div className="twin-preset-grid">
              {PRESETS.map((p, i) => (
                <div
                  draggable
                  key={i}
                  className={'card twin-preset' + (activePreset === i ? ' sel' : '')}
                  onDragStart={(ev) => { ev.dataTransfer.setData('text/plain', String(i)); ev.dataTransfer.effectAllowed = 'copy' }}
                  onClick={() => setActivePreset(i)}
                >
                  <i className={'twin-preset-swatch' + (p.geoType === 'sphere' ? ' round' : '')} style={{ background: p.color }} />
                  <div className="twin-preset-name">{p.name}</div>
                </div>
              ))}
            </div>
            {filteredModels.length > 0 && (
              <div className="twin-model-grid">
                <div className="twin-panel-title">在线模型库（共 {filteredModels.length} 种）</div>
                <div className="twin-model-filter">
                  <AntInput
                    size="small"
                    placeholder="搜索模型"
                    prefix={<SearchOutlined />}
                    allowClear
                    value={modelKw}
                    onChange={(e) => setModelKw(e.target.value)}
                  />
                  <Select
                    size="small"
                    placeholder="分类"
                    allowClear
                    value={modelCategory}
                    onChange={setModelCategory}
                    style={{ width: '100%' }}
                    options={[
                      { value: '建筑', label: '建筑' },
                      { value: '设备', label: '设备' },
                      { value: '交通', label: '交通' },
                      { value: '自然', label: '自然' },
                      { value: '人物', label: '人物' },
                      { value: '其他', label: '其他' }
                    ]}
                  />
                </div>
                {filteredModels.map((m) => (
                  <div
                    key={m.id}
                    draggable
                    className="card twin-model-item"
                    title={m.assetUrl ? '拖拽到画布放置（外部模型）' : '内置模型'}
                    onDragStart={(ev) => {
                      ev.dataTransfer.setData(
                        'application/x-lowcode-twin-model',
                        JSON.stringify({ id: m.id, name: m.name, assetUrl: m.assetUrl })
                      )
                      ev.dataTransfer.effectAllowed = 'copy'
                    }}
                  >
                    {m.thumbnail ? (
                      <img src={m.thumbnail} alt={m.name} width={36} height={36} />
                    ) : (
                      <span className="twin-model-thumb"><AppstoreOutlined /></span>
                    )}
                    <div className="muted2 twin-model-name">{m.name}</div>
                  </div>
                ))}
              </div>
            )}
            {modelList.length > 0 && filteredModels.length === 0 && (
              <div className="muted2 twin-model-empty">无匹配模型</div>
            )}
          </div>
        )}

        {/* 中：3D 视口（共享内核 TwinSceneView） */}
        <div className="twin-panel twin-center">
          <div className="twin-toolbar">
            <Select
              size="small"
              style={{ width: 120 }}
              value={lighting + (fog ? '-fog' : '')}
              onChange={(v) => {
                if (v === 'day' || v === 'night') {
                  setLighting(v)
                  setFog(false)
                } else if (v === 'day-fog' || v === 'night-fog') {
                  setLighting(v === 'day-fog' ? 'day' : 'night')
                  setFog(true)
                }
              }}
              options={[
                { value: 'day', label: '日景预设' },
                { value: 'night', label: '夜景预设' },
                { value: 'day-fog', label: '日景雾效' },
                { value: 'night-fog', label: '夜景雾效' }
              ]}
            />
            <Button size="small" type={lighting === 'day' ? 'primary' : 'default'} icon={<SunOutlined />} onClick={() => setLighting('day')}>日照</Button>
            <Button size="small" type={lighting === 'night' ? 'primary' : 'default'} icon={<MoonOutlined />} onClick={() => setLighting('night')}>夜景</Button>
            <Button size="small" type={fog ? 'primary' : 'default'} icon={<CloudOutlined />} onClick={() => setFog((v) => !v)}>雾效 {fog ? '开' : '关'}</Button>
            <span className="muted2 twin-toolbar-hint">
              左键：放置/选中/拖拽 · 右键：旋转视角 · 滚轮：缩放
            </span>
          </div>
          <div className="twin-viewport" onDragOver={(ev) => ev.preventDefault()} onDrop={handleDrop}>
            <TwinSceneView
              ref={viewRef}
              key={activeSceneId}
              scene={sceneOf(entitiesRef.current)}
              instanceId={TWIN_MODULE_INSTANCE}
              options={{ lighting, fog }}
              getTelemetry={() => liveRef.current}
              simIntervalMs={2500}
              onSelectEntity={(id) => setSelectedId(id)}
            />
          </div>
          {entities.length === 0 && (
            <div className="muted2 twin-empty-hint">从模型库拖拽模型到 3D 视口放置</div>
          )}
        </div>

        {/* 右：属性 / 仿真 / 控制 / 告警（预览模式隐藏编辑控件） */}
        {!readOnly && (
          <div className="twin-panel twin-right">
            {selected ? (
              <div className="sec">
                <div className="sec-head">
                  <span className="sec-title">选中对象</span>
                  <Button size="small" danger icon={<DeleteOutlined />} onClick={deleteSelected}>删除</Button>
                </div>
                <div className="sec-body">
                  <div className="twin-field">
                    <span className="twin-field-label">名称</span>
                    <div className="twin-field-ctrl">
                      <Input value={selected.name} onChange={(e) => updateSelected({ name: e.target.value })} />
                    </div>
                  </div>
                  <div className="twin-field">
                    <span className="twin-field-label">颜色</span>
                    <ColorPicker value={selected.color} onChange={(c) => updateSelected({ color: c.toHexString() })} />
                  </div>
                  <div className="twin-divider">
                    <div className="muted2 twin-section-label">材质</div>
                    <div className="twin-material-grid">
                      <div className="twin-field">
                        <span className="twin-field-label">金属度</span>
                        <InputNumber style={{ width: '100%' }} min={0} max={1} step={0.05}
                          value={selected.material?.metalness ?? 0.3}
                          onChange={(v) => updateSelected({ material: { ...(selected.material || {}), metalness: v ?? 0 } })} />
                      </div>
                      <div className="twin-field">
                        <span className="twin-field-label">粗糙度</span>
                        <InputNumber style={{ width: '100%' }} min={0} max={1} step={0.05}
                          value={selected.material?.roughness ?? 0.6}
                          onChange={(v) => updateSelected({ material: { ...(selected.material || {}), roughness: v ?? 0 } })} />
                      </div>
                      <div className="twin-field">
                        <span className="twin-field-label">透明度</span>
                        <InputNumber style={{ width: '100%' }} min={0} max={1} step={0.05}
                          value={selected.material?.opacity ?? 1}
                          onChange={(v) => updateSelected({ material: { ...(selected.material || {}), opacity: v ?? 1 } })} />
                      </div>
                      <div className="twin-field">
                        <span className="twin-field-label">自发光</span>
                        <ColorPicker
                          value={selected.material?.emissive || '#000000'}
                          onChange={(c) => updateSelected({
                            material: { ...(selected.material || {}), emissive: c.toHexString(), emissiveIntensity: selected.material?.emissiveIntensity ?? 0 }
                          })}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="twin-field">
                    <span className="twin-field-label">旋转°</span>
                    <InputNumber style={{ width: '100%' }} value={Math.round((selected.rotationY ?? 0) * 180 / Math.PI)}
                      onChange={(v) => updateSelected({ rotationY: (v ?? 0) * Math.PI / 180 })} />
                  </div>
                  <div className="twin-field">
                    <span className="twin-field-label">缩放</span>
                    <InputNumber style={{ width: '100%' }} step={0.1} value={selected.scale ?? 1}
                      onChange={(v) => updateSelected({ scale: v || 1 })} />
                  </div>
                  <div className="twin-field">
                    <span className="twin-field-label">绑定源</span>
                    <div className="twin-field-ctrl">
                      <Input placeholder="liveSourceId（OPC-UA/WS/MQTT）" value={selected.bindings?.liveSourceId ?? ''}
                        onChange={(e) => updateSelected({ bindings: { liveSourceId: e.target.value, fields: selected.bindings?.fields ?? {} } })} />
                    </div>
                  </div>

                  {pred && (
                    <div className="twin-divider twin-pred">
                      仿真预测：健康指数 <b>{pred.healthIndex}</b>
                      {pred.rul != null && <> · RUL <b>{pred.rul}h</b></>} · 状态 {pred.state}
                    </div>
                  )}

                  <div className="twin-divider">
                    <div className="muted2 twin-section-label">闭环控制</div>
                    <div className="twin-control-grid">
                      {(['start', 'stop', 'reset'] as ControlAction[]).map((a) => (
                        <Button key={a} size="small" onClick={() => dispatchControl(a)}>{CONTROL_LABELS[a]}</Button>
                      ))}
                    </div>
                    {entityAlarms.length > 0 && (
                      <div className="twin-alarm">{entityAlarms[0].message}</div>
                    )}
                  </div>

                  <div className="twin-divider">
                    <div className="muted2 twin-section-label">关键帧轨迹（{keyframes[selected.id]?.length ?? 0} 个）</div>
                    <Button size="small" block icon={<CameraOutlined />} className="twin-record-btn" onClick={recordKeyframe}>
                      录制关键帧 @ {currentTime.toFixed(1)}s
                    </Button>
                    <div className="twin-kf-list">
                      {(keyframes[selected.id] ?? []).map((kf, i) => (
                        <div key={i} className="twin-kf-row">
                          <span className="twin-kf-dot" aria-hidden />
                          <span>{kf.time.toFixed(1)}s</span>
                          <span>x:{kf.x.toFixed(1)} z:{kf.z.toFixed(1)}</span>
                          <Button type="text" size="small" className="twin-kf-del" icon={<CloseOutlined />}
                            onClick={() => deleteKeyframe(selected.id, kf.time)} />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="sec">
                <div className="sec-title">属性面板</div>
                <div className="muted2 twin-empty-hint twin-select-hint">点击 3D 视口中的对象查看属性 / 仿真 / 控制</div>
              </div>
            )}

            {/* 场景对象列表 */}
            <div className="sec">
              <div className="sec-title">场景对象（{entities.length}）</div>
              <div className="twin-object-list">
                {entities.map((o) => (
                  <div
                    key={o.id}
                    className={'card twin-object-item' + (o.id === selectedId ? ' sel' : '') + (o.visible === false ? ' hidden' : '')}
                    onClick={() => setSelectedId(o.id)}
                  >
                    <i className="twin-object-dot" style={{ background: o.color }} />
                    <span className="twin-object-name" title={o.name}>{o.name}</span>
                    {(keyframes[o.id]?.length ?? 0) > 0 && <Tag>{keyframes[o.id].length}帧</Tag>}
                    <span className="twin-object-ops">
                      <Button
                        type="text"
                        size="small"
                        className="icon-btn"
                        title={o.visible === false ? '显示' : '隐藏'}
                        icon={o.visible === false ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          toggleEntityVisible(o.id)
                        }}
                      />
                      <Button
                        type="text"
                        size="small"
                        className="icon-btn"
                        title={o.locked ? '解锁' : '锁定'}
                        icon={o.locked ? <LockOutlined /> : <UnlockOutlined />}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          toggleEntityLocked(o.id)
                        }}
                      />
                    </span>
                  </div>
                ))}
                {entities.length === 0 && <div className="muted2">暂无对象</div>}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 时间轴（预览模式仅显示，不可编辑） */}
      {!readOnly && (
        <div className="sec twin-timeline">
          <div className="sec-head twin-timeline-head">
            <div className="twin-timeline-title">
              <span className="sec-title">关键帧时间轴</span>
              <span className="muted2 twin-timeline-hint">点击轨道空白处移动播放头 · 录制按钮在右侧属性面板</span>
            </div>
            <div className="twin-timeline-controls">
              <span className="muted2">时长</span>
              <InputNumber size="small" min={1} max={60} value={duration} style={{ width: 64 }} onChange={(v) => setDuration(Math.max(1, v ?? 1))} />
              <span className="muted2">s</span>
              <span className="muted2 twin-timeline-time">{currentTime.toFixed(1)}s / {duration}s</span>
              <Button size="small" icon={playing ? <PauseOutlined /> : <CaretRightOutlined />} onClick={play}>{playing ? '暂停' : '播放'}</Button>
              <Button size="small" icon={<StopOutlined />} onClick={stop}>停止</Button>
            </div>
          </div>

          <svg className="twin-timeline-svg" viewBox={`0 0 ${TL_WIDTH} ${Math.max(tlContentH, TL_HEIGHT)}`}
            onClick={(e) => {
              const rect = e.currentTarget.getBoundingClientRect()
              const x = (e.clientX - rect.left) / rect.width * TL_WIDTH
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
      )}
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
