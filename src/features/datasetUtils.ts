import type { DatasetDTO, DatasetField, DatasetRow } from '../mock'
import { isArray, isBoolean, isNumber, isObject, isString } from '../data/utils/typeGuards'

// ---------------- 字段语义工具（自动推断） ----------------

function inferFieldType(v: unknown): DatasetField['fieldType'] {
  if (isNumber(v)) return 'number'
  if (isBoolean(v)) return 'boolean'
  if (isString(v) && !isNaN(Date.parse(v))) return 'date'
  return 'string'
}

function inferSemanticType(key: string, v: unknown): 'dimension' | 'metric' {
  if (isNumber(v)) return 'metric'
  if (/^(is|has|flag)/i.test(key)) return 'dimension'
  if (/(date|time|year|month|day|region|area|name|type|category|status|channel|平台|区域|地区|月份|日期|名称|类别|渠道|状态)/i.test(key)) return 'dimension'
  return 'metric'
}

/** 解析静态数据（JSON 数组） */
export function parseRows(text: string): DatasetRow[] | null {
  const trimmed = text.trim()
  if (!trimmed) return []
  try {
    const v = JSON.parse(trimmed)
    return isArray(v) ? (v as DatasetRow[]) : null
  } catch {
    return null
  }
}

/** 从样例行自动推断字段语义元信息 */
export function inferFields(rows: DatasetRow[]): DatasetField[] {
  if (!rows.length) return []
  const keys = Object.keys(rows[0])
  return keys.map((k) => {
    const vals = rows.map((r) => r[k]).filter((v) => v != null)
    const first = vals[0]
    const fieldType = inferFieldType(first)
    const semanticType = inferSemanticType(k, first)
    return {
      fieldKey: k,
      label: k,
      fieldType,
      semanticType,
      aggregation: semanticType === 'metric' ? 'sum' : 'none',
      sampleValues: vals.slice(0, 3),
      sortOrder: 0,
    }
  })
}

/** 从数据集 config 中提取静态数据行 */
export function extractStaticRows(config: unknown): unknown[] {
  if (!config) return []
  if (isString(config)) {
    try {
      const c = JSON.parse(config)
      return isArray(c.data) ? c.data : isArray(c.rows) ? c.rows : []
    } catch {
      return []
    }
  }
  const c = config as Record<string, unknown>
  return isArray(c.data)
    ? (c.data as unknown[])
    : isArray(c.rows)
      ? (c.rows as unknown[])
      : []
}

/** 将 config 统一解析为对象，供编辑回填与保存合并使用 */
export function parseConfig(config: unknown): Record<string, unknown> {
  if (isString(config)) {
    try {
      const c = JSON.parse(config)
      return isObject(c) ? c : {}
    } catch {
      return {}
    }
  }
  return isObject(config)
    ? (config as Record<string, unknown>)
    : {}
}

export const datasetAggOptions = ['sum', 'avg', 'count', 'max', 'min', 'none']
export const datasetTypeOptions: Array<{ value: DatasetField['fieldType']; label: string }> = [
  { value: 'string', label: '文本' },
  { value: 'number', label: '数值' },
  { value: 'date', label: '日期' },
  { value: 'boolean', label: '布尔' },
]
export const datasetTypes: Array<{ value: DatasetDTO['type']; label: string }> = [
  { value: 'static', label: '静态数据' },
  { value: 'sql', label: 'SQL 查询' },
  { value: 'api', label: 'API 接口' },
  { value: 'csv', label: 'CSV 文件' },
]
