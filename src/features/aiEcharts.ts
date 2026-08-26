import { isObject } from '../data/utils/typeGuards'

/** 从 AI 生成的 ECharts 代码中提取 option 对象 */
export function extractEchartsOption(code: string): Record<string, unknown> | null {
  if (!code) return null
  const patterns = [
    /(?:const|let|var)\s+option\s*=\s*(\{[\s\S]*\})/,
    /(?:window\.)?option\s*=\s*(\{[\s\S]*\})/
  ]
  for (const re of patterns) {
    const m = code.match(re)
    if (!m) continue
    const block = takeBalancedBlock(m[1])
    if (!block) continue
    try {
      // 只允许纯对象字面量，避免执行任意 AI 代码
      const fn = new Function(`return (${block})`) as () => unknown
      const value = fn()
      if (isObject(value)) {
        return value as Record<string, unknown>
      }
    } catch {
      // 尝试下一个匹配
    }
  }
  return null
}

function takeBalancedBlock(input: string): string | null {
  const start = input.indexOf('{')
  if (start < 0) return null
  let depth = 0
  let quote = ''
  let escaped = false
  for (let i = start; i < input.length; i++) {
    const ch = input[i]
    if (quote) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === quote) quote = ''
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      continue
    }
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return input.slice(start, i + 1)
    }
  }
  return null
}
