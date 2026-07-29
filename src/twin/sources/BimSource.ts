import type { TwinEntity } from '../twinTypes'
import type { TwinSource } from './TwinSource'
import { SimulatedSource } from './SimulatedSource'
import type { SourceOptions } from './TwinSource'

/**
 * BIM 建筑信息模型源：L1 接入层的空间数据桩。
 * 除提供实时遥测外，额外提供布局/几何映射（layout），用于把 BIM 构件坐标
 * 对齐到孪生场景。演示用网格化排布；真实接入：解析 IFC / Revit 导出 JSON，
 * 将构件(IfcBuildingElement)映射为 TwinEntity（含 geoType/scale/坐标）。
 */
export class BimSource extends SimulatedSource implements TwinSource {
  kind = 'bim'
  modelUrl?: string

  constructor(entities: TwinEntity[], opts: SourceOptions = {}) {
    super(entities, opts.seedHealth)
    this.modelUrl = opts.modelUrl
  }

  async connect(): Promise<void> {
    this.statusObj = {
      kind: 'bim',
      connected: true,
      message: this.modelUrl
        ? `已加载 BIM 模型：${this.modelUrl}`
        : '已生成演示 BIM 布局（真实接入：解析 IFC/Revit 导出为孪生实体）'
    }
  }

  /** BIM 构件布局（演示：网格排布；真实：来自 IFC 构件实际坐标） */
  layout(): { id: string; x: number; y: number; z: number }[] {
    const cols = Math.ceil(Math.sqrt(this.entities.length))
    return this.entities.map((e, i) => ({
      id: e.id,
      x: (i % cols) * 6 - (cols * 6) / 2 + 3,
      y: 0.6,
      z: Math.floor(i / cols) * 6 - (cols * 6) / 2 + 3
    }))
  }
}
