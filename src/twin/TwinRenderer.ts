import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { DRACOLoader } from 'three/examples/jsm/loaders/DRACOLoader.js'
import { clone as cloneSkeleton } from 'three/examples/jsm/utils/SkeletonUtils.js'
import { TilesRenderer } from '3d-tiles-renderer'
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
  /** 外部 GLB 加载完成并替换占位体后，自动将相机对准该模型包围盒（编辑器拖入模型场景使用） */
  frameOnAssetLoad?: boolean
  /** 外部模型加载完成并完成首次尺寸归一化后回调（编辑器同步实体缩放） */
  onAssetLoaded?: (id: string, info: { baseScale: number }) => void
}

/** 拖入模型的最长边限定尺寸（世界单位），首次拖入时按此归一化 */
const MAX_ASSET_SIZE = 2.5

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

/** 深拷贝 GLTF 场景并克隆材质，保证同一资产可被多个实体独立着色。
 *  注意：WebGLRenderer 对「材质数组」只会按 geometry.groups 逐组渲染，
 *  而 GLTF 单材质网格没有 groups，若把单个材质包成数组会导致模型不可见，
 *  因此仅当材质本身是数组时才映射克隆，单个材质直接 clone() 保持非数组。 */
function cloneGltfScene(src: THREE.Object3D): THREE.Group {
  const group = cloneSkeleton(src) as THREE.Group
  group.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (!mesh.isMesh) return
    if (Array.isArray(mesh.material)) {
      mesh.material = mesh.material.map((m) => m.clone())
    } else {
      mesh.material = mesh.material.clone()
    }
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

/** 深拷贝外部模型场景；SimplifyModifier 自动 LOD 会令几何体过度简化为空导致模型无法显示，故直接使用原始精度 */
function buildAssetLod(src: THREE.Group): THREE.Group {
  return cloneGltfScene(src)
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
  private dracoLoader: DRACOLoader | null = null
  private entityClips = new Map<string, THREE.AnimationClip[]>()
  private animationMixers = new Map<string, THREE.AnimationMixer>()
  private labelSprites = new Map<string, THREE.Sprite>()
  private entityStates = new Map<string, TwinEntityState>()
  private annotations = new Map<string, { group: THREE.Group; line: THREE.Line; d1: THREE.Mesh; d2: THREE.Mesh; label: THREE.Sprite }>()
  private annotationLayer = new THREE.Group()
  private gisLayer: THREE.Group | null = null
  private tiles: TilesRenderer | null = null
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
  private frameOnAssetLoad = false
  private onAssetLoaded: ((id: string, info: { baseScale: number }) => void) | null = null
  /** 待取景模型队列：等渲染帧跑过（骨骼矩阵就绪）后再计算包围盒 */
  private frameQueue: { obj: THREE.Object3D; ticks: number }[] = []

  constructor(mount: HTMLElement, sceneData: TwinScene, opts: TwinRendererOptions = {}) {
    this.mount = mount
    this.lighting = opts.lighting ?? sceneData.env.lighting ?? 'day'
    this.fog = opts.fog ?? sceneData.env.fog ?? false
    this.autoRotate = opts.autoRotate ?? false
    this.frameOnAssetLoad = opts.frameOnAssetLoad ?? false
    this.onAssetLoaded = opts.onAssetLoaded ?? null

    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(this.lighting === 'day' ? '#1b2a45' : '#01040a')
    if (this.fog) this.scene.fog = new THREE.FogExp2(this.lighting === 'day' ? '#1b2a45' : '#01040a', 0.035)

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
    this.ambientLight = new THREE.AmbientLight(0xffffff, this.lighting === 'day' ? 1.15 : 0.12)
    this.scene.add(this.ambientLight)
    this.dirLight = new THREE.DirectionalLight(this.lighting === 'day' ? 0xfff2c2 : 0x2f4fd0, this.lighting === 'day' ? 1.7 : 0.4)
    this.dirLight.position.set(5, 8, 5)
    this.scene.add(this.dirLight)

    // 地面 + 网格
    this.ground = new THREE.Mesh(
      new THREE.PlaneGeometry(40, 40),
      new THREE.MeshStandardMaterial({ color: this.lighting === 'day' ? 0x14263e : 0x060d18, roughness: 1, metalness: 0.1 })
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

  /** 切换 GIS 融合叠加层（坐标环/十字/指北/中心标注），center 为 [lat, lng] */
  setGis(gis?: { center?: [number, number]; zoom?: number }): void {
    if (this.gisLayer) {
      this.scene.remove(this.gisLayer)
      this.gisLayer.traverse((o) => {
        const anyObj = o as unknown as { geometry?: THREE.BufferGeometry; material?: THREE.Material; map?: THREE.Texture }
        if (anyObj.geometry) anyObj.geometry.dispose()
        if (anyObj.material) anyObj.material.dispose()
        const spriteMat = o as unknown as { material?: THREE.SpriteMaterial }
        if (spriteMat.material?.map) spriteMat.material.map.dispose()
      })
      this.gisLayer = null
    }
    if (!gis?.center) return
    const [lat, lng] = gis.center
    const radius = 60 + (gis.zoom ?? 12) * 8
    const group = new THREE.Group()
    const circlePts: THREE.Vector3[] = []
    for (let i = 0; i <= 64; i++) {
      const a = (i / 64) * Math.PI * 2
      circlePts.push(new THREE.Vector3(Math.cos(a) * radius, 0.02, Math.sin(a) * radius))
    }
    const ring = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(circlePts),
      new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.45 })
    )
    const crossMat = new THREE.LineBasicMaterial({ color: 0x22d3ee, transparent: true, opacity: 0.25 })
    const hLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-radius, 0.02, 0), new THREE.Vector3(radius, 0.02, 0)]),
      crossMat
    )
    const vLine = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0.02, -radius), new THREE.Vector3(0, 0.02, radius)]),
      crossMat
    )
    const north = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(0, 0.04, radius * 0.55),
        new THREE.Vector3(0, 0.04, radius * 1.25)
      ]),
      new THREE.LineBasicMaterial({ color: 0x4ade80 })
    )
    const centerLabel = makeLabel(`${lat.toFixed(4)}, ${lng.toFixed(4)}`)
    centerLabel.position.set(0, 1.2, 0)
    group.add(ring, hLine, vLine, north, centerLabel)
    this.scene.add(group)
    this.gisLayer = group
  }

  /** 接入倾斜摄影 3D Tiles：按 tileset.json 地址加载并随相机调度 */
  setTileset(url?: string): void {
    if (this.tiles) {
      this.scene.remove(this.tiles.group)
      this.tiles.dispose()
      this.tiles = null
    }
    if (!url) return
    try {
      const tiles = new TilesRenderer(url)
      this.scene.add(tiles.group)
      tiles.setCamera(this.camera)
      tiles.setResolutionFromRenderer(this.camera, this.renderer)
      this.tiles = tiles
    } catch {
      /* tileset 初始化失败时静默跳过 */
    }
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

  private getDracoLoader(): DRACOLoader | null {
    if (!this.dracoLoader) {
      try {
        const dl = new DRACOLoader()
        dl.setDecoderPath('/draco/')
        this.dracoLoader = dl
      } catch {
        return null
      }
    }
    return this.dracoLoader
  }

  /** 异步加载外部模型并替换占位体；同一 URL 复用缓存 */
  private attachAsset(e: TwinEntity, placeholder: THREE.Object3D): void {
    const url = e.assetUrl!
    let load = this.assetCache.get(url)
    if (!load) {
      load = new Promise<{ scene: THREE.Group; animations: THREE.AnimationClip[] }>((resolve, reject) => {
        const loader = new GLTFLoader()
        const draco = this.getDracoLoader()
        if (draco) loader.setDRACOLoader(draco)
        loader.load(
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
        const group = buildAssetLod(src.scene)
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
        let fitScale = 1
        if (e.fitOnLoad) {
          const box = new THREE.Box3().setFromObject(group)
          if (!box.isEmpty()) {
            const size = box.getSize(new THREE.Vector3())
            const maxDim = Math.max(size.x, size.y, size.z, 0.0001)
            fitScale = MAX_ASSET_SIZE / maxDim
            group.scale.multiplyScalar(fitScale)
            const ent = this.entities.find((x) => x.id === e.id)
            if (ent) {
              ent.scale = (ent.scale ?? 1) * fitScale
              ent.fitOnLoad = false
            }
            this.onAssetLoaded?.(e.id, { baseScale: fitScale })
          }
        }
        this.applyStateColor(e.id, this.entityStates.get(e.id) ?? e.state)
        group.visible = placeholder.visible !== false
        const sp = this.labelSprites.get(e.id)
        if (sp) sp.visible = this.labelsVisible && placeholder.visible !== false
        const ent = this.entities.find((x) => x.id === e.id)
        if (ent?.material) this.setEntityMaterial(e.id, ent.material)
        if (this.frameOnAssetLoad) this.frameQueue.push({ obj: group, ticks: 2 })
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
    const userGlow = this.userGlowOf(id)
    for (const m of mats) {
      const std = m as THREE.MeshStandardMaterial
      if (!isAsset && std && 'color' in std && std.color) std.color.set(STATE_COLORS[state])
      if (userGlow) {
        std.emissive?.set(userGlow.color)
        std.emissiveIntensity = userGlow.intensity
      } else if (state === 'fault') {
        std.emissive?.set('#ef4444')
        std.emissiveIntensity = 0.5
      } else if (state === 'running') {
        std.emissive?.set('#0e7490')
        std.emissiveIntensity = 0.25
      } else {
        std.emissive?.set('#000000')
        std.emissiveIntensity = 0
      }
    }
  }

  private userGlowOf(id: string): { color: string; intensity: number } | null {
    const m = this.entities.find((e) => e.id === id)?.material
    if (!m?.emissive || m.emissive.toLowerCase() === '#000000') return null
    const intensity = m.emissiveIntensity ?? 1
    return intensity > 0 ? { color: m.emissive, intensity } : null
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

  /** 将相机平滑对准目标对象的包围盒（等价于 demo 的自动取景）；须在对象入场景并渲染后再调用 */
  private frameToObject(obj: THREE.Object3D): void {
    const box = new THREE.Box3().setFromObject(obj)
    if (box.isEmpty()) return
    const center = box.getCenter(new THREE.Vector3())
    const size = box.getSize(new THREE.Vector3())
    const maxDim = Math.max(size.x, size.y, size.z, 0.01)
    const dist = (maxDim / 2 / Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2))) * 1.4
    this.targetGoal = center.clone()
    this.camGoal = center.clone().add(new THREE.Vector3(dist, dist * 0.7, dist))
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

  /** 视角预设：透视 / 顶视 / 前视 / 侧视 */
  setCameraView(view: 'perspective' | 'top' | 'front' | 'side'): void {
    const target = new THREE.Vector3(0, 0.5, 0)
    if (view === 'perspective') {
      this.camGoal = this.defaultCam.clone()
      this.targetGoal = target
      return
    }
    const positions: Record<'top' | 'front' | 'side', [number, number, number]> = {
      top: [0, 14, 0.01],
      front: [0, 4, 12],
      side: [12, 4, 0]
    }
    const p = positions[view]
    this.camGoal = new THREE.Vector3(p[0], p[1], p[2])
    this.targetGoal = target
  }

  /** 复位相机到默认视角 */
  resetCamera(): void {
    this.camGoal = this.defaultCam.clone()
    this.targetGoal = new THREE.Vector3(0, 0.5, 0)
  }

  /** 聚焦指定实体（按包围盒取景） */
  frameEntity(id: string): void {
    const mesh = this.entityMeshes.get(id)
    if (mesh) this.frameToObject(mesh)
  }

  setLighting(l: 'day' | 'night'): void {
    this.lighting = l
    this.scene.background = new THREE.Color(l === 'day' ? '#1b2a45' : '#01040a')
    if (this.fog) this.scene.fog = new THREE.FogExp2(l === 'day' ? '#1b2a45' : '#01040a', 0.035)
    this.ambientLight.intensity = l === 'day' ? 1.15 : 0.12
    this.dirLight.color.set(l === 'day' ? 0xfff2c2 : 0x2f4fd0)
    this.dirLight.intensity = l === 'day' ? 1.7 : 0.4
    ;(this.ground.material as THREE.MeshStandardMaterial).color.set(l === 'day' ? 0x14263e : 0x060d18)
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
    this.tiles?.update()
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
      if (this.entityStates.get(id) !== 'fault' || this.userGlowOf(id)) continue
      for (const m of mats) {
        const std = m as THREE.MeshStandardMaterial
        if (!std || !('emissiveIntensity' in std)) continue
        std.emissiveIntensity = 0.35 + 0.35 * Math.abs(Math.sin(t))
      }
    }

    this.renderer.render(this.scene, this.camera)

    // 资产加载完成延迟到渲染帧再取景：提前计算会在骨骼矩阵未就绪时得到错误的极小包围盒
    if (this.frameQueue.length) {
      const remaining: { obj: THREE.Object3D; ticks: number }[] = []
      for (const item of this.frameQueue) {
        item.ticks--
        if (item.ticks <= 0) this.frameToObject(item.obj)
        else remaining.push(item)
      }
      this.frameQueue = remaining
    }
  }

  dispose(): void {
    this.disposed = true
    cancelAnimationFrame(this.raf)
    this.frameQueue = []
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
    this.setGis(undefined)
    this.tiles?.dispose()
    this.tiles = null
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
    this.dracoLoader?.dispose()
    this.dracoLoader = null
    this.renderer.dispose()
    if (dom.parentNode === this.mount) this.mount.removeChild(dom)
  }
}
