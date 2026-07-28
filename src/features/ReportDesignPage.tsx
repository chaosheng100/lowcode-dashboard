import { useState, useRef, useCallback } from 'react'
import * as XLSX from 'xlsx'
import { useApi } from './useApi'
import { api } from '../mock'
import { Select, Input } from './common'
import type { ChangeEvent } from 'react'

interface Cell { value: string }
interface Grid { cols: string[]; rows: Cell[][] }

function emptyGrid(cols: string[], n: number): Grid {
  return { cols, rows: Array.from({ length: n }).map(() => cols.map(() => ({ value: '' }))) }
}

/** 判断是否数字 */
function isNumeric(v: string): boolean {
  if (!v.trim()) return false
  return !isNaN(Number(v))
}

/**
 * 数据报表设计器
 * 功能：Excel 式零代码设计 / 数据集驱动 / AI 生成 / 专业级 Excel+PDF 导出
 */
export default function ReportDesignPage() {
  const { data: datasets } = useApi(() => api.listDatasets({ pageSize: 20 }), [])
  const [grid, setGrid] = useState<Grid>(emptyGrid(['区域', '销售额', '环比'], 6))
  const [bound, setBound] = useState('')
  const [reportTitle, setReportTitle] = useState('数据分析报表')
  const [reportSubtitle, setReportSubtitle] = useState(new Date().toLocaleDateString('zh-CN'))
  const printAreaRef = useRef<HTMLDivElement>(null)

  // ---- 编辑 ----
  const setCell = (r: number, c: number, v: string) => {
    setGrid((g) => {
      const rows = g.rows.map((row, ri) => ri === r ? row.map((cell, ci) => ci === c ? { value: v } : cell) : row)
      return { ...g, rows }
    })
  }
  const setColHeader = (c: number, v: string) => {
    setGrid((g) => ({ ...g, cols: g.cols.map((col, i) => i === c ? v : col) }))
  }
  const addRow = () => setGrid((g) => ({ ...g, rows: [...g.rows, g.cols.map(() => ({ value: '' }))] }))
  const addCol = () => setGrid((g) => ({ cols: [...g.cols, `列${g.cols.length + 1}`], rows: g.rows.map((row) => [...row, { value: '' }]) }))
  const delRow = (r: number) => setGrid((g) => ({ ...g, rows: g.rows.filter((_, i) => i !== r) }))
  const delCol = (c: number) => setGrid((g) => ({ cols: g.cols.filter((_, i) => i !== c), rows: g.rows.map((row) => row.filter((_, i) => i !== c)) }))

  const aiFill = () => {
    const name = datasets?.list?.[0]?.name ?? '报表'
    const src = [['华东', name, '320'], ['华北', name, '210'], ['华南', name, '260'], ['西部', name, '150'], ['华中', name, '180'], ['东北', name, '95']]
    setGrid({ cols: ['维度', '指标', '数值'], rows: src.map((row) => row.map((v) => ({ value: v }))) })
  }
  const bind = () => {
    if (!bound) return
    setGrid((g) => ({ ...g, cols: ['维度', '指标'], rows: Array.from({ length: 8 }).map((_, i) => [{ value: `项${i + 1}` }, { value: `来自「${bound}」` }]) }))
  }

  // ---- 汇总行 ----
  const summary = grid.cols.map((_, ci) => {
    const vals = grid.rows.map((r) => r[ci].value).filter(isNumeric).map(Number)
    if (vals.length === 0) return ''
    return String(vals.reduce((a, b) => a + b, 0))
  })

  // ---- Excel 导出（SheetJS） ----
  const exportExcel = useCallback(() => {
    const aoa: (string | number)[][] = []
    aoa.push([reportTitle])
    aoa.push([reportSubtitle])
    aoa.push([])
    aoa.push(grid.cols)
    grid.rows.forEach((row) => { aoa.push(row.map((c) => c.value)) })
    // 汇总行
    const hasSummary = summary.some((s) => s !== '')
    if (hasSummary) { aoa.push(['合计', ...summary.slice(1)]) }
    aoa.push([])
    aoa.push(['生成时间', new Date().toLocaleString('zh-CN')])

    const ws = XLSX.utils.aoa_to_sheet(aoa)
    // 列宽
    ws['!cols'] = grid.cols.map((c) => ({ wch: Math.max(12, c.length * 2 + 4) }))
    // 合并标题
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: grid.cols.length - 1 } },
      { s: { r: 1, c: 0 }, e: { r: 1, c: grid.cols.length - 1 } }
    ]

    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, '报表')
    const fname = `${reportTitle || '报表'}_${new Date().toISOString().slice(0, 10)}.xlsx`
    XLSX.writeFile(wb, fname)
  }, [grid, reportTitle, reportSubtitle, summary])

  // ---- PDF 导出（打印样式 → window.print，浏览器另存为 PDF） ----
  const exportPDF = useCallback(() => {
    const hasSummary = summary.some((s) => s !== '')
    const rowsHtml = grid.rows.map((row) =>
      '<tr>' + row.map((c) => `<td>${escapeHtml(c.value)}</td>`).join('') + '</tr>'
    ).join('')
    const summaryHtml = hasSummary
      ? '<tr class="sum-row"><td>合计</td>' + summary.slice(1).map((s) => `<td>${escapeHtml(s)}</td>`).join('') + '</tr>'
      : ''
    const colsHtml = grid.cols.map((c) => `<th>${escapeHtml(c)}</th>`).join('')

    const html = `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"/>
<title>${escapeHtml(reportTitle)}</title>
<style>
@page { size: A4; margin: 18mm 15mm; }
* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: "Microsoft YaHei", "PingFang SC", system-ui, sans-serif; color: #1a1a2e; }
.report-head { text-align: center; margin-bottom: 16px; border-bottom: 2px solid #333; padding-bottom: 10px; }
.report-head h1 { font-size: 20px; font-weight: 700; }
.report-head .sub { font-size: 12px; color: #666; margin-top: 4px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; }
th, td { border: 1px solid #ccc; padding: 6px 8px; text-align: center; }
th { background: #f0f4f8; font-weight: 600; color: #2a3b52; }
tr:nth-child(even) td { background: #fafbfc; }
.sum-row td { background: #e8f0fe !important; font-weight: 700; color: #1a3a6e; }
.report-foot { margin-top: 16px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 10px; color: #999; text-align: right; }
</style></head><body>
<div class="report-head">
  <h1>${escapeHtml(reportTitle)}</h1>
  <div class="sub">${escapeHtml(reportSubtitle)}</div>
</div>
<table>
  <thead><tr>${colsHtml}</tr></thead>
  <tbody>${rowsHtml}${summaryHtml}</tbody>
</table>
<div class="report-foot">生成时间：${new Date().toLocaleString('zh-CN')} · 数据报表系统</div>
</body></html>`

    const w = window.open('', '_blank')
    if (!w) { alert('请允许弹出窗口以导出 PDF'); return }
    w.document.write(html)
    w.document.close()
    w.focus()
    setTimeout(() => { w.print() }, 300)
  }, [grid, reportTitle, reportSubtitle, summary])

  // ---- CSV 导出 ----
  const exportCSV = useCallback(() => {
    const lines = [grid.cols.join(','), ...grid.rows.map((r) => r.map((c) => `"${c.value.replace(/"/g, '""')}"`).join(','))]
    const blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${reportTitle || '报表'}_${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }, [grid, reportTitle])

  const onTitleChange = (e: ChangeEvent<HTMLInputElement>) => setReportTitle(e.target.value)
  const onSubtitleChange = (e: ChangeEvent<HTMLInputElement>) => setReportSubtitle(e.target.value)

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">数据报表设计</h2>
          <p className="fp-sub">Excel 式零代码设计 · 数据集驱动 · AI 生成 · 专业级 Excel/PDF/CSV 导出</p>
        </div>
        <div className="fp-toolbar">
          <button className="btn sm" onClick={aiFill}>✨ AI 生成</button>
          <button className="btn sm" onClick={addRow}>＋ 行</button>
          <button className="btn sm" onClick={addCol}>＋ 列</button>
        </div>
      </div>

      {/* 报表元信息 + 导出 */}
      <div className="card" style={{ marginBottom: 12 }}>
        <div className="grid2">
          <div className="field">
            <span className="field-label">报表标题</span>
            <Input value={reportTitle} onChange={onTitleChange} placeholder="报表标题" />
          </div>
          <div className="field">
            <span className="field-label">副标题/日期</span>
            <Input value={reportSubtitle} onChange={onSubtitleChange} placeholder="副标题" />
          </div>
        </div>
        <div className="flex" style={{ alignItems: 'center', marginTop: 4 }}>
          <span className="muted2">绑定数据集：</span>
          <Select value={bound} onChange={(e) => setBound(e.target.value)} style={{ width: 200 }}>
            <option value="">不绑定（手动）</option>
            {(datasets?.list ?? []).map((d) => <option key={d.id} value={d.name}>{d.name}</option>)}
          </Select>
          <button className="btn sm" onClick={bind}>自动填充</button>
          <div style={{ flex: 1 }} />
          <button className="btn sm" onClick={exportExcel} title="导出 .xlsx 文件">📊 导出 Excel</button>
          <button className="btn sm" onClick={exportPDF} title="打印 / 另存为 PDF">📄 导出 PDF</button>
          <button className="btn sm" onClick={exportCSV} title="导出 CSV">📋 导出 CSV</button>
        </div>
      </div>

      {/* 报表编辑区 */}
      <div className="card" style={{ overflow: 'auto' }} ref={printAreaRef}>
        <table className="data-table" style={{ minWidth: 480 }}>
          <thead>
            <tr>
              <th style={{ width: 36, textAlign: 'center' }}>#</th>
              {grid.cols.map((c, i) => (
                <th key={i}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                    <input
                      className="inp" style={{ padding: '2px 6px', fontWeight: 600, textAlign: 'center' }}
                      value={c} onChange={(e) => setColHeader(i, e.target.value)}
                    />
                    <button className="icon-btn" style={{ fontSize: 14 }} onClick={() => delCol(i)} title="删除列">✕</button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rows.map((row, r) => (
              <tr key={r}>
                <td className="muted" style={{ textAlign: 'center', fontSize: 11 }}>{r + 1}</td>
                {row.map((cell, c) => (
                  <td key={c}>
                    <input
                      className="inp"
                      style={isNumeric(cell.value) ? { padding: '4px 8px', textAlign: 'right', color: '#4ade80' } : { padding: '4px 8px' }}
                      value={cell.value}
                      onChange={(e) => setCell(r, c, e.target.value)}
                    />
                  </td>
                ))}
                <td style={{ width: 36, textAlign: 'center' }}>
                  <button className="icon-btn" style={{ fontSize: 14 }} onClick={() => delRow(r)} title="删除行">✕</button>
                </td>
              </tr>
            ))}
          </tbody>
          {summary.some((s) => s !== '') && (
            <tfoot>
              <tr style={{ background: '#16243a' }}>
                <td className="muted" style={{ textAlign: 'center', fontSize: 11 }}>Σ</td>
                {summary.map((s, i) => (
                  <td key={i} style={{ fontWeight: 700, color: '#4ade80', textAlign: i === 0 ? 'center' : 'right' }}>{s}</td>
                ))}
                <td />
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      <div className="muted2" style={{ marginTop: 8 }}>
        导出说明：Excel 导出为 .xlsx 文件（含标题/副标题/合计行/生成时间）；PDF 导出通过浏览器打印窗口另存为 PDF（A4 页面，含页眉页脚）；
        CSV 导出为 UTF-8 编码（含 BOM，Excel 直接打开不乱码）。数据与大屏数据源互通。
      </div>
    </div>
  )
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
