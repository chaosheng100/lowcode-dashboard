import { useCallback, useMemo, useState } from 'react'
import * as XLSX from 'xlsx'
import { Alert, Button, Checkbox } from 'antd'
import { api } from '../mock'
import type { DatasetRow, ReportDTO } from '../mock/types'
import { useApi } from './useApi'
import { Input, Select } from './common'

interface Grid {
  cols: string[]
  rows: string[][]
}

interface Props {
  item: ReportDTO
  save: (patch: Partial<ReportDTO>) => Promise<void>
}

const SCHEDULES = ['手动', '每日 08:00', '每周一 09:00', '每月 1 日', '每季度首月 1 日']
const FORMATS = [
  { value: 'xlsx', label: 'Excel (.xlsx)' },
  { value: 'pdf', label: 'PDF' },
  { value: 'csv', label: 'CSV' }
]
const DELIVERY = ['邮件', '企业微信', '钉钉']

function isNumeric(value: string) {
  return value.trim() !== '' && Number.isFinite(Number(value))
}

function rowsFromDataset(rows: DatasetRow[]) {
  if (!rows.length) return { cols: ['字段', '数值'], rows: [['', '']] }
  const cols = Object.keys(rows[0])
  return { cols, rows: rows.map((row) => cols.map((col) => String(row[col] ?? ''))) }
}

