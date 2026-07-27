import { useState } from 'react'
import { api } from '../mock'
import type { DatasetDTO, DatasetRow, PageResult } from '../mock'
import { useApi, useDebounced } from './useApi'

export default function DatasetManagement() {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 8
  const debounced = useDebounced(keyword, 300)

  const listState = useApi<PageResult<DatasetDTO>>(
    () => api.listDatasets({ keyword: debounced, page, pageSize }),
    [debounced, page]
  )

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const selected = listState.data?.list.find((d) => d.id === selectedId) || null
  const queryState = useApi<{ list: DatasetRow[]; total: number }>(
    () => (selectedId ? api.queryDataset(selectedId, { pageSize: 12 }) : Promise.resolve({ code: 0, message: 'ok', data: { list: [], total: 0 } })),
    [selectedId]
  )

  const rows = listState.data?.list ?? []
  const total = listState.data?.total ?? 0
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">数据集管理</h2>
          <p className="fp-sub">基于数据源构建可复用数据集，供大屏与报表消费</p>
        </div>
        <span className="fp-count">共 {total} 个数据集</span>
      </div>

      <div className="fp-toolbar">
        <input
          className="search"
          placeholder="搜索数据集 / 来源"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value)
            setPage(1)
          }}
        />
        <button className="btn" onClick={() => listState.reload()}>
          刷新
        </button>
      </div>

      <div className="ds-layout">
        <div className="ds-list">
          {listState.loading && <div className="fp-loading">加载中…</div>}
          {listState.error && <div className="fp-error">加载失败：{listState.error}</div>}
          {!listState.loading && !listState.error && (
            <table className="data-table">
              <thead>
                <tr>
                  <th>数据集</th>
                  <th>来源</th>
                  <th>行数</th>
                  <th>更新</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={4} className="fp-empty">
                      无匹配数据集
                    </td>
                  </tr>
                )}
                {rows.map((d) => (
                  <tr
                    key={d.id}
                    className={'clickable' + (d.id === selectedId ? ' active' : '')}
                    onClick={() => setSelectedId(d.id)}
                  >
                    <td>{d.name}</td>
                    <td className="muted">{d.sourceName}</td>
                    <td className="muted">{d.rowCount.toLocaleString()}</td>
                    <td className="muted">{d.updatedAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="pager">
            <button className="btn sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
              上一页
            </button>
            <span>
              第 {page} / {totalPages} 页
            </span>
            <button className="btn sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
              下一页
            </button>
          </div>
        </div>

        <div className="ds-detail">
          <h3 className="ds-detail-title">
            {selected ? `数据预览 · ${selected.name}` : '数据预览'}
          </h3>
          {!selected && <div className="fp-empty">从左侧选择一个数据集查看采样数据</div>}
          {selected && queryState.loading && <div className="fp-loading">查询中…</div>}
          {selected && queryState.error && <div className="fp-error">查询失败：{queryState.error}</div>}
          {selected && !queryState.loading && !queryState.error && (
            <table className="data-table">
              <thead>
                <tr>
                  {selected.schema.map((f) => (
                    <th key={f.field}>{f.field}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {queryState.data?.list.map((row, i) => (
                  <tr key={i}>
                    {selected.schema.map((f) => (
                      <td key={f.field} className={String(row[f.field]) === 'true' ? 'abnormal' : ''}>
                        {String(row[f.field])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  )
}
