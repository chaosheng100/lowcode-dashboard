import html2canvas from 'html2canvas'

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

/**
 * 真实缩略图：用 html2canvas 截取画布视口元素，返回压缩后的 JPEG dataURL。
 * 对齐 Avue Data 的 html2canvas 缩略图方案；失败时返回空串，调用方回退 makeThumb。
 * @param el 画布视口元素（.canvas-viewport），不含 transform，截图即所见
 * @param bg 背景色（默认深空蓝）
 *
 * 注意：用变量名动态 import，使未安装 html2canvas 时 tsc 也能通过；
 *       安装 html2canvas 后即可正常工作（npm i html2canvas）。
 */
export async function captureThumbnail(el: HTMLElement, bg = '#0a0e1a'): Promise<string> {
  try {
    const cv = await html2canvas(el, {
      backgroundColor: bg,
      scale: 0.18, // 缩略图缩小到 ~18%，控制 dataURL 体积
      logging: false,
      useCORS: true,
      allowTaint: true
    })
    return cv.toDataURL('image/jpeg', 0.6)
  } catch {
    return ''
  }
}
