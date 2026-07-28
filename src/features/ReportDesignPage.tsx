import { useState } from 'react'
import { useApi } from './useApi'
import { api } from '../mock'
import { Select } from './common'

interface Cell { value: string }
interface Grid { cols: string[]; rows: Cell[][] }

function emptyGrid(cols: string[], n: number): Grid {
  return { cols, rows: Array.from({ length: n }).map(() => cols.map(() => ({ value: '' }))) }
}

/** 数据报表：Excel 式零代码报表设计 / 数据集驱动自动填充 / AI 智能表格生成 */
export default function ReportDesignPage() {
  const { data: datasets } = useApi(() => api.listDatasets({ pageSize: 20 }), [])
  const [grid, setGrid] = useState<Grid>(emptyGrid(['区域', '销售额', '环比'], 6))
  const [bound, setBound] = useState('')

  const setCell = (r: number, c: number, v: string) => {
    setGrid((g) => {
      const rows = g.rows.map((row, ri) => ri === r ? row.map((cell, ci) => ci === c ? { value: v } : cell) : row)
      return { ...g, rows }
    })
  }
  const addRow = () => setGrid((g) => ({ ...g, rows: [...g.rows, g.cols.map(() => ({ value: '' }))] }))
  const addCol = () => setGrid((g) => ({ cols: [...g.cols, `列${g.cols.length + 1}`], rows: g.rows.map((row) => [...row, { value: '' }]) }))
  // AI 智能生成：用数据集名填充示例数据
  const aiFill = () => {
    const name = datasets?.list?.[0]?.name ?? '报表'
    const src = [['华东', name, '320'], ['华北', name, '210'], ['华南', name, '260'], ['西部', name, '150']]
    setGrid({ cols: ['维度', '指标', '数值'], rows: src.map((row) => row.map((v) => ({ value: v }))) })
  }
  const bind = () => {
    if (!bound) return
    setGrid((g) => ({ ...g, cols: ['维度', '指标'], rows: Array.from({ length: 8 }).map((_, i) => [{ value: `项${i + 1}` }, { value: `来自「${bound}」` }]) }))
  }

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div><h2 className="fp-title">数据报表设计</h2><p className="fp-sub">Excel 式零代码设计 · 数据集驱动自动填充 · AI 智能表格生成 · 与大屏数据源互通</p></div>
        <div className="fp-toolbar">
          <button className="btn sm" onClick={aiFill}>✨ AI 生成</button>
          <button className="btn sm" onClick={addRow}>＋ 行</button>
          <button className="btn sm" onClick={addCol}>＋ 列</button>
        </div>
      </div>
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="flex" style={{ alignItems: 'center' }}>
          <span className="muted2">绑定数据集：</span>
          <Select value={bound} onChange={(e) => setBound(e.target.value)} style={{ width: 220 }}>
            <option value="">不绑定（手动）</option>
            {(datasets?.list ?? []).map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </Select>
          <button className="btn sm" onClick={bind}>自动填充</button>
        </div>
      </div>
      <div className="card" style={{ overflow: 'auto' }}>
        <table className="data-table" style={{ minWidth: 480 }}>
          <thead>
            <tr>{grid.cols.map((c, i) => <th key={i}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {grid.rows.map((row, r) => (
              <tr key={r}>
                {row.map((cell, c) => (
                  <td key={c}>
                    <input className="inp" style={{ padding: '4px 8px' }} value={cell.value}
                      onChange={(e) => setCell(r, c, e.target.value)} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        <div className="muted2" style={{ marginTop: 8 }}>支持专业级打印与导出（PDF / Excel），与大屏数据源互通。</div>
      </div>
    </div>
  )
}
