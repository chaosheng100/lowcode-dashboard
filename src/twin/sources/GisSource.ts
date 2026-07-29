import type { TwinEntity } from '../twinTypes'
import type { TwinSource } from './TwinSource'
import { SimulatedSource } from './SimulatedSource'
import type { SourceOptions } from './TwinSource'

/**
 * GIS 地理信息源：L1 接入层的地理空间桩，用于室外/厂区级数字孪生。
 * 除实时遥测外，提供经纬度映射（geo）。演示用厂区周边坐标；真实接入：
 * 从 GIS 服务/GeoJSON 拉取资产坐标，配合地图瓦片 SDK 实现“孪生场景 + 底图”叠加。
 */
export class GisSource extends SimulatedSource implements TwinSource {
  kind = 'gis'
  private origin = { lon: 116.397, lat: 39.908 } // 默认厂区中心（演示）

  constructor(entities: TwinEntity[], opts: SourceOptions = {}) {
    super(entities, opts.seedHealth)
  }

  async connect(): Promise<void> {
    this.statusObj = {
      kind: 'gis',
      connected: true,
      message: '已建立 GIS 坐标映射（真实接入：从 GIS 服务/GeoJSON 拉取资产经纬度）'
    }
  }

  /** 资产经纬度（演示：以厂区中心为原点做小幅偏移；真实：来自 GIS 资产表） */
  geo(): { id: string; lon: number; lat: number }[] {
    return this.entities.map((e, i) => {
      const a = (i / Math.max(this.entities.length, 1)) * Math.PI * 2
      return {
        id: e.id,
        lon: +(this.origin.lon + Math.cos(a) * 0.02).toFixed(5),
        lat: +(this.origin.lat + Math.sin(a) * 0.02).toFixed(5)
      }
    })
  }
}
