import type { Filter } from '../../data/types'

// 联动筛选工具：全局 filter = { field, value }
export function applyFilter(
  data: Array<Record<string, unknown>> = [],
  filter?: Filter | null
): Array<Record<string, unknown>> {
  if (!filter || !filter.field) return data
  return data.filter((d) => String(d[filter.field]) === String(filter.value))
}

export function isActive(item: Record<string, unknown>, filter?: Filter | null): boolean {
  return !!filter && !!filter.field && String(item[filter.field]) === String(filter.value)
}

/** 联动数据源：global filter -> 对象数组 / 组件 props 的通用过滤 */
export function applyRowFilter(
  rows: Array<Record<string, unknown>> = [],
  filter?: Filter | null
): Array<Record<string, unknown>> {
  if (!filter || !filter.field) return rows
  return rows.filter((row) => String(row[filter.field]) === String(filter.value))
}

/** 全局变量模板替换：{G.name} 与 ${G.name} 两种写法 */
export function resolveTemplate(
  source: string,
  vars: Record<string, unknown> = {}
): string {
  return source.replace(/\$\{G\.([A-Za-z0-9_]+)\}/g, (_, key: string) =>
    key in vars ? String(vars[key]) : `\${G.${key}}`
  )
}
