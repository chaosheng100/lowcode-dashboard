import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import type {
  TwinScene,
  TwinEntity,
  TwinEntityState,
  TwinEntityMaterial,
  TwinAnnotation,
  HighlightLevel,
  GeoType
} from './twinTypes'
import { STATE_COLORS } from './twinTypes'

// ============================================================
// TwinRenderer：数字孪生三维渲染内核（Three.js 封装）
// - 输入 TwinScene（实体集合 + 环境），输出 3D 画面
// - 暴露联动所需接口：focusEntity / highlightEntity / setEntityState / setEntityMetrics / setClickHandler
// - 不依赖 React/DOM 之外的业务状态，可被 TwinWidget（嵌入大屏）与 TwinPage（编辑页）共用
// ============================================================

export interface TwinRendererOptions {
  lighting?: 'day' | 'night'
  fog?: boolean
  autoRotate?: boolean
}

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

/** 深拷贝 GLTF 场景并克隆材质，保证同一资产可被多个实体独立着色 */
function cloneGltfScene(src: THREE.Object3D): THREE.Group {
  const group = src.clone(true) as THREE.Group
  group.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    mesh.material = mats.map((m) => m.clone())
  })
  return group
}

function collectMaterials(obj: THREE.Object3D): THREE.Material[] {
  const mats: THREE.Material[] = []
  obj.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    const list = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    for (const m of list) if (!mats.includes(m)) mats.push(m)
  })
  return mats
}

/** 生成实体名称文字精灵（Sprite，billboard 始终朝向相机） */
function makeLabel(text: string): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 64
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = 'rgba(8,13,22,0.72)'
  ctx.fillRect(0, 0, 256, 64)
  ctx.strokeStyle = 'rgba(34,211,238,0.6)'
  ctx.lineWidth = 2
  ctx.strokeRect(1, 1, 254, 62)
  ctx.font = '28px "Microsoft YaHei", sans-serif'
  ctx.fillStyle = '#cfe3ff'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 12, 34)
  const tex = new THREE.CanvasTexture(canvas)
  tex.minFilter = THREE.LinearFilter
  const mat = new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true })
  const sp = new THREE.Sprite(mat)
  sp.scale.set(2.6, 0.65, 1)
  sp.renderOrder = 999
  return sp
}

export class TwinRenderer {
  private mount: HTMLElement
  private scene: THREE.Scene
  private camera: THREE.PerspectiveCamera
  private renderer: THREE.WebGLRenderer
  private controls: OrbitControls
  private raycaster = new THREE.Raycaster()
  private pointer = new THREE.Vector2()

  private ground!: THREE.Mesh
  private ambientLight!: THREE.AmbientLight
  private dirLight!: THREE.DirectionalLight
  private entityMeshes = new Map<string, THREE.Object3D>()
  private entityMats = new Map<string, THREE.Material[]>()
  /** 渲染器自建的几何体（内置体/占位体），外部 GLTF 几何体由资产缓存共享，不在此处 */
  private entityGeos = new Map<string, THREE.BufferGeometry>()
  private assetEntities = new Set<string>()
  /** 资产加载缓存：同一 URL 只解析一次，多个实体克隆复用 */
  private assetCache = new Map<string, Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>>()
  private entityClips = new Map<string, THREE.AnimationClip[]>()
  private animationMixers = new Map<string, THREE.AnimationMixer>()
  private labelSprites = new Map<string, THREE.Sprite>()
  private entityStates = new Map<string, TwinEntityState>()
  private annotations = new Map<string, { group: THREE.Group; line: THREE.Line; d1: THREE.Mesh; d2: THREE.Mesh; label: THREE.Sprite }>()
  private annotationLayer = new THREE.Group()
  /** 当前实体快照（供编辑页 TwinPage 读取/操作，与渲染网格保持同步） */
  private entities: TwinEntity[] = []
  private highlight: THREE.LineSegments | null = null

  private lighting: 'day' | 'night'
  private fog: boolean
  private autoRotate: boolean
  private labelsVisible = true

  private clickHandler: ((id: string) => void) | null = null
  private downPos = { x: 0, y: 0, t: 0 }
  private raf = 0
  private disposed = false
  private lastAnimTime = performance.now()

  // 相机聚焦目标（anim 中平滑插值）
  private camGoal: THREE.Vector3 | null = null
  private targetGoal: THREE.Vector3 | null = null
  private defaultCam: THREE.Vector3

