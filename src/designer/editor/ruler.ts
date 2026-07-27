/**
 * ruler.ts —— Canvas 刻度（标尺）绘制工具
 *
 * 核心函数 drawAxisTicks 与具体业务解耦，传入 2D 上下文 + 配置即可在
 * 画布的某一条边上绘制「主刻度 + 次刻度 + 数值标签」。
 * 支持自定义：起止值、主刻度间隔、每条主刻度下的次刻度数、线长/线宽、
 *            颜色、字体、方向（向内/向外）、标签格式化函数。
 *
 * 关键不变量（保证刻度与画布物理像素精确对应）：
 *  - 数值 v 在画布上的像素位置 = (v - start) / (end - start) * 边长，
 *    与「真实显示边长」一一对应，任何缩放比下都不漂移。
 *  - 刻度范围严格等于 [start, end]，既不会溢出画布，也不会留白未覆盖。
 *  - start 与 end 处必有主刻度（若 end 不是整数个主刻度，自动补边界主刻度），
 *    使首尾刻度精确对齐画布边缘。
 */

export type Edge = 'top' | 'bottom' | 'left' | 'right'
export type TickDirection = 'outward' | 'inward'

export interface TickOptions {
  /** 在哪条边上绘制刻度 */
  edge: Edge
  /** 内容区（被刻度依附的区域）左上角 */
  originX: number
  originY: number
  /** 内容区宽（水平轴使用） */
  width: number
  /** 内容区高（垂直轴使用） */
  height: number
  /** 刻度范围起始值 */
  start?: number
  /** 刻度范围结束值 */
  end?: number
  /** 主刻度间隔 */
  majorStep?: number
  /** 每个主刻度之间的次刻度数量（次刻度间隔 = majorStep / minorPerMajor） */
  minorPerMajor?: number
  /** 主刻度线长（px） */
  majorLength?: number
  /** 次刻度线长（px） */
  minorLength?: number
  /** 主刻度线宽 */
  majorWidth?: number
  /** 次刻度线宽 */
  minorWidth?: number
  /** 主刻度颜色（深） */
  majorColor?: string
  /** 次刻度颜色（浅） */
  minorColor?: string
  /** 数值标签颜色 */
  labelColor?: string
  /** 数值标签字体 */
  labelFont?: string
  /** 标签与刻度线外侧的间距（px） */
  labelOffset?: number
  /** 刻度方向：向外 / 向内 */
  direction?: TickDirection
  /** 数值标签格式化 */
  formatLabel?: (v: number) => string
}

const DEFAULTS: Required<Omit<TickOptions, 'edge' | 'originX' | 'originY' | 'width' | 'height'>> = {
  start: 0,
  end: 100,
  majorStep: 10,
  minorPerMajor: 5,
  majorLength: 10,
  minorLength: 5,
  majorWidth: 2,
  minorWidth: 1,
  majorColor: '#333333',
  minorColor: '#b0b4ba',
  labelColor: '#333333',
  labelFont: '12px sans-serif',
  labelOffset: 4,
  direction: 'outward',
  formatLabel: (v: number) => (Number.isInteger(v) ? String(v) : v.toFixed(1)),
}

/**
 * 在画布某一条边上绘制刻度。
 */
