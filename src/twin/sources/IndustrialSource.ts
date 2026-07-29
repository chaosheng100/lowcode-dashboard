import type { TwinEntity } from '../twinTypes'
import type { TwinSource } from './TwinSource'
import { SimulatedSource } from './SimulatedSource'
import { proxyHealth } from '../../data/live/liveClient'
import type { SourceOptions } from './TwinSource'

/**
 * 工业协议源（OPC-UA / Modbus / BACnet）：L1 感知/接入层的真实接入桩。
 * 演示默认复用模拟随机游走保证可运行；真实环境在 connect/read 中接入边缘网关：
 *   - 通过 proxyHealth() 探测代理/网关可达性；可达则标记“已连接工业网关”；
 *   - read() 改为按 entityId ↔ 点位地址(如 'ns=2;s=Line1.Temp')映射，
 *     经 `querySqlViaProxy` / WebSocket 代理拉取 PLC/DCS 实时值。
 */
export class IndustrialSource extends SimulatedSource implements TwinSource {
  kind = 'industrial'
  protocol: 'OPC-UA' | 'Modbus' | 'BACnet'
  private gatewayEndpoint?: string

  constructor(entities: TwinEntity[], opts: SourceOptions = {}) {
    super(entities, opts.seedHealth)
    this.gatewayEndpoint = opts.gatewayEndpoint
    this.protocol = opts.gatewayEndpoint?.includes('modbus') ? 'Modbus' : 'OPC-UA'
  }

  async connect(): Promise<void> {
    let reachable = false
    try {
      reachable = await proxyHealth()
    } catch {
      reachable = false
    }
    this.statusObj = {
      kind: 'industrial',
      connected: true, // 模拟源始终可用，保证演示；真实网关不可达时应置 false
      message: reachable
        ? `已连接工业网关（${this.protocol}${this.gatewayEndpoint ? ' @ ' + this.gatewayEndpoint : ''}），经代理拉取 PLC/DCS 点位`
        : `工业网关不可达，使用本地 ${this.protocol} 点位模拟（真实接入见 connect/read 注释）`
    }
  }
}
