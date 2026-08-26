import type { DataPoint } from '../../data/types'
import { api } from '../../mock'

/**
 * 数据引擎（Data Engine）
 * 纯前端版本：以静态数据集 + 数据集查询为主，预留 REST / WebSocket 接入点。
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

/**
 * 解析数据源 → DataPoint[]。
 * 解析顺序：
 *   1) 内置静态数据集（演示用，key 命中 staticDatasets）
 *   2) 数据集 id（属性面板「数据集绑定」写入的 dataSourceId 即 datasetId，如 dset_xxx）
 *      → 走 api.queryDataset 拉取并映射为 {name,value}
 *   3) 都不命中 → 返回空数组（调用方应保留原 props.data，避免清屏）
 */
export interface DataSourceBinding {
  xField?: string
  yField?: string
}

export interface TableDatasetColumn {
  key: string
  title: string
  dataSetFieldKey: string
}

export interface TableDataset {
  columns: TableDatasetColumn[]
  rows: Array<Record<string, unknown>>
}

const datasetFieldLabels = new Map<string, Record<string, string>>()

async function loadDatasetFieldLabels(id: string): Promise<Record<string, string>> {
  const cached = datasetFieldLabels.get(id)
  if (cached) return cached
  try {
    const r = await api.getDataset(id)
    const labels: Record<string, string> = {}
    for (const field of r.data?.fields ?? []) {
      if (field.fieldKey) labels[field.fieldKey] = field.label || field.fieldKey
    }
    datasetFieldLabels.set(id, labels)
    return labels
  } catch {
    return {}
  }
}

/**
 * 解析数据集 → 标准 table 契约。AI HTML 与 table 组件共用这套结构，
 * 避免任意业务字段被压缩成 {name,value} 后丢失。
 */
export async function resolveTableDataset(
  id: string,
  options?: { fieldLabels?: Record<string, string>; fields?: string[] }
): Promise<TableDataset> {
  if (!id) return { columns: [], rows: [] }
  if (staticDatasets[id]) {
    const rows = staticDatasets[id].map((item) => ({ ...item })) as Array<Record<string, unknown>>
    const keys = ['name', 'value']
    const requestedKeys = (options?.fields ?? []).filter((key) => keys.includes(key))
    return {
      columns: (requestedKeys.length ? requestedKeys : keys).map((key) => ({
        key,
        title: key === 'name' ? '名称' : '数值',
        dataSetFieldKey: key,
      })),
      rows,
    }
  }

  try {
    const [fieldLabels, r] = await Promise.all([
      loadDatasetFieldLabels(id),
      api.queryDataset(id, { pageSize: 50 }),
    ])
    const labels = { ...fieldLabels, ...options?.fieldLabels }
    if (r.code !== 0 || !r.data) return { columns: [], rows: [] }
    const rows = (r.data.list ?? []) as Array<Record<string, unknown>>
    const queryColumns = Array.isArray(r.data.columns) ? r.data.columns : []
    const keys = queryColumns.length
      ? queryColumns
      : Object.keys(rows[0] ?? {})
    const requestedKeys = (options?.fields ?? []).filter((key) => keys.includes(key))
    const selectedKeys = requestedKeys.length ? requestedKeys : keys
    return {
      columns: selectedKeys.map((key) => ({
        key,
        title: labels[key] || key,
        dataSetFieldKey: key,
      })),
      rows,
    }
  } catch {
    return { columns: [], rows: [] }
  }
}

export async function resolveDataSource(
  id: string,
  binding?: DataSourceBinding | null
): Promise<DataPoint[]> {
  if (!id) return []
  // 1) 内置静态数据集
  if (staticDatasets[id]) return staticDatasets[id]
  // 2) 数据集 id → 查询并映射
  try {
    const r = await api.queryDataset(id, { pageSize: 50 })
    if (r.code === 0 && r.data.list.length) {
      const rows = r.data.list as Record<string, unknown>[]
      // 显式绑定：按 xField/yField 映射，字段缺失时不产生 'undefined'/NaN
      if (binding?.xField && binding?.yField) {
        return mapFields(rows, { name: binding.xField, value: binding.yField })
      }
      // 无显式绑定：兼容内置示例字段（region/metric/name + value）
      return rows.map((o) => ({
        name: String(o.region ?? o.metric ?? o.name ?? ''),
        value: Number(o.value) || 0
      }))
    }
  } catch {
    /* 查询失败 → 返回空，调用方保留原数据 */
  }
  return []
}

// 字段映射：将接口数据映射到组件所需 { name, value }
export interface FieldMap {
  name: string
  value: string
}
export function mapFields(rows: Record<string, unknown>[], map?: FieldMap): DataPoint[] {
  if (!map) return rows as unknown as DataPoint[]
  return rows.map((r) => ({
    name: r[map.name] != null ? String(r[map.name]) : '',
    value: Number(r[map.value] ?? 0) || 0
  }))
}
