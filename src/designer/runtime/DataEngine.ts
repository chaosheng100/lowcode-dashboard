import type { DataPoint } from '../../data/types'

/**
 * 数据引擎（Data Engine）
 * 纯前端版本：以静态数据集 + 模拟拉取为主，预留 REST / WebSocket 接入点。
 * 后续接入真实后端时，只需扩展 resolveDataSource 即可，组件层无需改动。
 */

export const staticDatasets: Record<string, DataPoint[]> = {
  salesByRegion: [
    { name: '华东', value: 320 },
    { name: '华北', value: 210 },
    { name: '华南', value: 260 },
    { name: '西部', value: 150 }
  ],
  trend: [
    { name: '一月', value: 120 },
    { name: '二月', value: 200 },
    { name: '三月', value: 150 },
    { name: '四月', value: 280 }
  ]
}

// 模拟一次数据请求（可替换为 fetch / WebSocket）
export function resolveDataSource(id: string): Promise<DataPoint[]> {
  return new Promise((resolve) => {
    setTimeout(() => resolve(staticDatasets[id] ?? []), 200)
  })
}

// 字段映射：将接口数据映射到组件所需 { name, value }
export interface FieldMap {
  name: string
  value: string
}
export function mapFields(rows: Record<string, unknown>[], map?: FieldMap): DataPoint[] {
  if (!map) return rows as unknown as DataPoint[]
  return rows.map((r) => ({ name: String(r[map.name]), value: Number(r[map.value]) }))
}
