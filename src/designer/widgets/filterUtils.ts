import type { DataPoint, Filter } from '../../data/types'

// 联动筛选工具：全局 filter = { field, value }
export function applyFilter(data: DataPoint[] = [], filter?: Filter | null): DataPoint[] {
  if (!filter) return data
  return data.filter((d) => (d as unknown as Record<string, unknown>)[filter.field] === filter.value)
}

export function isActive(item: DataPoint, filter?: Filter | null): boolean {
  return !!filter && (item as unknown as Record<string, unknown>)[filter.field] === filter.value
}
