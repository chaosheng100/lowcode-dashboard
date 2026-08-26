// Digital-twin model and scene contracts.
// ---------------- 数字孪生 3D：模型库 + 场景 ----------------
export type TwinCategory = '建筑' | '设备' | '交通' | '自然' | '人物' | '其他'
export type TwinModelStatus = 'draft' | 'active' | 'inactive'
export interface TwinModelVersion {
  version: number
  assetUrl: string
  format: string
  fileSize: number
  uploadedAt: string
}
export interface TwinModelDTO {
  id: string
  name: string
  category: TwinCategory
  builtin: boolean // 预置 91 种 / 用户上传
  thumbnail: string
  /** 自定义标签（模型库搜索/分类用） */
  tags?: string[]
  /** 外部模型文件地址（上传的 GLB/GLTF），空串表示内置几何体 */
  assetUrl?: string
  /** 文件格式：glb / gltf / bin */
  format?: string
  /** 文件大小（字节） */
  fileSize?: number
  uploadedAt?: string
  /** 审核状态：草稿 / 已上架 / 已下架 */
  status?: TwinModelStatus
  /** 当前版本号，重复上传会递增 */
  version?: number
  /** 历史版本（含当前版本之前的记录） */
  versions?: TwinModelVersion[]
  /** 是否进入共享模型市场 */
  market?: boolean
}
export type TwinGeometryType = 'box' | 'cylinder' | 'sphere' | 'cone' | 'torus' | 'plane'
export interface TwinSceneModel {
  id: string
  modelId: string
  name: string
  geoType: TwinGeometryType
  color: string
  /** 外部模型资源地址；缺省时按 geoType 渲染内置几何体 */
  assetUrl?: string
  x: number
  y: number
  z: number
  rx: number
  ry: number
  rz: number
  scale: number
  /** 图层树：可见性 */
  visible?: boolean
  /** 图层树：锁定 */
  locked?: boolean
  /** 材质覆盖参数 */
  material?: {
    metalness?: number
    roughness?: number
    opacity?: number
    emissive?: string
    emissiveIntensity?: number
  }
  /** GLTF 内嵌动画名 */
  animation?: string
  /** GIS 经纬度 */
  lat?: number
  lng?: number
  /** 数据绑定：实时源 + 字段映射 */
  bindings?: { liveSourceId?: string; fields?: Record<string, string> }
}
export interface TwinKeyframeDTO {
  time: number
  x: number
  z: number
  rotationY: number
}
export type TwinSceneStatus = 'online' | 'maintenance' | 'offline'
export interface TwinSceneDTO {
  id: string
  name: string
  models: TwinSceneModel[]
  lighting: 'day' | 'night'
  fog: boolean
  /** GIS 融合配置（引用地图资源中心/缩放） */
  gis?: { mapResourceId?: string; center?: [number, number]; zoom?: number; tilesetUrl?: string }
  status: TwinSceneStatus
  dashboardId?: string
  lastSyncAt?: string
  /** 发布审批状态 */
  deployStatus?: 'none' | 'pending' | 'approved' | 'rejected'
  deployEnv?: string
  approvalNote?: string
  deployedAt?: string
  /** 场景协同权限：所有者 / 编辑者 / 查看者 */
  acl?: { owner?: string; editors?: string[]; viewers?: string[] }
  /** 乐观并发版本号，保存时作为 baseRevision */
  revision?: number
  keyframes?: Record<string, TwinKeyframeDTO[]>
  duration?: number
  annotations?: Array<{
    id: string
    name: string
    start: { x: number; z: number }
    end: { x: number; z: number }
    color?: string
  }>
  updatedAt: string
}

export interface TwinEditLock {
  userId: string
  userName?: string
  expiresAt: number
}
