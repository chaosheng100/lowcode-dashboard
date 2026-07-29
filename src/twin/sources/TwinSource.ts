import type { TelemetrySample, TwinEntity, TwinSourceStatus } from '../twinTypes'
import { SimulatedSource } from './SimulatedSource'
import { IndustrialSource } from './IndustrialSource'
import { BimSource } from './BimSource'
import { GisSource } from './GisSource'

// ============================================================
// 孪生多源接入适配器（L1 感知/接入层）
// 统一抽象：任意数据源实现 TwinSource 即可被 TwinDataBridge.subscribeTwinSource 消费，
// 实现“一套渲染/仿真，多源数据”的可插拔接入。已内置：
//   - simulated  本地随机游走（默认，无后端可演示）
//   - industrial 工业协议（OPC-UA / Modbus，桩 + 代理可达时切换）
//   - bim        BIM 建筑信息模型（桩，提供布局/几何映射）
//   - gis        GIS 地理信息（桩，提供经纬度映射）
// 真实接入只需在对应类的 connect/read 中实现协议客户端即可，无需改动上层。
// ============================================================

export interface TwinSource {
  /** 数据源类型标识 */
  kind: string
  /** 建立连接（异步；失败不应抛出，应置 status.connected=false） */
  connect(): Promise<void>
  /** 读取各实体最新遥测快照（entityId → sample） */
  read(): Promise<Record<string, TelemetrySample>>
  /** 断开连接、释放资源 */
  disconnect(): void
  /** 当前连接状态（供 UI 展示与运行时 store 上报） */
  status(): TwinSourceStatus
}

export interface SourceOptions {
  /** 工业网关地址（OPC-UA/Modbus），如 'opc.tcp://192.168.1.10:4840' */
  gatewayEndpoint?: string
  /** BIM/GIS 模型地址（IFC/GeoJSON/Revit 导出） */
  modelUrl?: string
  /** 模拟种子健康度 */
  seedHealth?: number
}

export function createSource(
  kind: 'simulated' | 'industrial' | 'bim' | 'gis',
  entities: TwinEntity[],
  opts: SourceOptions = {}
): TwinSource {
  switch (kind) {
    case 'industrial':
      return new IndustrialSource(entities, opts)
    case 'bim':
      return new BimSource(entities, opts)
    case 'gis':
      return new GisSource(entities, opts)
    case 'simulated':
    default:
      return new SimulatedSource(entities, opts.seedHealth)
  }
}