export default function ReportDesignPage({ item, save }: Props) {
  const { data: datasets } = useApi(() => api.listDatasets({ pageSize: 50 }), [])
  const [name, setName] = useState(item.name)
  const [title, setTitle] = useState(item.design.title || item.name)
  const [subtitle, setSubtitle] = useState(item.design.subtitle)
  const [sourceId, setSourceId] = useState(item.sourceId)
  const [schedule, setSchedule] = useState(item.schedule)
  const [status, setStatus] = useState(item.status)
  const [formats, setFormats] = useState(item.format)
  const [delivery, setDelivery] = useState(item.delivery)
  const [grid, setGrid] = useState<Grid>({ cols: item.design.columns, rows: item.design.rows })
  const [saving, setSaving] = useState(false)
  const [loadingData, setLoadingData] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const selectedDataset = datasets?.list.find((dataset) => dataset.id === sourceId)
  const summary = useMemo(() => grid.cols.map((_, columnIndex) => {
    const values = grid.rows.map((row) => row[columnIndex]).filter(isNumeric).map(Number)
    return values.length ? String(values.reduce((sum, value) => sum + value, 0)) : ''
  }), [grid])

  const setCell = (rowIndex: number, columnIndex: number, value: string) => {
    setGrid((current) => ({
      ...current,
      rows: current.rows.map((row, index) => index === rowIndex
        ? row.map((cell, cellIndex) => cellIndex === columnIndex ? value : cell)
        : row)
    }))
  }

  const setColumn = (columnIndex: number, value: string) => {
    setGrid((current) => ({ ...current, cols: current.cols.map((col, index) => index === columnIndex ? value : col) }))
  }

  const addRow = () => setGrid((current) => ({ ...current, rows: [...current.rows, current.cols.map(() => '')] }))
  const addColumn = () => setGrid((current) => ({
    cols: [...current.cols, `列 ${current.cols.length + 1}`],
    rows: current.rows.map((row) => [...row, ''])
  }))
  const deleteRow = (rowIndex: number) => {
    if (grid.rows.length <= 1) return
    setGrid((current) => ({ ...current, rows: current.rows.filter((_, index) => index !== rowIndex) }))
  }
  const deleteColumn = (columnIndex: number) => {
    if (grid.cols.length <= 1) return
    setGrid((current) => ({
      cols: current.cols.filter((_, index) => index !== columnIndex),
      rows: current.rows.map((row) => row.filter((_, index) => index !== columnIndex))
    }))
  }

  const loadDataset = async () => {
    if (!sourceId) {
      setError('请先选择数据集')
      return
    }
    setLoadingData(true)
    setError('')
    try {
      const response = await api.queryDataset(sourceId, { pageSize: 12 })
      if (response.code !== 0) throw new Error(response.message)
      setGrid(rowsFromDataset(response.data.list))
      setMessage(`已载入 ${response.data.list.length} 行预览数据`)
    } catch (reason) {
      setError(`载入数据失败：${String(reason)}`)
    } finally {
      setLoadingData(false)
    }
  }

  const intelligentFill = () => {
    const metric = selectedDataset?.name || '经营指标'
    const values = ['320', '210', '260', '150', '180', '95']
    setGrid({
      cols: ['区域', '指标', '数值'],
      rows: ['华东', '华北', '华南', '西部', '华中', '东北'].map((region, index) => [region, metric, values[index]])
    })
    setMessage('已根据当前数据集生成报表结构')
  }

  const doSave = async () => {
    setError('')
    setMessage('')
    if (!name.trim()) {
      setError('报表名称不能为空')
      return
    }
    if (!title.trim()) {
      setError('报表标题不能为空')
      return
    }
    if (grid.cols.some((column) => !column.trim())) {
      setError('字段名称不能为空')
      return
    }
    if (!formats.length) {
      setError('请至少选择一种导出格式')
      return
    }

    setSaving(true)
    try {
      await save({
        name: name.trim(),
        sourceId,
        sourceName: selectedDataset?.name || '',
        schedule,
        status,
        format: formats,
        delivery,
        design: { title: title.trim(), subtitle: subtitle.trim(), columns: grid.cols, rows: grid.rows }
      })
      setMessage('报表配置已保存')
    } catch (reason) {
      setError(`保存失败：${String(reason)}`)
    } finally {
      setSaving(false)
    }
  }

  const exportExcel = useCallback(() => {
    const rows: (string | number)[][] = [[title], [subtitle], [], grid.cols, ...grid.rows]
    if (summary.some(Boolean)) rows.push(['合计', ...summary.slice(1)])
    const sheet = XLSX.utils.aoa_to_sheet(rows)
    sheet['!cols'] = grid.cols.map((column) => ({ wch: Math.max(12, column.length * 2 + 4) }))
    sheet['!merges'] = [0, 1].map((row) => ({ s: { r: row, c: 0 }, e: { r: row, c: grid.cols.length - 1 } }))
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, sheet, '报表')
    XLSX.writeFile(workbook, `${safeFileName(title || name)}_${today()}.xlsx`)
  }, [grid, name, subtitle, summary, title])

  const exportCSV = useCallback(() => {
    const values = [grid.cols, ...grid.rows]
    const content = values.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(',')).join('\n')
    downloadBlob('\uFEFF' + content, `${safeFileName(title || name)}_${today()}.csv`, 'text/csv;charset=utf-8')
  }, [grid, name, title])

  const exportPDF = useCallback(() => {
    const child = window.open('', '_blank')
    if (!child) {
      setError('浏览器阻止了打印窗口，请允许弹窗后重试')
      return
    }
    const head = grid.cols.map((column) => `<th>${escapeHtml(column)}</th>`).join('')
    const body = grid.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')
    child.document.write(`<!doctype html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${escapeHtml(title)}</title><style>
      @page{size:A4;margin:18mm 15mm}body{font-family:"Microsoft YaHei",sans-serif;color:#182235}h1{text-align:center;font-size:22px;margin:0 0 6px}.sub{text-align:center;color:#667085;margin-bottom:20px}table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cfd7e3;padding:7px 9px;text-align:left}th{background:#eef3f8}.foot{text-align:right;color:#7b8798;font-size:10px;margin-top:16px}</style></head><body><h1>${escapeHtml(title)}</h1><div class="sub">${escapeHtml(subtitle)}</div><table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table><div class="foot">生成时间：${new Date().toLocaleString('zh-CN')}</div></body></html>`)
    child.document.close()
    child.focus()
    window.setTimeout(() => child.print(), 250)
  }, [grid, subtitle, title])

  return (
    <div className="report-designer">
      <header className="rd-head">
        <div>
          <h2>报表设计</h2>
          <p>配置数据、字段、导出与定时投递</p>
        </div>
        <div className="rd-actions">
          <Button onClick={intelligentFill}>智能生成</Button>
          <Button type="primary" loading={saving} onClick={doSave}>保存报表</Button>
        </div>
      </header>

      {(message || error) && (
        <Alert
          closable
          type={error ? 'error' : 'success'}
          message={error || message}
          onClose={() => { setMessage(''); setError('') }}
          style={{ marginBottom: 10 }}
        />
      )}

      <div className="rd-layout">
        <aside className="rd-settings" aria-label="报表设置">
          <section className="rd-section">
            <h3>基础信息</h3>
            <label className="rd-field"><span>管理名称</span><Input value={name} onChange={(event) => setName(event.target.value)} /></label>
            <label className="rd-field"><span>报表标题</span><Input value={title} onChange={(event) => setTitle(event.target.value)} /></label>
            <label className="rd-field"><span>副标题</span><Input value={subtitle} onChange={(event) => setSubtitle(event.target.value)} placeholder="选填" /></label>
          </section>

          <section className="rd-section">
            <h3>数据绑定</h3>
            <label className="rd-field">
              <span>数据集</span>
              <Select value={sourceId} onChange={(event) => setSourceId(event.target.value)}>
                <option value="">手动维护</option>
                {(datasets?.list ?? []).map((dataset) => <option key={dataset.id} value={dataset.id}>{dataset.name}</option>)}
              </Select>
            </label>
            <Button block loading={loadingData} disabled={!sourceId} onClick={loadDataset}>载入预览数据</Button>
          </section>

          <section className="rd-section">
            <h3>导出格式</h3>
            <Checkbox.Group
              options={FORMATS}
              value={formats}
              onChange={(vals) => setFormats(vals as string[])}
            />
          </section>

          <section className="rd-section">
            <h3>调度与投递</h3>
            <label className="rd-field"><span>执行计划</span><Select value={schedule} onChange={(event) => setSchedule(event.target.value)}>{SCHEDULES.map((value) => <option key={value}>{value}</option>)}</Select></label>
            <label className="rd-field"><span>任务状态</span><Select value={status} onChange={(event) => setStatus(event.target.value as ReportDTO['status'])}><option value="enabled">已启用</option><option value="paused">已暂停</option></Select></label>
            <Checkbox.Group
              options={DELIVERY}
              value={delivery}
              onChange={(vals) => setDelivery(vals as string[])}
            />
          </section>
        </aside>

        <main className="rd-workspace">
          <div className="rd-table-toolbar">
            <div><strong>字段与数据</strong><span>{grid.rows.length} 行 / {grid.cols.length} 列</span></div>
            <div>
              <Button size="small" onClick={addRow}>添加行</Button>
              <Button size="small" onClick={addColumn}>添加列</Button>
            </div>
          </div>
          <div className="rd-sheet-wrap">
            <table className="rd-sheet">
              <thead>
                <tr>
                  <th className="rd-index">#</th>
                  {grid.cols.map((column, columnIndex) => (
                    <th key={columnIndex}>
                      <div className="rd-col-head">
                        <input aria-label={`第 ${columnIndex + 1} 列名称`} value={column} onChange={(event) => setColumn(columnIndex, event.target.value)} />
                        <button type="button" aria-label={`删除第 ${columnIndex + 1} 列`} title="删除列" disabled={grid.cols.length <= 1} onClick={() => deleteColumn(columnIndex)}>×</button>
                      </div>
                    </th>
                  ))}
                  <th className="rd-row-action" />
                </tr>
              </thead>
              <tbody>
                {grid.rows.map((row, rowIndex) => (
                  <tr key={rowIndex}>
                    <td className="rd-index">{rowIndex + 1}</td>
                    {row.map((cell, columnIndex) => (
                      <td key={columnIndex}><input className={isNumeric(cell) ? 'numeric' : ''} aria-label={`第 ${rowIndex + 1} 行第 ${columnIndex + 1} 列`} value={cell} onChange={(event) => setCell(rowIndex, columnIndex, event.target.value)} /></td>
                    ))}
                    <td className="rd-row-action"><button type="button" aria-label={`删除第 ${rowIndex + 1} 行`} title="删除行" disabled={grid.rows.length <= 1} onClick={() => deleteRow(rowIndex)}>×</button></td>
                  </tr>
                ))}
              </tbody>
              {summary.some(Boolean) && <tfoot><tr><td className="rd-index">Σ</td>{summary.map((value, index) => <td key={index}>{value}</td>)}<td /></tr></tfoot>}
            </table>
          </div>
          <footer className="rd-export-bar">
            <span>即时导出当前编辑内容</span>
            <div>
              <Button size="small" onClick={exportExcel}>导出 Excel</Button>
              <Button size="small" onClick={exportPDF}>导出 PDF</Button>
              <Button size="small" onClick={exportCSV}>导出 CSV</Button>
            </div>
          </footer>
        </main>
      </div>
    </div>
  )
}

function safeFileName(value: string) {
  return value.replace(/[\\/:*?"<>|]/g, '_') || '报表'
}

function today() {
  return new Date().toISOString().slice(0, 10)
}

function downloadBlob(content: string, fileName: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }))
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.click()
  URL.revokeObjectURL(url)
}

function escapeHtml(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
}
