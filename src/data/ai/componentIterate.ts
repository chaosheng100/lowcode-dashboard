// ============================================================
// AI 组件迭代共享工具：已登记组件 → 迭代调整 prompt
// 组件库页与 AI 助手页共用：让 AI 基于现有组件内容调整，而不是凭空生成。
// ============================================================
import type { WidgetDefDTO } from '../../mock/types'

export type ComponentIterateTarget = Pick<
  WidgetDefDTO,
  | 'name'
  | 'type'
  | 'desc'
  | 'sourceCode'
  | 'optionJson'
  | 'kind'
  | 'widget'
  | 'category'
  | 'renderer'
  | 'schema'
  | 'dataSchema'
>

/** 判断已登记组件是否为 AI 生成的可迭代资产（源码 / ECharts option） */
export function isAIComponent(target: ComponentIterateTarget): boolean {
  return Boolean(target.widget || target.sourceCode || target.optionJson)
}

/**
 * 已登记组件内容 → AI 迭代调整 prompt。
 * 源码组件拼出完整源码，ECharts 组件拼出 option JSON，
 * 并附上组件 Schema 契约（renderer / schema / dataSchema），
 * 让 AI 在保持数据契约与属性结构的前提下调整。
 */
export function componentIterationPrompt(
  target: ComponentIterateTarget,
  instruction: string,
): string {
  // 契约只保留结构字段：schema.sourceCode/optionJson 与顶层重复，剔除避免源码发两遍
  const schema =
    target.schema && target.schema.type ? { type: target.schema.type } : undefined
  const contract: Record<string, unknown> = {
    name: target.name,
    type: target.type,
    kind: target.kind,
    category: target.category,
    renderer: target.renderer,
    schema,
    dataSchema: target.dataSchema ?? undefined,
  }
  const head = `你是低代码大屏设计器的组件工程师。请基于下面已有的「${target.name}」组件（type: ${target.type}）进行调整：${instruction}\n要求：只修改该组件本身，保持原有数据契约与对外接口不变（如 window.__DASHBOARD__、props、联动字段），输出完整可运行的代码，不要省略任何部分。\n\n组件 Schema 契约（调整时必须保持兼容，不得破坏字段结构与默认值）：\n${JSON.stringify(contract, null, 2)}`

  if (target.optionJson) {
    return `${head}
---
现有 ECharts option JSON：
${target.optionJson}
---
请直接输出调整后的完整 ECharts option 对象（仅 JSON，不要 markdown 代码块，不要解释）。`
  }

  const code = target.sourceCode ?? ''
  const kind =
    target.kind === 'echarts'
      ? 'ECharts'
      : target.renderer === 'reactComponent'
        ? 'React TSX'
        : 'HTML'
  return `${head}
---
现有${kind}组件源码：
${code}
---
请直接输出调整后的完整${kind}源码（不要 markdown 代码块围栏，不要解释）。`
}
