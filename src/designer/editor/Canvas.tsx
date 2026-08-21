import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Rnd } from 'react-rnd'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import WidgetRenderer from '../widgets/WidgetRenderer'
import { useFitScale } from './useFitScale'
import { drawAxisTicks, uniformStep } from './ruler'
import { bgImageStyle } from './background'
import type { ComponentInstance, RouteConfig } from '../../data/types'

/** 标尺带默认尺寸：左右带较宽（容纳竖向坐标数字如 1080），上下带较扁 */
const RULER_X_DEFAULT = 46
const RULER_Y_DEFAULT = 28

function ComponentFrame({ component, scale, pageW, pageH }: {
  component: ComponentInstance
  scale: number
  pageW: number
  pageH: number
}) {
  const selectedId = useDesignerStore((s) => s.selectedId)
  const select = useDesignerStore((s) => s.select)
  const moveComponent = useDesignerStore((s) => s.moveComponent)
  const updateComponentStyle = useDesignerStore((s) => s.updateComponentStyle)
  const style = component.style || {}

  const selected = selectedId === component.id

  return (
    <Rnd
      className={'comp-frame' + (selected ? ' selected' : '')}
      size={{ width: style.w ?? 400, height: style.h ?? 240 }}
      position={{ x: style.x ?? 0, y: style.y ?? 0 }}
      bounds="parent"
      scale={scale}
      minWidth={40}
      minHeight={30}
      enableResizing={selected}
      resizeHandleComponent={{ bottomRight: <div className="resize-handle" /> }}
      dragHandleClassName="comp-drag-area"
      onMouseDown={(e) => {
        e.stopPropagation()
        select(component.id)
      }}
      onDragStart={() => select(component.id)}
      onDragStop={(_e, d) => {
        const nx = Math.max(0, Math.min(Math.round(d.x), pageW - (style.w ?? 0)))
        const ny = Math.max(0, Math.min(Math.round(d.y), pageH - (style.h ?? 0)))
        moveComponent(component.id, nx, ny)
      }}
      onResizeStop={(_e, _dir, ref, _delta, pos) => {
        const w = Math.max(40, Math.round(ref.offsetWidth))
        const h = Math.max(30, Math.round(ref.offsetHeight))
        updateComponentStyle(component.id, {
          x: Math.max(0, Math.min(Math.round(pos.x), pageW - w)),
          y: Math.max(0, Math.min(Math.round(pos.y), pageH - h)),
          w,
          h,
        })
      }}
    >
      <div className="comp-drag-area">
        <WidgetRenderer component={component} filter={null} onPick={null} />
      </div>
    </Rnd>
  )
}