  constructor(mount: HTMLElement, sceneData: TwinScene, opts: TwinRendererOptions = {}) {
    this.mount = mount
    this.lighting = opts.lighting ?? sceneData.env.lighting ?? 'day'
    this.fog = opts.fog ?? sceneData.env.fog ?? false
    this.autoRotate = opts.autoRotate ?? false

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(this.lighting === 'day' ? '#0a1422' : '#05080f')
    if (this.fog) this.scene.fog = new THREE.FogExp2(this.lighting === 'day' ? '#0a1422' : '#05080f', 0.035)

    const w = mount.clientWidth || 480
    const h = mount.clientHeight || 360
    this.camera = new THREE.PerspectiveCamera(50, w / h, 0.1, 200)
    const cam = sceneData.camera ?? { x: 8, y: 7, z: 10 }
    this.camera.position.set(cam.x, cam.y, cam.z)
    this.defaultCam = this.camera.position.clone()

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(w, h)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    mount.appendChild(this.renderer.domElement)

    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.mouseButtons = { LEFT: THREE.MOUSE.ROTATE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.PAN }
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.08
    this.controls.maxPolarAngle = Math.PI / 2 - 0.05
    this.controls.target.set(0, 0.5, 0)

    // 光照
    this.ambientLight = new THREE.AmbientLight(0xffffff, this.lighting === 'day' ? 0.85 : 0.2)
    this.scene.add(this.ambientLight)
    this.dirLight = new THREE.DirectionalLight(this.lighting === 'day' ? 0xfff2cc : 0x4466ff, this.lighting === 'day' ? 1.0 : 0.5)
    this.dirLight.position.set(5, 8, 5)
    this.scene.add(this.dirLight)

    // 地面 + 网格
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: 0x0d1a2b, roughness: 1, metalness: 0.1 })
    )
    this.ground.rotation.x = -Math.PI / 2
    this.ground.name = 'ground'
    this.scene.add(this.ground)
    this.scene.add(new THREE.GridHelper(40, 40, 0x1a3050, 0x122038))
    this.scene.add(this.annotationLayer)

    this.setEntities(sceneData)

    const dom = this.renderer.domElement
    dom.addEventListener('pointerdown', this.onPointerDown)
    dom.addEventListener('pointerup', this.onPointerUp)

    this.animate()
  }

  /** 重建实体网格（场景变化或首次构建时调用） */
  setEntities(sceneData: TwinScene): void {
    for (const id of Array.from(this.entityMeshes.keys())) this.disposeEntityObject(id)
    for (const [, sp] of this.labelSprites) {
      this.scene.remove(sp)
      const m = sp.material as THREE.SpriteMaterial
      m.map?.dispose()
      m.dispose()
    }
    this.labelSprites.clear()
    if (this.highlight) { this.scene.remove(this.highlight); this.highlight = null }
    this.entities = []
    for (const e of sceneData.entities) this.addEntity(e)
    this.setAnnotations(sceneData.annotations ?? [])
  }

  setAnnotations(list: TwinAnnotation[]): void {
    for (const id of Array.from(this.annotations.keys())) this.removeAnnotation(id)
    for (const a of list) this.addAnnotation(a)
  }

  addAnnotation(a: TwinAnnotation): void {
    if (this.annotations.has(a.id)) return
    const y = 0.06
    const color = a.color ?? '#4ade80'
    const p1 = new THREE.Vector3(a.start.x, y, a.start.z)
    const p2 = new THREE.Vector3(a.end.x, y, a.end.z)
    const line = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([p1, p2]),
      new THREE.LineBasicMaterial({ color })
    )
    const dotMat = new THREE.MeshBasicMaterial({ color })
    const d1 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), dotMat)
    d1.position.copy(p1)
    const d2 = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), dotMat.clone())
    d2.position.copy(p2)
    const dist = Math.hypot(a.end.x - a.start.x, a.end.z - a.start.z)
    const label = makeLabel(`${a.name} ${dist.toFixed(1)}m`)
    label.position.set((a.start.x + a.end.x) / 2, y + 0.8, (a.start.z + a.end.z) / 2)
    const group = new THREE.Group()
    group.add(line, d1, d2, label)
    this.annotationLayer.add(group)
    this.annotations.set(a.id, { group, line, d1, d2, label })
  }

  removeAnnotation(id: string): void {
    const a = this.annotations.get(id)
    if (!a) return
    this.annotationLayer.remove(a.group)
    a.line.geometry.dispose()
    ;(a.line.material as THREE.Material).dispose()
    a.d1.geometry.dispose()
    ;(a.d1.material as THREE.Material).dispose()
    a.d2.geometry.dispose()
    ;(a.d2.material as THREE.Material).dispose()
    const lm = a.label.material as THREE.SpriteMaterial
    lm.map?.dispose()
    lm.dispose()
    this.annotations.delete(id)
  }

  // ---- 编辑器复用接口（TwinPage 拖拽/属性/关键帧操作实体） ----
  addEntity(e: TwinEntity): void {
    if (this.entityMeshes.has(e.id)) return
    const obj = e.assetUrl ? this.makePlaceholder(e) : this.makeBuiltin(e)
    obj.userData.entityId = e.id
    this.scene.add(obj)
    this.entityMeshes.set(e.id, obj)
    this.entityStates.set(e.id, e.state)
    this.applyStateColor(e.id, e.state)
    const label = makeLabel(e.name)
    label.position.set(e.x, e.y + 1.4, e.z)
    label.visible = this.labelsVisible
    this.scene.add(label)
    this.labelSprites.set(e.id, label)
    if (e.assetUrl) this.attachAsset(e, obj)
    this.entities.push({ ...e })
    if (e.visible === false) {
      obj.visible = false
      label.visible = false
    }
    if (e.material) this.setEntityMaterial(e.id, e.material)
  }

  removeEntity(id: string): void {
    this.disposeEntityObject(id)
    const sp = this.labelSprites.get(id)
    if (sp) {
      this.scene.remove(sp)
      const m = sp.material as THREE.SpriteMaterial
      m.map?.dispose()
      m.dispose()
      this.labelSprites.delete(id)
    }
    this.entities = this.entities.filter((e) => e.id !== id)
  }

  /** 创建内置几何体对象（几何体/材质由渲染器持有，可安全释放） */
  private makeBuiltin(e: TwinEntity): THREE.Mesh {
    const geo = createGeometry(e.geoType, e.scale ?? 1)
    const mat = new THREE.MeshStandardMaterial({ color: e.color, metalness: 0.3, roughness: 0.6 })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(e.x, e.y, e.z)
    mesh.rotation.y = e.rotationY ?? 0
    this.entityGeos.set(e.id, geo)
    this.entityMats.set(e.id, [mat])
    return mesh
  }

  /** 外部模型加载期间的占位体（加载失败时保留并标红提示） */
  private makePlaceholder(e: TwinEntity): THREE.Mesh {
    const geo = new THREE.BoxGeometry(1.1, 1.2, 1.1)
    const mat = new THREE.MeshStandardMaterial({
      color: '#1d4ed8',
      transparent: true,
      opacity: 0.55,
      wireframe: true
    })
    const mesh = new THREE.Mesh(geo, mat)
    mesh.position.set(e.x, e.y, e.z)
    mesh.rotation.y = e.rotationY ?? 0
    mesh.scale.setScalar(e.scale ?? 1)
    this.entityGeos.set(e.id, geo)
    this.entityMats.set(e.id, [mat])
    return mesh
  }

  /** 异步加载外部模型并替换占位体；同一 URL 复用缓存 */
  private attachAsset(e: TwinEntity, placeholder: THREE.Object3D): void {
    const url = e.assetUrl!
    let load = this.assetCache.get(url)
    if (!load) {
      load = new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) => {
        new GLTFLoader().load(
          url,
          (gltf) => resolve({ scene: gltf.scene, animations: gltf.animations ?? [] }),
          undefined,
          (err) => reject(err)
        )
      })
      this.assetCache.set(url, load)
    }
    load
      .then((src) => {
        if (this.disposed || !this.entityMeshes.has(e.id)) return
        const group = cloneGltfScene(src.scene)
        group.position.copy(placeholder.position)
        group.rotation.copy(placeholder.rotation)
        group.scale.copy(placeholder.scale)
        group.userData.entityId = e.id
        this.scene.remove(placeholder)
        const geo = this.entityGeos.get(e.id)
        if (geo) geo.dispose()
        this.entityMats.get(e.id)?.forEach((m) => m.dispose())
        this.entityGeos.delete(e.id)
        this.scene.add(group)
        this.entityMeshes.set(e.id, group)
        this.entityMats.set(e.id, collectMaterials(group))
        this.assetEntities.add(e.id)
        this.applyStateColor(e.id, this.entityStates.get(e.id) ?? e.state)
        group.visible = placeholder.visible !== false
        const sp = this.labelSprites.get(e.id)
        if (sp) sp.visible = this.labelsVisible && placeholder.visible !== false
        const ent = this.entities.find((x) => x.id === e.id)
        if (ent?.material) this.setEntityMaterial(e.id, ent.material)
        if (src.animations.length) {
          this.entityClips.set(e.id, src.animations.map((c) => c.clone()))
          if (e.animation) this.playAnimation(e.id, e.animation)
        }
      })
      .catch(() => {
        if (this.disposed || !this.entityMeshes.has(e.id)) return
        this.entityMats.get(e.id)?.forEach((m) => {
          const std = m as THREE.MeshStandardMaterial
          if (std && 'color' in std && std.color) std.color.set('#ef4444')
        })
      })
  }

  getAnimationClips(id: string): string[] {
    return (this.entityClips.get(id) ?? []).map((c) => c.name || 'clip')
  }

  playAnimation(id: string, clipName: string | null): void {
    const obj = this.entityMeshes.get(id)
    if (!obj) return
    this.stopAnimation(id)
    if (!clipName) {
      const ent = this.entities.find((e) => e.id === id)
      if (ent) ent.animation = undefined
      return
    }
    const clip = (this.entityClips.get(id) ?? []).find((c) => c.name === clipName)
    if (!clip) return
    const mixer = new THREE.AnimationMixer(obj)
    mixer.clipAction(clip).reset().play()
    this.animationMixers.set(id, mixer)
    const ent = this.entities.find((e) => e.id === id)
    if (ent) ent.animation = clipName
  }

  stopAnimation(id: string): void {
    const mixer = this.animationMixers.get(id)
    if (mixer) {
      mixer.stopAllAction()
      this.animationMixers.delete(id)
    }
  }

  /** 移除实体对象并释放渲染器自有的几何体/材质 */
  private disposeEntityObject(id: string): void {
    this.stopAnimation(id)
    this.entityClips.delete(id)
    const obj = this.entityMeshes.get(id)
    if (obj) this.scene.remove(obj)
    const geo = this.entityGeos.get(id)
    if (geo) geo.dispose()
    this.entityMats.get(id)?.forEach((m) => m.dispose())
    this.entityMeshes.delete(id)
    this.entityMats.delete(id)
    this.entityGeos.delete(id)
    this.entityStates.delete(id)
    this.assetEntities.delete(id)
  }

  /** 命中 GLTF 子网格时向上回溯找到实体根节点 id */
  private entityIdOf(obj: THREE.Object3D): string | null {
    let cur: THREE.Object3D | null = obj
    while (cur) {
      const id = cur.userData.entityId as string | undefined
      if (id) return id
      cur = cur.parent
    }
    return null
  }

  updateEntityTransform(id: string, t: { x?: number; y?: number; z?: number; rotationY?: number; scale?: number }): void {
    const mesh = this.entityMeshes.get(id)
    if (!mesh) return
    if (t.x !== undefined) mesh.position.x = t.x
    if (t.y !== undefined) mesh.position.y = t.y
    if (t.z !== undefined) mesh.position.z = t.z
    if (t.rotationY !== undefined) mesh.rotation.y = t.rotationY
    if (t.scale !== undefined) mesh.scale.setScalar(t.scale)
    const label = this.labelSprites.get(id)
    if (label) label.position.set(mesh.position.x, mesh.position.y + 1.4, mesh.position.z)
    const ent = this.entities.find((e) => e.id === id)
    if (ent) Object.assign(ent, t)
  }

  setEntityColor(id: string, color: string): void {
    this.entityMats.get(id)?.forEach((m) => {
      const std = m as THREE.MeshStandardMaterial
      if (std && 'color' in std && std.color) std.color.set(color)
    })
    const ent = this.entities.find((e) => e.id === id)
    if (ent) ent.color = color
  }

  setEntityVisible(id: string, visible: boolean): void {
    const obj = this.entityMeshes.get(id)
    if (obj) obj.visible = visible
    const sp = this.labelSprites.get(id)
    if (sp) sp.visible = this.labelsVisible && visible
    const ent = this.entities.find((e) => e.id === id)
    if (ent) ent.visible = visible
  }

  setEntityMaterial(id: string, patch: TwinEntityMaterial): void {
    for (const m of this.entityMats.get(id) ?? []) {
      const std = m as THREE.MeshStandardMaterial
      if (!std || !('color' in std)) continue
      if (patch.metalness !== undefined) std.metalness = patch.metalness
      if (patch.roughness !== undefined) std.roughness = patch.roughness
      if (patch.opacity !== undefined) {
        std.transparent = patch.opacity < 1
        std.opacity = patch.opacity
      }
      if (patch.emissive !== undefined) std.emissive?.set(patch.emissive)
      if (patch.emissiveIntensity !== undefined) std.emissiveIntensity = patch.emissiveIntensity
    }
    const ent = this.entities.find((e) => e.id === id)
    if (ent) ent.material = { ...(ent.material || {}), ...patch }
  }

  getEntities(): TwinEntity[] {
    return this.entities.map((e) => ({ ...e }))
  }

  getEntityTransform(id: string): { x: number; y: number; z: number; rotationY: number } | null {
    const mesh = this.entityMeshes.get(id)
    if (!mesh) return null
    return { x: mesh.position.x, y: mesh.position.y, z: mesh.position.z, rotationY: mesh.rotation.y }
  }

  // ---- 编辑态交互辅助（供 TwinPage 拖拽/选中操作，相机/射线归内核管理） ----
  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement
  }

  setControlsEnabled(b: boolean): void {
    this.controls.enabled = b
  }

  /** 屏幕坐标拾取实体，返回 entityId 或 null */
  pickEntityAt(clientX: number, clientY: number): string | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const objects = Array.from(this.entityMeshes.values()).filter((o) => o.visible !== false)
    const hits = this.raycaster.intersectObjects(objects)
    return hits[0] ? this.entityIdOf(hits[0].object) : null
  }

  /** 屏幕坐标投射到地面，返回 {x,z} 世界坐标 */
  groundPointAt(clientX: number, clientY: number): { x: number; z: number } | null {
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const hits = this.raycaster.intersectObject(this.ground)
    return hits[0] ? { x: hits[0].point.x, z: hits[0].point.z } : null
  }

  private applyStateColor(id: string, state: TwinEntityState): void {
    const mats = this.entityMats.get(id)
    if (!mats?.length) return
    const isAsset = this.assetEntities.has(id)
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial
      if (!isAsset && std && 'color' in std && std.color) std.color.set(STATE_COLORS[state])
      if (state === 'fault') { std.emissive?.set('#ef4444'); std.emissiveIntensity = 0.5 }
      else if (state === 'running') { std.emissive?.set('#0e7490'); std.emissiveIntensity = 0.25 }
      else { std.emissive?.set('#000000'); std.emissiveIntensity = 0 }
    }
  }

  // ---- 联动接口 ----
  setEntityState(id: string, state: TwinEntityState): void {
    this.entityStates.set(id, state)
    this.applyStateColor(id, state)
  }

  setEntityMetrics(_id: string, _metrics: { temperature?: number; health?: number; load?: number }): void {
    // 颜色/状态由 setEntityState 驱动；指标主要用于 HUD 与仿真，这里预留钩子
  }

  setClickHandler(cb: (id: string) => void): void {
    this.clickHandler = cb
  }

  highlightEntity(id: string | null, level: HighlightLevel = 'select'): void {
    if (this.highlight) {
      this.scene.remove(this.highlight)
      this.highlight.geometry.dispose()
      ;(this.highlight.material as THREE.Material).dispose()
      this.highlight = null
    }
    if (!id) return
    const obj = this.entityMeshes.get(id)
    if (!obj) return
    const box = new THREE.Box3().setFromObject(obj)
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const edges = new THREE.EdgesGeometry(
      new THREE.BoxGeometry(Math.max(size.x, 0.01), Math.max(size.y, 0.01), Math.max(size.z, 0.01))
    )
    const color = level === 'warn' ? 0xf59e0b : 0x4ade80
    const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color, linewidth: 2 }))
    line.position.copy(center)
    this.scene.add(line)
    this.highlight = line
  }

  focusEntity(id: string | null): void {
    if (!id) {
      this.camGoal = this.defaultCam.clone()
      this.targetGoal = new THREE.Vector3(0, 0.5, 0)
      return
    }
    const mesh = this.entityMeshes.get(id)
    if (!mesh) return
    const p = mesh.position
    this.targetGoal = new THREE.Vector3(p.x, p.y, p.z)
    this.camGoal = new THREE.Vector3(p.x + 5, p.y + 4, p.z + 5)
  }

  setLighting(l: 'day' | 'night'): void {
    this.lighting = l
    this.scene.background = new THREE.Color(l === 'day' ? '#0a1422' : '#05080f')
    if (this.fog) this.scene.fog = new THREE.FogExp2(l === 'day' ? '#0a1422' : '#05080f', 0.035)
    this.ambientLight.intensity = l === 'day' ? 0.85 : 0.2
    this.dirLight.color.set(l === 'day' ? 0xfff2cc : 0x4466ff)
    this.dirLight.intensity = l === 'day' ? 1.0 : 0.5
  }

  setFog(b: boolean): void {
    this.fog = b
    this.scene.fog = b ? new THREE.FogExp2(this.lighting === 'day' ? '#0a1422' : '#05080f', 0.035) : null
  }

  setAutoRotate(b: boolean): void {
    this.autoRotate = b
  }

  setLabelVisible(b: boolean): void {
    this.labelsVisible = b
    for (const [, sp] of this.labelSprites) sp.visible = b
  }

  resize(): void {
    const w = this.mount.clientWidth
    const h = this.mount.clientHeight
    if (!w || !h) return
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(w, h)
  }

  private onPointerDown = (ev: PointerEvent) => {
    this.downPos = { x: ev.clientX, y: ev.clientY, t: performance.now() }
  }

  private onPointerUp = (ev: PointerEvent) => {
    if (ev.button !== 0) return
    const dx = ev.clientX - this.downPos.x
    const dy = ev.clientY - this.downPos.y
    const dist = Math.hypot(dx, dy)
    const dt = performance.now() - this.downPos.t
    if (dist > 6 || dt > 350) return // 视为拖拽/旋转，非点击
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
    this.pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
    this.raycaster.setFromCamera(this.pointer, this.camera)
    const meshes = Array.from(this.entityMeshes.values())
    const hits = this.raycaster.intersectObjects(meshes)
    if (hits[0]) {
      const id = this.entityIdOf(hits[0].object)
      if (id) this.clickHandler?.(id)
    }
  }

  private animate = () => {
    if (this.disposed) return
    this.raf = requestAnimationFrame(this.animate)
    this.controls.update()
    const now = performance.now()
    const dt = Math.min((now - this.lastAnimTime) / 1000, 0.1)
    this.lastAnimTime = now
    for (const [, mixer] of this.animationMixers) mixer.update(dt)

    // 自动旋转
    if (this.autoRotate) {
      const t = performance.now() * 0.0002
      const r = 12
      this.camera.position.x = Math.cos(t) * r
      this.camera.position.z = Math.sin(t) * r
      this.camera.lookAt(this.controls.target)
    }

    // 相机聚焦平滑插值
    if (this.camGoal && this.targetGoal) {
      this.camera.position.lerp(this.camGoal, 0.08)
      this.controls.target.lerp(this.targetGoal, 0.08)
      if (this.camera.position.distanceTo(this.camGoal) < 0.15) {
        this.camGoal = null
        this.targetGoal = null
      }
    }

    // 故障实体呼吸光
    const t = performance.now() * 0.006
    for (const [id, mats] of this.entityMats) {
      if (this.entityStates.get(id) !== 'fault') continue
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial
        if (!std || !('emissiveIntensity' in std)) continue
        std.emissiveIntensity = 0.35 + 0.35 * Math.abs(Math.sin(t))
      }
    }

    this.renderer.render(this.scene, this.camera)
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    const dom = this.renderer.domElement
    dom.removeEventListener('pointerdown', this.onPointerDown)
    dom.removeEventListener('pointerup', this.onPointerUp)
    this.controls.dispose()
    for (const id of Array.from(this.entityMeshes.keys())) this.disposeEntityObject(id)
    for (const [, sp] of this.labelSprites) {
      const m = sp.material as THREE.SpriteMaterial
      m.map?.dispose()
      m.dispose()
    }
    for (const id of Array.from(this.annotations.keys())) this.removeAnnotation(id)
    this.scene.remove(this.annotationLayer)
    // 释放资产缓存源几何体/材质（克隆实体的几何体与其共享）
    for (const [, p] of this.assetCache) {
      p.then((src) => {
        src.scene.traverse((o) => {
          const mesh = o as THREE.Mesh
          if (!mesh.isMesh) return
          mesh.geometry?.dispose()
          const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
          mats.forEach((m) => m.dispose())
        })
      }).catch(() => undefined)
    }
    this.assetCache.clear()
    this.renderer.dispose()
    if (dom.parentNode === this.mount) this.mount.removeChild(dom)
  }
}
