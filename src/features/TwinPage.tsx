import { useEffect, useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { Button, ColorPicker, InputNumber } from 'antd'
import { useApi } from './useApi'
import { api } from '../mock'
import { Input, Tag } from './common'

// ============================================================
// 数字孪生 3D 编辑器
// 功能：拖拽式场景搭建、模型选中/拖拽/旋转/缩放、关键帧轨迹录制与回放、
//       时间轴编辑、日照/夜景/雾效、91 种预置模型库。
//
// 交互：
//   左键拖拽空处 → 旋转视角
//   左键点击模型 → 选中
//   左键拖拽模型 → 在地面平移
//   右键拖拽 → 平移视角
//   滚轮 → 缩放
//   拖拽模型库预设到画布 → 放置模型
// ============================================================

type GeoType = 'box' | 'cylinder' | 'sphere' | 'cone' | 'torus' | 'plane'

interface PlacedObject {
  id: string
  modelId: string
  name: string
  geoType: GeoType
  color: string
  x: number
  z: number
  y: number
  rotationY: number
  scale: number
}

interface Keyframe {
  time: number
  x: number
  z: number
  rotationY: number
}

// 模型预设（与 91 种预置模型库对应，实际使用基元几何体）
const PRESETS: { geoType: GeoType; name: string; color: string }[] = [
  { geoType: 'box', name: '建筑A', color: '#4f8cff' },
  { geoType: 'box', name: '建筑B', color: '#22d3ee' },
  { geoType: 'cylinder', name: '储罐', color: '#a855f7' },
  { geoType: 'sphere', name: '球形罐', color: '#4ade80' },
  { geoType: 'cone', name: '塔楼', color: '#f59e0b' },
  { geoType: 'torus', name: '环形设施', color: '#ec4899' },
  { geoType: 'box', name: '厂房', color: '#64748b' },
  { geoType: 'cylinder', name: '烟囱', color: '#ef4444' },
  { geoType: 'plane', name: '平台', color: '#3b82f6' },
]

function createGeometry(type: GeoType, s: number): THREE.BufferGeometry {
  switch (type) {
    case 'cylinder': return new THREE.CylinderGeometry(0.4 * s, 0.4 * s, 1.2 * s, 24)
    case 'sphere': return new THREE.SphereGeometry(0.5 * s, 24, 24)
    case 'cone': return new THREE.ConeGeometry(0.5 * s, 1.5 * s, 24)
    case 'torus': return new THREE.TorusGeometry(0.5 * s, 0.18 * s, 16, 32)
    case 'plane': return new THREE.BoxGeometry(1.5 * s, 0.1 * s, 1.5 * s)
    default: return new THREE.BoxGeometry(0.8 * s, 1 * s, 0.8 * s)
  }
}

let idCounter = 0
const nextId = () => `obj_${Date.now()}_${idCounter++}`

interface TwinPageProps {
  scene?: import('../mock/types').TwinSceneDTO
  readOnly?: boolean
  onSave?: (patch: Partial<import('../mock/types').TwinSceneDTO>) => void
}

export default function TwinPage(_props: TwinPageProps = {}) {
  const { data: models } = useApi(() => api.listTwinModels({ pageSize: 30 }), [])
  const mountRef = useRef<HTMLDivElement>(null)

  // ---- UI state ----
  const [lighting, setLighting] = useState<'day' | 'night'>('day')
  const [fog, setFog] = useState(false)
  const [activePreset, setActivePreset] = useState<number>(0)
  const [placedObjects, setPlacedObjects] = useState<PlacedObject[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [keyframes, setKeyframes] = useState<Record<string, Keyframe[]>>({})

  // Timeline
  const [duration, setDuration] = useState(10)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)

  // ---- Three.js refs (不触发 React 重渲染) ----
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const controlsRef = useRef<OrbitControls | null>(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const groundRef = useRef<THREE.Mesh | null>(null)
  const objects3DRef = useRef<Map<string, THREE.Mesh>>(new Map())
  const draggingRef = useRef<{ id: string; moved: boolean } | null>(null)
  const selectedIdRef = useRef<string | null>(null)
  const outlineRef = useRef<THREE.LineSegments | null>(null)
  const animRef = useRef(0)
  const playingRef = useRef(false)
  const currentTimeRef = useRef(0)
  const lastTickRef = useRef(0)

  // 同步 ref
  useEffect(() => { selectedIdRef.current = selectedId }, [selectedId])
  useEffect(() => { playingRef.current = playing }, [playing])
  useEffect(() => { currentTimeRef.current = currentTime }, [currentTime])

  // ---- 选中高亮：给/取消选中对象加线框 ----
  const updateOutline = useCallback(() => {
    if (outlineRef.current) {
      sceneRef.current?.remove(outlineRef.current)
      outlineRef.current.geometry.dispose()
      ;(outlineRef.current.material as THREE.Material).dispose()
      outlineRef.current = null
    }
    if (!selectedId || !sceneRef.current) return
    const mesh = objects3DRef.current.get(selectedId)
    if (!mesh) return
    const edges = new THREE.EdgesGeometry(mesh.geometry)
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0x4ade80, linewidth: 2 }))
    line.position.copy(mesh.position)
    line.rotation.copy(mesh.rotation)
    line.scale.copy(mesh.scale)
    sceneRef.current.add(line)
    outlineRef.current = line
  }, [selectedId])

  useEffect(() => { updateOutline() }, [selectedId, placedObjects, updateOutline])

  // ---- 拖拽放置模型 ----
  const handleDrop = useCallback((ev: React.DragEvent) => {
    ev.preventDefault()
    const presetIndex = parseInt(ev.dataTransfer.getData("text/plain"), 10)
    if (isNaN(presetIndex) || presetIndex < 0 || presetIndex >= PRESETS.length) return
    const preset = PRESETS[presetIndex]
    const canvas = rendererRef.current?.domElement
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const pointer = new THREE.Vector2()
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
    raycasterRef.current.setFromCamera(pointer, cameraRef.current!)
    const hits = raycasterRef.current.intersectObject(groundRef.current!)
    const pt = hits[0]?.point
    if (!pt) return
    const id = nextId()
    const obj: PlacedObject = {
      id, modelId: `preset_${presetIndex}`, name: preset.name, geoType: preset.geoType, color: preset.color,
      x: pt.x, z: pt.z, y: preset.geoType === "plane" ? 0.05 : 0.6,
      rotationY: 0, scale: 1
    }
    setPlacedObjects((prev) => [...prev, obj])
  }, [])
  // ---- 主场景初始化 ----
  useEffect(() => {
    const el = mountRef.current
    if (!el) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(lighting === 'day' ? '#0a1422' : '#05080f')
    if (fog) scene.fog = new THREE.FogExp2(lighting === 'day' ? '#0a1422' : '#05080f', 0.035)
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 200)
    camera.position.set(7, 6, 9)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(el.clientWidth, el.clientHeight)
    renderer.setPixelRatio(window.devicePixelRatio)
    el.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // OrbitControls：右键旋转、滚轮缩放
    const controls = new OrbitControls(camera, renderer.domElement)
    controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.maxPolarAngle = Math.PI / 2 - 0.05
    controlsRef.current = controls

    // 光照
    scene.add(new THREE.AmbientLight(0xffffff, lighting === 'day' ? 0.85 : 0.2))
    const dir = new THREE.DirectionalLight(lighting === 'day' ? 0xfff2cc : 0x4466ff, lighting === 'day' ? 1.0 : 0.5)
    dir.position.set(5, 8, 5)
    scene.add(dir)

    // 地面
    const ground = new THREE.Mesh(
      new THREE.PlaneGeometry(30, 30),
      new THREE.MeshStandardMaterial({ color: 0x0d1a2b, roughness: 1, metalness: 0.1 })
    )
    ground.rotation.x = -Math.PI / 2
    ground.name = 'ground'
    scene.add(ground)
    groundRef.current = ground

    // 网格辅助
    const grid = new THREE.GridHelper(30, 30, 0x1a3050, 0x122038)
    scene.add(grid)

    // ---- 指针交互 ----
    const dom = renderer.domElement
    const ray = raycasterRef.current
    const pointer = new THREE.Vector2()

    const getGroundPoint = (ev: PointerEvent): THREE.Vector3 | null => {
      const rect = dom.getBoundingClientRect()
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
      ray.setFromCamera(pointer, camera)
      const hits = ray.intersectObject(ground)
      return hits[0]?.point ?? null
    }

    const getObjectHit = (ev: PointerEvent): { id: string; mesh: THREE.Mesh } | null => {
      const rect = dom.getBoundingClientRect()
      pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
      pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
      ray.setFromCamera(pointer, camera)
      const meshes = Array.from(objects3DRef.current.values())
      const hits = ray.intersectObjects(meshes)
      if (!hits[0]) return null
      const entry = Array.from(objects3DRef.current.entries()).find(([, m]) => m === hits[0].object)
      return entry ? { id: entry[0], mesh: entry[1] } : null
    }

    const onPointerDown = (ev: PointerEvent) => {
      if (ev.button !== 0) return // 只处理左键
      const hit = getObjectHit(ev)
      if (hit) {
        // 选中并准备拖拽
        setSelectedId(hit.id)
        selectedIdRef.current = hit.id
        draggingRef.current = { id: hit.id, moved: false }
        controls.enabled = false
      } else {
        // 点击空处，OrbitControls 处理旋转
        setSelectedId(null)
        selectedIdRef.current = null
      }
    }

    const onPointerMove = (ev: PointerEvent) => {
      if (!draggingRef.current) return
      const pt = getGroundPoint(ev)
      if (!pt) return
      const { id } = draggingRef.current
      draggingRef.current.moved = true
      // 更新 3D 对象位置
      const mesh = objects3DRef.current.get(id)
      if (mesh) {
        mesh.position.x = pt.x
        mesh.position.z = pt.z
      }
      // 更新 React state（节流：拖拽中只更新 ref，pointerup 时同步 state）
    }

    const onPointerUp = () => {
      if (!draggingRef.current) return
      const { id, moved } = draggingRef.current
      controls.enabled = true
      draggingRef.current = null
      if (moved) {
        // 拖拽结束：同步位置到 state
        const mesh = objects3DRef.current.get(id)
        if (mesh) {
          setPlacedObjects((prev) => prev.map((o) => o.id === id ? { ...o, x: mesh.position.x, z: mesh.position.z } : o))
        }
      }
    }

    dom.addEventListener('pointerdown', onPointerDown)
    dom.addEventListener('pointermove', onPointerMove)
    dom.addEventListener('pointerup', onPointerUp)

    // ---- 动画循环 ----
    const animate = () => {
      animRef.current = requestAnimationFrame(animate)
      controls.update()

      // 播放关键帧动画
      if (playingRef.current) {
        const now = performance.now()
        const dt = (now - lastTickRef.current) / 1000
        lastTickRef.current = now
        let t = currentTimeRef.current + dt
        if (t >= duration) { t = 0 } // 循环
        currentTimeRef.current = t
        setCurrentTime(t)

        // 插值每个对象的位置
        for (const [id, mesh] of objects3DRef.current) {
          const kfs = keyframes[id]
          if (!kfs || kfs.length === 0) continue
          const sorted = [...kfs].sort((a, b) => a.time - b.time)
          if (t <= sorted[0].time) {
            mesh.position.x = sorted[0].x
            mesh.position.z = sorted[0].z
            mesh.rotation.y = sorted[0].rotationY
          } else if (t >= sorted[sorted.length - 1].time) {
            const last = sorted[sorted.length - 1]
            mesh.position.x = last.x
            mesh.position.z = last.z
            mesh.rotation.y = last.rotationY
          } else {
            // 找到 t 所在的两个关键帧之间
            for (let i = 0; i < sorted.length - 1; i++) {
              if (t >= sorted[i].time && t <= sorted[i + 1].time) {
                const span = sorted[i + 1].time - sorted[i].time || 1
                const alpha = (t - sorted[i].time) / span
                mesh.position.x = THREE.MathUtils.lerp(sorted[i].x, sorted[i + 1].x, alpha)
                mesh.position.z = THREE.MathUtils.lerp(sorted[i].z, sorted[i + 1].z, alpha)
                mesh.rotation.y = THREE.MathUtils.lerp(sorted[i].rotationY, sorted[i + 1].rotationY, alpha)
                break
              }
            }
          }
        }
      }

      // 同步线框位置
      if (outlineRef.current) {
        const selMesh = selectedIdRef.current ? objects3DRef.current.get(selectedIdRef.current) : null
        if (selMesh) {
          outlineRef.current.position.copy(selMesh.position)
          outlineRef.current.rotation.copy(selMesh.rotation)
        }
      }

      renderer.render(scene, camera)
    }
    lastTickRef.current = performance.now()
    animate()

    const onResize = () => {
      if (!el) return
      camera.aspect = el.clientWidth / el.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(el.clientWidth, el.clientHeight)
    }
    window.addEventListener('resize', onResize)

    return () => {
      cancelAnimationFrame(animRef.current)
      dom.removeEventListener('pointerdown', onPointerDown)
      dom.removeEventListener('pointermove', onPointerMove)
      dom.removeEventListener('pointerup', onPointerUp)
      window.removeEventListener('resize', onResize)
      controls.dispose()
      renderer.dispose()
      if (renderer.domElement.parentNode === el) el.removeChild(renderer.domElement)
      sceneRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lighting, fog])

  // ---- 同步 placedObjects → Three.js 场景 ----
  useEffect(() => {
    const scene = sceneRef.current
    if (!scene) return

    // 移除已删除的对象
    for (const [id, mesh] of objects3DRef.current) {
      if (!placedObjects.find((o) => o.id === id)) {
        scene.remove(mesh)
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
        objects3DRef.current.delete(id)
      }
    }

    // 添加新对象
    for (const obj of placedObjects) {
      if (objects3DRef.current.has(obj.id)) {
        // 更新现有对象属性（位置/旋转/缩放由播放或拖拽控制，这里只同步非播放时）
        if (!playingRef.current) {
          const mesh = objects3DRef.current.get(obj.id)!
          mesh.position.set(obj.x, obj.y, obj.z)
          mesh.rotation.y = obj.rotationY
          mesh.scale.setScalar(obj.scale)
        }
      } else {
        const geo = createGeometry(obj.geoType, obj.scale)
        const mat = new THREE.MeshStandardMaterial({ color: obj.color, metalness: 0.3, roughness: 0.6 })
        const mesh = new THREE.Mesh(geo, mat)
        mesh.position.set(obj.x, obj.y, obj.z)
        mesh.rotation.y = obj.rotationY
        scene.add(mesh)
        objects3DRef.current.set(obj.id, mesh)
      }
    }
    updateOutline()
  }, [placedObjects, updateOutline])

  // ---- 操作 ----
  const deleteSelected = () => {
    if (!selectedId) return
    setPlacedObjects((prev) => prev.filter((o) => o.id !== selectedId))
    setKeyframes((prev) => { const n = { ...prev }; delete n[selectedId]; return n })
    setSelectedId(null)
  }

  const updateSelected = (patch: Partial<PlacedObject>) => {
    if (!selectedId) return
    setPlacedObjects((prev) => prev.map((o) => o.id === selectedId ? { ...o, ...patch } : o))
  }

  const recordKeyframe = () => {
    if (!selectedId) return
    const mesh = objects3DRef.current.get(selectedId)
    if (!mesh) return
    const kf: Keyframe = {
      time: parseFloat(currentTime.toFixed(2)),
      x: mesh.position.x,
      z: mesh.position.z,
      rotationY: mesh.rotation.y
    }
    setKeyframes((prev) => {
      const list = prev[selectedId] || []
      // 同时间点覆盖
      const filtered = list.filter((k) => Math.abs(k.time - kf.time) > 0.05)
      return { ...prev, [selectedId]: [...filtered, kf].sort((a, b) => a.time - b.time) }
    })
  }

  const deleteKeyframe = (objId: string, time: number) => {
    setKeyframes((prev) => ({
      ...prev,
      [objId]: (prev[objId] || []).filter((k) => Math.abs(k.time - time) > 0.05)
    }))
  }

  const play = () => {
    if (playing) { setPlaying(false); return }
    setCurrentTime(0)
    currentTimeRef.current = 0
    lastTickRef.current = performance.now()
    setPlaying(true)
  }

  const stop = () => {
    setPlaying(false)
    setCurrentTime(0)
    currentTimeRef.current = 0
  }

  const scrub = (t: number) => {
    setCurrentTime(t)
    currentTimeRef.current = t
    // 手动定位到该时间点
    for (const [id, mesh] of objects3DRef.current) {
      const kfs = keyframes[id]
      if (!kfs || kfs.length === 0) continue
      const sorted = [...kfs].sort((a, b) => a.time - b.time)
      if (t <= sorted[0].time) {
        mesh.position.x = sorted[0].x; mesh.position.z = sorted[0].z; mesh.rotation.y = sorted[0].rotationY
      } else if (t >= sorted[sorted.length - 1].time) {
        const last = sorted[sorted.length - 1]
        mesh.position.x = last.x; mesh.position.z = last.z; mesh.rotation.y = last.rotationY
      } else {
        for (let i = 0; i < sorted.length - 1; i++) {
          if (t >= sorted[i].time && t <= sorted[i + 1].time) {
            const span = sorted[i + 1].time - sorted[i].time || 1
            const alpha = (t - sorted[i].time) / span
            mesh.position.x = THREE.MathUtils.lerp(sorted[i].x, sorted[i + 1].x, alpha)
            mesh.position.z = THREE.MathUtils.lerp(sorted[i].z, sorted[i + 1].z, alpha)
            mesh.rotation.y = THREE.MathUtils.lerp(sorted[i].rotationY, sorted[i + 1].rotationY, alpha)
            break
          }
        }
      }
    }
  }

  const selected = placedObjects.find((o) => o.id === selectedId)
  const totalKeyframes = Object.values(keyframes).reduce((sum, kfs) => sum + kfs.length, 0)

  // ---- 时间轴宽度 ----
  const TL_WIDTH = 760
  const TL_HEIGHT = 140
  const RULER_H = 22
  const ROW_H = 22
  const objectsWithKfs = placedObjects.filter((o) => (keyframes[o.id]?.length ?? 0) > 0)
  const tlRows = Math.max(objectsWithKfs.length, 1)
  const tlContentH = RULER_H + tlRows * ROW_H + 4

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">数字孪生 3D 编辑器</h2>
          <p className="fp-sub">
            拖拽搭建 · 关键帧轨迹 · 日照/夜景/雾效 · {placedObjects.length} 个场景对象 · {totalKeyframes} 个关键帧
          </p>
        </div>
        <span className="fp-count">预置模型 91 种</span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '180px 1fr 240px', gap: 12 }}>
        {/* 左：模型库 */}
        <div>
          <div className="muted2" style={{ marginBottom: 8 }}>模型库（拖拽到画布放置）</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 460, overflow: 'auto' }}>
            {PRESETS.map((p, i) => (
              <div
                draggable
                key={i}
                className={'card' + (activePreset === i ? ' sel' : '')}
                style={{ padding: 8, textAlign: 'center', cursor: 'grab', borderColor: activePreset === i ? 'var(--accent)' : undefined }}
                onDragStart={(ev) => {
                  ev.dataTransfer.setData("text/plain", String(i))
                  ev.dataTransfer.effectAllowed = "copy"
                }}
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, maxHeight: 140, overflow: 'auto' }}>
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
          {placedObjects.length === 0 && (
            <div className="muted2" style={{ textAlign: 'center', marginTop: 8 }}>
              从模型库拖拽模型到 3D 视口放置
            </div>
          )}
        </div>

        {/* 右：属性面板 */}
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
                  <ColorPicker value={selected.color}
                    onChange={(c) => {
                      const hex = c.toHexString()
                      updateSelected({ color: hex })
                      const mesh = objects3DRef.current.get(selected.id)
                      if (mesh) (mesh.material as THREE.MeshStandardMaterial).color.set(hex)
                    }} />
                </div>
                <div className="field">
                  <span className="field-label" style={{ width: 70 }}>旋转°</span>
                  <InputNumber style={{ width: '100%' }} value={Math.round(selected.rotationY * 180 / Math.PI)}
                    onChange={(v) => {
                      const rad = (v ?? 0) * Math.PI / 180
                      updateSelected({ rotationY: rad })
                      const mesh = objects3DRef.current.get(selected.id)
                      if (mesh) mesh.rotation.y = rad
                    }} />
                </div>
                <div className="field">
                  <span className="field-label" style={{ width: 70 }}>缩放</span>
                  <InputNumber style={{ width: '100%' }} step={0.1} value={selected.scale}
                    onChange={(v) => {
                      const s = v || 1
                      updateSelected({ scale: s })
                      const mesh = objects3DRef.current.get(selected.id)
                      if (mesh) {
                        mesh.geometry.dispose()
                        mesh.geometry = createGeometry(selected.geoType, s)
                        mesh.scale.setScalar(1)
                      }
                    }} />
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid var(--line)' }}>
                  <div className="muted2" style={{ marginBottom: 6 }}>
                    关键帧轨迹（{keyframes[selected.id]?.length ?? 0} 个）
                  </div>
                  <Button size="small" block style={{ marginBottom: 6 }} onClick={recordKeyframe}>
                    ⏺ 录制关键帧 @ {currentTime.toFixed(1)}s
                  </Button>
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
              <div className="muted2" style={{ marginTop: 8 }}>点击 3D 视口中的对象查看属性</div>
            </div>
          )}

          {/* 场景对象列表 */}
          <div className="sec">
            <div className="sec-title">场景对象（{placedObjects.length}）</div>
            <div style={{ maxHeight: 200, overflow: 'auto', marginTop: 8 }}>
              {placedObjects.map((o) => (
                <div key={o.id} className={'card' + (o.id === selectedId ? ' sel' : '')}
                  style={{ padding: '6px 8px', marginBottom: 4, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8 }}
                  onClick={() => setSelectedId(o.id)}>
                  <div style={{ width: 12, height: 12, borderRadius: 3, background: o.color }} />
                  <span style={{ fontSize: 12, color: '#cfd9e6' }}>{o.name}</span>
                  {(keyframes[o.id]?.length ?? 0) > 0 && <Tag>{keyframes[o.id].length}帧</Tag>}
                </div>
              ))}
              {placedObjects.length === 0 && <div className="muted2">暂无对象</div>}
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
            <InputNumber size="small" min={1} max={60} value={duration} style={{ width: 64 }}
              onChange={(v) => setDuration(Math.max(1, v ?? 1))} />
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
            const t = Math.max(0, Math.min(duration, (x / TL_WIDTH) * duration))
            scrub(t)
          }}>
          {/* 时间刻度 */}
          {Array.from({ length: duration + 1 }).map((_, i) => {
            const x = (i / duration) * TL_WIDTH
            return (
              <g key={i}>
                <line x1={x} y1={0} x2={x} y2={RULER_H} stroke="#2a3340" strokeWidth={1} />
                <text x={x + 3} y={14} fill="#6b7d8f" fontSize={10}>{i}s</text>
              </g>
            )
          })}
          {/* 对象轨道 */}
          {objectsWithKfs.length === 0 ? (
            <text x={TL_WIDTH / 2 - 60} y={RULER_H + 30} fill="#6b7d8f" fontSize={12}>
              选中对象后点击「录制关键帧」添加轨迹
            </text>
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
                      <g key={i}>
                        <polygon
                          points={`${kx-5},${y+10} ${kx},${y+4} ${kx+5},${y+10} ${kx},${y+16}`}
                          fill={o.color}
                          stroke="#0a0e1a"
                          strokeWidth={0.5}
                          style={{ cursor: 'pointer' }}
                        />
                      </g>
                    )
                  })}
                </g>
              )
            })
          )}
          {/* 播放头 */}
          <line
            x1={(currentTime / duration) * TL_WIDTH} y1={0}
            x2={(currentTime / duration) * TL_WIDTH} y2={Math.max(tlContentH, TL_HEIGHT)}
            stroke="#ef4444" strokeWidth={1.5}
          />
          <polygon
            points={`${(currentTime / duration) * TL_WIDTH - 5},0 ${(currentTime / duration) * TL_WIDTH + 5},0 ${(currentTime / duration) * TL_WIDTH},8`}
            fill="#ef4444"
          />
        </svg>
      </div>
    </div>
  )
}
