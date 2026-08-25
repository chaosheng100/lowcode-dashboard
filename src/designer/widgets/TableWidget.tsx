import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { isActive } from './filterUtils'
import type { WidgetViewProps } from '../../data/types'

type ColumnConfig = string | { key?: string; title?: string; label?: string; name?: string; dataSetFieldKey?: string }

// 表头/列可能是字符串数组，也可能是 { name, key } 对象数组（如 AI 生成的 schema），统一取可读文本
function cellText(c: unknown): string {
  if (typeof c === 'string') return c
  if (c && typeof c === 'object') {
    const o = c as Record<string, unknown>
    return String(o.name ?? o.label ?? o.key ?? o.title ?? '')
  }
  return c == null ? '' : String(c)
}

export default function TableWidget({ component, filter, onPick, fieldLabelMap, preview }: WidgetViewProps) {
  const { title, columns, data, filterField, interactive, hiddenColumns, scroll, scrollSpeed, visibleRows, pauseOnHover } = component.props
  const rows: Array<Record<string, unknown>> = Array.isArray(data) ? data as Array<Record<string, unknown>> : []
  const rawCols: ColumnConfig[] = Array.isArray(columns) && columns.length ? columns : ['名称', '数值']
  const hiddenSet = new Set(hiddenColumns ?? [])
  // 全部列都被隐藏时保留默认列，避免出现空表头
  const visibleCols: ColumnConfig[] = rawCols.filter((col) => {
    if (typeof col === 'string') return !hiddenSet.has(col)
    return !hiddenSet.has(String(col.key ?? col.dataSetFieldKey ?? ''))
  })
  const fallbackCols: ColumnConfig[] = visibleCols.length ? visibleCols : ['名称', '数值']
  const scrollEnabled = !!preview && !!scroll
  const visibleRowsCount = Math.max(1, Math.round(Number(visibleRows) || 6))
  const animate = scrollEnabled && rows.length > visibleRowsCount
  const trackRef = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const hoveredRef = useRef(false)
  const [bodyHeight, setBodyHeight] = useState<number | undefined>()

  const columnKey = (col: ColumnConfig): string =>
    typeof col === 'string' ? col : String(col.key ?? col.dataSetFieldKey ?? '')

  const headerText = (col: ColumnConfig) => {
    if (typeof col === 'string') return col
    if (col.dataSetFieldKey && fieldLabelMap?.[col.dataSetFieldKey]) {
      return fieldLabelMap[col.dataSetFieldKey]
    }
    return cellText(col)
  }

  const renderCell = (row: Record<string, unknown>, col: ColumnConfig, index: number) => {
    const key = columnKey(col)
    const value = key ? row[key] : index === 0 ? row.name : row.value
    if (typeof value === 'number') return value.toLocaleString()
    return value == null ? '' : String(value)
  }

  const pickValue = (row: Record<string, unknown>) => {
    const value = row.name ?? row[Object.keys(row)[0]]
    return value == null ? '' : String(value)
  }

  const renderRow = (r: Record<string, unknown>, i: number, set: number) => {
    const active = isActive(r, filter)
    return (
      <tr
        key={`${set}-${i}`}
        className={(interactive ? 'clickable ' : '') + (active ? 'active' : '')}
        onClick={
          interactive && onPick
            ? () => onPick({ field: filterField ?? 'name', value: pickValue(r) })
            : undefined
        }
      >
        {fallbackCols.map((col, j) => (
          <td key={j}>{renderCell(r, col, j)}</td>
        ))}
      </tr>
    )
  }

  // 滚动模式下按 visibleRows 计算可视区高度；数据变化后重新测量
  useLayoutEffect(() => {
    if (!scrollEnabled || !trackRef.current) {
      setBodyHeight(undefined)
      return
    }
    const track = trackRef.current
    const firstRow = track.querySelector('tbody tr') as HTMLElement | null
    const rowHeight = firstRow?.offsetHeight || 28
    const totalHeight = track.offsetHeight / 2
    const next = Math.min(Math.max(rowHeight * visibleRowsCount, rowHeight), totalHeight)
    setBodyHeight((prev) => (prev === next ? prev : next))
  }, [scrollEnabled, rows, fallbackCols, visibleRowsCount])

  // 预览/发布态匀速滚动；复制一份行实现到末尾无缝回到开头
  useEffect(() => {
    if (!animate || !trackRef.current) return
    const speed = Math.max(5, Number(scrollSpeed) || 30)
    const track = trackRef.current
    let offset = 0
    let last = performance.now()
    const tick = (now: number) => {
      const dt = Math.min(64, now - last)
      last = now
      if (!hoveredRef.current) {
        offset += (speed * dt) / 1000
        const half = track.offsetHeight / 2
        if (half > 0 && offset >= half) offset -= half
        track.style.transform = `translateY(${-offset}px)`
      }
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [animate, rows, scrollSpeed])

  useEffect(() => () => cancelAnimationFrame(rafRef.current), [])

  if (!scrollEnabled) {
    return (
      <div className="w-table">
        {title ? (
          <div style={{ color: '#9aa7b4', fontSize: 12, marginBottom: 6 }}>{title}</div>
        ) : null}
        <table>
          <thead>
            <tr>
              {fallbackCols.map((col, i) => (
                <th key={i}>{headerText(col)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => renderRow(r, i, 0))}
          </tbody>
        </table>
      </div>
    )
  }

  return (
    <div className="w-table w-table-scroll">
      {title ? (
        <div style={{ color: '#9aa7b4', fontSize: 12, marginBottom: 6 }}>{title}</div>
      ) : null}
      <div className="w-table-head">
        <table>
          <thead>
            <tr>
              {fallbackCols.map((col, i) => (
                <th key={i}>{headerText(col)}</th>
              ))}
            </tr>
          </thead>
        </table>
      </div>
      <div
        className="w-table-body"
        style={{ height: bodyHeight }}
        onMouseEnter={() => {
          if (pauseOnHover) hoveredRef.current = true
        }}
        onMouseLeave={() => {
          hoveredRef.current = false
        }}
      >
        <div className="w-table-track" ref={trackRef}>
          <table>
            <tbody>
              {rows.map((r, i) => renderRow(r, i, 0))}
              {rows.map((r, i) => renderRow(r, i, 1))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
