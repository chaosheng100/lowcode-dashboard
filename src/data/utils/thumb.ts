// 缩略图工具：根据种子生成确定性的 CSS 渐变（无需真实截图即可预览大屏风格）
function hash(str: string): number {
  let h = 2166136261
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

const PALETTES: [string, string][] = [
  ['#0b1b3a', '#3a6ea5'],
  ['#10243b', '#1f8a70'],
  ['#1a1030', '#7b3fa0'],
  ['#2a1410', '#c0623a'],
  ['#0c2a2a', '#2a9d8f'],
  ['#1b1530', '#4361c2'],
  ['#241033', '#9b5de5'],
  ['#102b1a', '#43aa8b']
]

/** 返回用于列表项背景的 CSS 渐变字符串 */
export function makeThumb(seed: string): string {
  const h = hash(seed)
  const [a, b] = PALETTES[h % PALETTES.length]
  const angle = 110 + (h % 60)
  return `linear-gradient(${angle}deg, ${a} 0%, ${b} 100%)`
}
