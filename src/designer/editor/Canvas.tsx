import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import WidgetRenderer from '../widgets/WidgetRenderer'
import { useFitScale } from './useFitScale'
import { drawAxisTicks, uniformStep } from './ruler'
import { bgImageStyle } from './background'
import type { ComponentInstance, RouteConfig } from '../../data/types'

/** 标尺带默认尺寸：左右带较宽（容纳竖向坐标数字如 1080），上下带较扁 */
const RULER_X_DEFAULT = 46
const RULER_Y_DEFAULT = 28

function ComponentFrame({ component, scale }: { component: ComponentInstance; scale: number }) {
  const selectedId = useDesignerStore((s) => s.selectedId)
  const select = useDesignerStore((s) => s.select)
  const moveComponent = useDesignerStore((s) => s.moveComponent)
  const updateComponentStyle = useDesignerStore((s) => s.updateComponentStyle)

  const onPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).classList.contains('resize-handle')) return
    e.stopPropagation()
    select(component.id)
    const startX = e.clientX
    const startY = e.clientY
    const ox = component.style.x
    const oy = component.style.y
    const move = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) / scale
      const dy = (ev.clientY - startY) / scale
      moveComponent(component.id, ox + dx, oy + dy)
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const onResizeDown = (e: React.PointerEvent) => {
    e.stopPropagation()
    const startX = e.clientX
    const startY = e.clientY
    const ow = component.style.w
    const oh = component.style.h
    const move = (ev: PointerEvent) => {
      const dw = (ev.clientX - startX) / scale
      const dh = (ev.clientY - startY) / scale
      updateComponentStyle(component.id, {
        w: Math.max(40, ow + dw),
        h: Math.max(30, oh + dh)
      })
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
  }

  const selected = selectedId === component.id
  return (
    <div
      className={'comp-frame' + (selected ? ' selected' : '')}
      style={{
        left: component.style.x,
        top: component.style.y,
        width: component.style.w,
        height: component.style.h
      }}
      onPointerDown={onPointerDown}
    >
      <WidgetRenderer component={component} filter={null} onPick={null} />
      {selected && <div className="resize-handle" onPointerDown={onResizeDown} />}
    </div>
  )
}

export default function Canvas() {
  const route = useDesignerStore(
    (s) => s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0]
  )! as RouteConfig
  const components = route.components
  const page = route.page
  const addComponent = useDesignerStore((s) => s.addComponent)
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
  const fitScale = useFitScale(areaRef, page, ruler.x, ruler.y)
  const scale = page.fit ? fitScale : page.scale

  // 视口在屏幕上的实际像素尺寸（已乘缩放）。
  // 注意：此处刻意保留浮点，不取整——它必须与真实画布显示宽度
  // （page.width * scale，由 .canvas 的 transform 渲染）完全一致，
  // 否则标尺刻度会与画布物理像素产生亚像素漂移、对不齐。
  const vw = page.width * scale
  const vh = page.height * scale

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
      majorColor: '#7c8a99', // 主刻度：较深
      minorColor: '#2f3a47', // 次刻度：较浅
      labelColor: '#8a97a5',
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
        end: page.width,
        majorStep: uniformStep(page.width),
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
        end: page.width,
        majorStep: uniformStep(page.width),
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
        end: page.height,
        majorStep: uniformStep(page.height),
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
        end: page.height,
        majorStep: uniformStep(page.height),
      })
    })
  }, [vw, vh, page.width, page.height, ruler.x, ruler.y])

  // 布局/缩放变化后重绘
  useLayoutEffect(() => { drawRuler() }, [drawRuler])
  // 窗口尺寸（含 DPR 变化）变化时重绘
  useEffect(() => {
    window.addEventListener('resize', drawRuler)
    return () => window.removeEventListener('resize', drawRuler)
  }, [drawRuler])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
  )

  const onDragEnd = (event: DragEndEvent) => {
    const type = (event.active.data.current as
      | { type?: ComponentInstance['type'] }
      | undefined)?.type
    if (!type || !canvasRef.current || !event.activatorEvent) return
    const rect = canvasRef.current.getBoundingClientRect()
    const ev = event.activatorEvent as PointerEvent
    const x = (ev.clientX - rect.left) / scale - 30
    const y = (ev.clientY - rect.top) / scale - 20
    addComponent(type, {
      x: Math.max(0, Math.min(x, page.width - 40)),
      y: Math.max(0, Math.min(y, page.height - 40))
    })
  }

  return (
    <DndContext sensors={sensors} onDragEnd={onDragEnd}>
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
                width: page.width,
                height: page.height,
                background: page.background,
                transform: `scale(${scale})`
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {page.backgroundImage && <div className="canvas-bg-img" style={bgImageStyle(page)} />}
              {components.map((c) => (
                <ComponentFrame key={c.id} component={c} scale={scale} />
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
    </DndContext>
  )
}