export function drawAxisTicks(ctx: CanvasRenderingContext2D, cfg: TickOptions): void {
  const o = { ...DEFAULTS, ...cfg } as Required<TickOptions>

  const span = o.end - o.start
  if (span <= 0) return
  const minorStep = o.majorStep / o.minorPerMajor
  // 次刻度总数：用 round 取得最接近的整数分段，保证首尾都能落到边缘附近
  let totalMinor = Math.round(span / minorStep)
  if (totalMinor < 0) totalMinor = 0

  // 向外(1) / 向内(-1)
  const outward = o.direction === 'inward' ? -1 : 1

  // 根据 edge 决定刻度延伸方向、标签对齐方式
  let dir: { x: number; y: number }
  let textAlign: CanvasTextAlign
  let textBaseline: CanvasTextBaseline
  switch (o.edge) {
    case 'top':
      dir = { x: 0, y: -1 * outward }; break
    case 'bottom':
      dir = { x: 0, y: 1 * outward }; break
    case 'left':
      dir = { x: -1 * outward, y: 0 }; break
    case 'right':
    default:
      dir = { x: 1 * outward, y: 0 }; break
  }
  if (o.edge === 'top' || o.edge === 'bottom') {
    textAlign = 'center'
    textBaseline = dir.y < 0 ? 'bottom' : 'top'
  } else {
    textBaseline = 'middle'
    textAlign = dir.x < 0 ? 'right' : 'left'
  }

  // 绘制单条刻度（含线 + 可选标签）。frac 为数值在 [start,end] 中的真实占比，
  // 直接决定像素位置，因此刻度始终精确映射画布物理像素。
  const drawTick = (v: number, isMajor: boolean, frac: number) => {
    const f = Math.max(0, Math.min(1, frac)) // 钳制，杜绝溢出画布
    let bx: number
    let by: number
    if (o.edge === 'top' || o.edge === 'bottom') {
      bx = o.originX + f * o.width
      by = o.edge === 'top' ? o.originY : o.originY + o.height
    } else {
      bx = o.edge === 'left' ? o.originX : o.originX + o.width
      by = o.originY + f * o.height
    }

    const len = isMajor ? o.majorLength : o.minorLength
    const ex = bx + dir.x * len
    const ey = by + dir.y * len

    // 绘制刻度线（主刻度较长且颜色深，次刻度较短且颜色浅）
    ctx.beginPath()
    ctx.strokeStyle = isMajor ? o.majorColor : o.minorColor
    ctx.lineWidth = isMajor ? o.majorWidth : o.minorWidth
    ctx.moveTo(bx, by)
    ctx.lineTo(ex, ey)
    ctx.stroke()

    // 仅主刻度绘制数值标签，居中对齐在刻度线外侧；
    // 首尾标签做贴边处理，避免 "0" / 末端数值被裁切
    if (isMajor) {
      ctx.fillStyle = o.labelColor
      ctx.font = o.labelFont
      let align = textAlign
      let baseline = textBaseline
      if (o.edge === 'top' || o.edge === 'bottom') {
        if (f <= 0) align = 'left'
        else if (f >= 1) align = 'right'
      } else {
        if (f <= 0) baseline = 'top'
        else if (f >= 1) baseline = 'bottom'
      }
      ctx.textAlign = align
      ctx.textBaseline = baseline
      const lx = bx + dir.x * (len + o.labelOffset)
      const ly = by + dir.y * (len + o.labelOffset)
      ctx.fillText(o.formatLabel(v), lx, ly)
    }
  }

  // 以「次刻度序号」遍历，避免浮点累积误差
  for (let i = 0; i <= totalMinor; i++) {
    const v = o.start + i * minorStep
    const frac = (v - o.start) / span // 真实数值占比 → 精确像素位置
    drawTick(v, i % o.minorPerMajor === 0, frac)
  }

  // 安全兜底：若终止边界不是整数个主刻度（非整除场景），强制补一个
  // 主刻度精确对齐画布边缘，确保刻度完整覆盖画布、首尾都对齐边界。
  const endMajorIndex = Math.round(span / o.majorStep)
  if (Math.abs(span - endMajorIndex * o.majorStep) > 1e-6) {
    drawTick(o.end, true, 1)
  }
}

/**
 * 根据量程返回「好看」的主刻度步长（1 / 2 / 5 × 10^n 系列）。
 * 用于让标尺的主刻度间隔随画布尺寸自适应。
 */
export function niceStep(range: number, targetCount = 10): number {
  if (range <= 0) return 1
  const raw = range / targetCount
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  let step: number
  if (norm < 1.5) step = 1
  else if (norm < 3) step = 2
  else if (norm < 7) step = 5
  else step = 10
  return step * mag
}

/**
 * 返回一个能「整除量程」的均匀主刻度步长：
 *  - 量程被均匀分成若干段，每段长度完全相等（间隔均匀）；
 *  - start 与 end 恰好都是主刻度，精确对齐画布首尾边缘；
 *  - 在所有常用分段数中，挑选「步长最接近理想值、且标签为整数」的方案，
 *    让刻度既精确又整洁（如 1920→192、1080→90、1280→80、2560→160）。
 * 这是保证「刻度与画布尺寸精确对应、无溢出、无留白」的关键。
 */
export function uniformStep(range: number, targetCount = 10): number {
  if (range <= 0) return 1
  const target = niceStep(range, targetCount)
  let best = target
  let bestScore = Infinity
  for (const n of NICE_DIVISIONS) {
    const step = range / n
    // 与理想步长的相对偏差 + 轻微惩罚非整数标签，优先选整洁整数刻度
    const score = Math.abs(step - target) / target + (Number.isInteger(step) ? 0 : 0.15)
    if (score < bestScore) {
      bestScore = score
      best = step
    }
  }
  return best
}

/** 常用分段数（段数越大刻度越密），用于挑选均匀且标签整洁的步长 */
const NICE_DIVISIONS = [4, 5, 6, 8, 10, 12, 15, 16, 20, 24, 25, 30, 40, 50, 60, 80, 100, 120, 150, 200]
