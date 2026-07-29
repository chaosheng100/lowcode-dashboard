import type { ControlAction, ControlCommand, TwinEntity } from './twinTypes'
import { CONTROL_LABELS } from './twinTypes'
import { useTwinRuntimeStore } from './twinRuntimeStore'

// ============================================================
// TwinControlHub：闭环控制下发（L5 决策/应用层 → 物理世界）
// 孪生场景中的操作（启停/设定/开阀/转速）反向驱动物理设备，完成“数字孪生→物理”闭环。
// 默认执行器为本地 mock；真实环境替换为后端代理下发（见 executor 注释）。
// 每条指令写入运行时 store 的 controls 日志，形成闭环可追溯。
// ============================================================

type ControlInput = Omit<ControlCommand, 'id' | 'ts' | 'status' | 'result' | 'entityName'>

/** 控制指令执行器：真实接入点（OPC-UA/Modbus/REST 下发到 PLC 或设备网关） */
export type ControlExecutor = (cmd: ControlInput) => Promise<{ ok: boolean; message: string }>

const defaultExecutor: ControlExecutor = async (cmd) => {
  // —— 真实接入示例（取消注释并接入后端代理）——
  // const res = await fetch('http://localhost:5175/proxy/control', {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify(cmd)
  // })
  // if (!res.ok) return { ok: false, message: `下发失败：${res.status}` }
  // return { ok: true, message: `设备已执行：${CONTROL_LABELS[cmd.action]}` }
  return { ok: true, message: `已下发：${CONTROL_LABELS[cmd.action]}` }
}

export class TwinControlHub {
  private executor: ControlExecutor
  /** 所属孪生视图实例 id（用于把指令日志写入对应运行时会话，避免多实例串数据） */
  private instanceId: string

  constructor(instanceId: string, executor: ControlExecutor = defaultExecutor) {
    this.instanceId = instanceId
    this.executor = executor
  }

  /** 下发一条控制指令；成功/失败都写入运行时 store 指令日志（按 instanceId 隔离） */
  async dispatch(
    entity: TwinEntity,
    action: ControlAction,
    params?: Record<string, number | string>
  ): Promise<ControlCommand> {
    const input: ControlInput = { entityId: entity.id, action, params }
    const res = await this.executor(input)
    const cmd: ControlCommand = {
      id: `ctl_${entity.id}_${Date.now()}`,
      entityId: entity.id,
      entityName: entity.name,
      action,
      params,
      ts: Date.now(),
      status: res.ok ? 'ok' : 'failed',
      result: res.message
    }
    useTwinRuntimeStore.getState().pushControl(this.instanceId, cmd)
    return cmd
  }
}