export default function Canvas() {
  const route = useDesignerStore(
    (s) => s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0]
  )! as RouteConfig
  const components = route.components
  const page = route.page
  const pageW = Number.isFinite(page.width) ? page.width : 1920
  const pageH = Number.isFinite(page.height) ? page.height : 1080
  const pageForFit = { ...page, width: pageW, height: pageH }
  const select = useDesignerStore((s) => s.select)
  const areaRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  const topRulerRef = useRef<HTMLCanvasElement>(null)
  const bottomRulerRef = useRef<HTMLCanvasElement>(null)
  const leftRulerRef = useRef<HTMLCanvasElement>(null)
  const rightRulerRef = useRef<HTMLCanvasElement>(null)

  // 标尺尺寸：跟随「画布区(.canvas-area)」自身尺寸实时响应，而非仅 window.resize。
  // 这样无论是窗口缩放、还是左右面板收起/展开导致画布区宽度变化，
  // 标尺带宽度与网格列(--ruler-x / --ruler-y)都会即时重算，刻度随之重绘。
  const [ruler, setRuler] = useState({ x: RULER_X_DEFAULT, y: RULER_Y_DEFAULT })
  useEffect(() => {
    const el = areaRef.current
    if (!el) return
    const compute = () => {
      const w = el.clientWidth || window.innerWidth
      const x = Math.max(40, Math.min(RULER_X_DEFAULT, Math.round(w * 0.05)))
      const y = Math.max(24, Math.min(RULER_Y_DEFAULT, Math.round(w * 0.03)))
      // 相等时保持同一引用，避免画布区尺寸高频变化时无谓重渲染
      setRuler((prev) => (prev.x === x && prev.y === y ? prev : { x, y }))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    window.addEventListener('resize', compute)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', compute)
    }
  }, [])

  // 自适应：fit=true 时按容器尺寸自动缩放；否则使用手动 scale
  // 传入标尺带尺寸，使 fit 出的画布（含标尺框）完整落在 canvas-area 内，不再溢出
  const fitScale = useFitScale(areaRef, pageForFit, ruler.x, ruler.y)
  const fit = page.fit !== false
  const scale = fit ? fitScale : (Number.isFinite(page.scale) ? page.scale : 0.42)

  // 视口在屏幕上的实际像素尺寸（已乘缩放）。
  // 注意：此处刻意保留浮点，不取整——它必须与真实画布显示宽度
  // （page.width * scale，由 .canvas 的 transform 渲染）完全一致，
  // 否则标尺刻度会与画布物理像素产生亚像素漂移、对不齐。
  const vw = pageW * scale
  const vh = pageH * scale

  // 在画布视口的上、左两条专用标尺带上绘制刻度（数值对应页面坐标系）
  const drawRuler = useCallback(() => {
    const paint = (cv: HTMLCanvasElement | null, w: number, h: number, fn: (ctx: CanvasRenderingContext2D) => void) => {
      if (!cv) return
      const dpr = window.devicePixelRatio || 1
      cv.width = Math.round(w * dpr)
      cv.height = Math.round(h * dpr)
      const ctx = cv.getContext('2d')
      if (!ctx) return
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0) // 高清屏适配，保证刻度清晰
      ctx.clearRect(0, 0, w, h)
      fn(ctx)
    }

    const common = {
      minorPerMajor: 5,
      majorLength: 9,
      minorLength: 4,
      majorWidth: 1.4,
      minorWidth: 1,
      majorColor: '#86868b', // 主刻度：较深
      minorColor: '#d2d2d7', // 次刻度：较浅
      labelColor: '#86868b',
      labelFont: '10px -apple-system, "Segoe UI", sans-serif',
      labelOffset: 3,
      direction: 'outward' as const,
      formatLabel: (v: number) => String(Math.round(v)),
    }

    // 上标尺带：水平刻度，数值为页面 X 坐标（基线在带子底部，刻度向上）
    paint(topRulerRef.current, vw, ruler.y, (ctx) => {
      drawAxisTicks(ctx, {
        ...common,
        edge: 'top',
        originX: 0,
        originY: ruler.y,
        width: vw,
        height: ruler.y,
        start: 0,
        end: pageW,
        majorStep: uniformStep(pageW),
      })
    })
    // 下标尺带：水平刻度，数值为页面 X 坐标（基线在带子顶部，刻度向下）
    paint(bottomRulerRef.current, vw, ruler.y, (ctx) => {
      drawAxisTicks(ctx, {
        ...common,
        edge: 'bottom',
        originX: 0,
        originY: -ruler.y,
        width: vw,
        height: ruler.y,
        start: 0,
        end: pageW,
        majorStep: uniformStep(pageW),
      })
    })
    // 左标尺带：垂直刻度，数值为页面 Y 坐标（基线在带子右侧，刻度向左）
    paint(leftRulerRef.current, ruler.x, vh, (ctx) => {
      drawAxisTicks(ctx, {
        ...common,
        edge: 'left',
        originX: ruler.x,
        originY: 0,
        width: ruler.x,
        height: vh,
        start: 0,
        end: pageH,
        majorStep: uniformStep(pageH),
      })
    })
    // 右标尺带：垂直刻度，数值为页面 Y 坐标（基线在带子左侧，刻度向右）
    paint(rightRulerRef.current, ruler.x, vh, (ctx) => {
      drawAxisTicks(ctx, {
        ...common,
        edge: 'right',
        originX: -ruler.x,
        originY: 0,
        width: ruler.x,
        height: vh,
        start: 0,
        end: pageH,
        majorStep: uniformStep(pageH),
      })
    })
  }, [vw, vh, pageW, pageH, ruler.x, ruler.y])

  // 布局/缩放变化后重绘
  useLayoutEffect(() => { drawRuler() }, [drawRuler])
  // 窗口尺寸（含 DPR 变化）变化时重绘
  useEffect(() => {
    window.addEventListener('resize', drawRuler)
    return () => window.removeEventListener('resize', drawRuler)
  }, [drawRuler])

  return (
    <div className="canvas-area" ref={areaRef} onClick={() => select(null)}>
      <div className="canvas-scroll">
        <div
          className="canvas-grid"
          style={
            {
              ['--ruler-x' as string]: `${ruler.x}px`,
              ['--ruler-y' as string]: `${ruler.y}px`,
            } as React.CSSProperties
          }
        >
          <div className="ruler-corner tl" />
          <canvas className="ruler-top" ref={topRulerRef} style={{ width: vw, height: ruler.y }} />
          <div className="ruler-corner tr" />
          <canvas className="ruler-left" ref={leftRulerRef} style={{ width: ruler.x, height: vh }} />
          <div className="canvas-viewport" style={{ width: vw, height: vh }}>
            <div
              ref={canvasRef}
              className="canvas"
              style={{
                width: pageW,
                height: pageH,
                background: page.background,
                transform: `scale(${scale})`
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {page.backgroundImage && <div className="canvas-bg-img" style={bgImageStyle(page)} />}
              {components.map((c) => (
                <ComponentFrame key={c.id} component={c} scale={scale} pageW={pageW} pageH={pageH} />
              ))}
            </div>
          </div>
          <canvas className="ruler-right" ref={rightRulerRef} style={{ width: ruler.x, height: vh }} />
          <div className="ruler-corner bl" />
          <canvas className="ruler-bottom" ref={bottomRulerRef} style={{ width: vw, height: ruler.y }} />
          <div className="ruler-corner br" />
        </div>
      </div>
    </div>
  )
}
