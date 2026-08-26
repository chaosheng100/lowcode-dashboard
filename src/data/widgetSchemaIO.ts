// ============================================================
// 组件 JSON schema 导入导出共享工具
// 导出：组件定义（WidgetDefDTO）→ 可移植 JSON schema 文件。
// 导入：解析并校验 JSON schema → 应用到指定已注册组件（保存即记版）。
// ============================================================
import type { WidgetDefDTO } from '../mock/types'
import { isNonEmptyString, isObject } from './utils/typeGuards'

export interface WidgetSchemaFile {
  /** 导出格式版本 */
  schemaVersion: 1
  /** 组件类型（导入到同名组件时用） */
  type: string
  name: string
  category: string
  desc?: string
  version?: string
  kind?: string
  renderer?: string
  sandboxMode?: 'sandbox' | 'trusted'
  sourceCode?: string
  optionJson?: string
  dataSchema?: Record<string, unknown>
  schema?: WidgetDefDTO['schema']
}

/** 导出：组件定义 → JSON schema 文件对象（只带可移植字段，不带走服务端状态） */
export function widgetToSchemaFile(w: WidgetDefDTO): WidgetSchemaFile {
  return {
    schemaVersion: 1,
    type: w.type,
    name: w.name,
    category: w.category,
    desc: w.desc,
    version: w.version,
    kind: w.kind,
    renderer: w.renderer,
    sandboxMode: w.sandboxMode,
    sourceCode: w.sourceCode,
    optionJson: w.optionJson,
    dataSchema: w.dataSchema,
    schema: w.schema,
  }
}

/** 解析并校验导入的 JSON schema 文件；不合法返回错误信息 */
export function parseWidgetSchemaFile(raw: string): { file?: WidgetSchemaFile; error?: string } {
  let obj: unknown
  try {
    obj = JSON.parse(raw)
  } catch {
    return { error: 'JSON 解析失败，请检查文件内容' }
  }
  if (!isObject(obj)) {
    return { error: '文件内容必须是 JSON 对象' }
  }
  const f = obj as Partial<WidgetSchemaFile>
  if (f.schemaVersion !== 1) {
    return { error: '不支持的 schema 版本，仅支持 schemaVersion: 1' }
  }
  if (!isNonEmptyString(f.type)) {
    return { error: '缺少组件类型（type）字段' }
  }
  if (!isNonEmptyString(f.name)) {
    return { error: '缺少组件名称（name）字段' }
  }
  if (!isNonEmptyString(f.category)) {
    return { error: '缺少组件分类（category）字段' }
  }
  if (!f.sourceCode && !f.optionJson) {
    return { error: '缺少组件内容（sourceCode 或 optionJson）' }
  }
  return { file: f as WidgetSchemaFile }
}

/** 把导入的 schema 应用到目标组件：合并可移植字段，保留目标组件的服务端字段 */
export function applySchemaFileToWidget(
  target: WidgetDefDTO,
  file: WidgetSchemaFile,
): Partial<WidgetDefDTO> {
  const patch: Partial<WidgetDefDTO> = {
    type: target.type,
    name: file.name || target.name,
    category: file.category || target.category,
    desc: file.desc ?? target.desc,
    renderer: file.renderer,
    sandboxMode: file.sandboxMode ?? 'sandbox',
    dataSchema: file.dataSchema,
  }
  if (file.sourceCode) {
    patch.sourceCode = file.sourceCode
    patch.kind = 'html' as const
    patch.schema = {
      type: file.renderer ?? (file.sourceCode.includes('react') ? 'reactComponent' : 'htmlComponent'),
      sourceCode: file.sourceCode,
      sandboxMode: file.sandboxMode ?? 'sandbox',
    }
  }
  if (file.optionJson) {
    patch.optionJson = file.optionJson
    patch.kind = 'echarts' as const
    patch.schema = {
      type: 'echartCustom',
      optionJson: file.optionJson,
    }
  }
  return patch
}
