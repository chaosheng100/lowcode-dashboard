import { useState } from 'react'
import { Alert, Button, Input, Table, type TableProps } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { api } from '../mock'
import type { DatasetDTO, DatasetRow, PageResult } from '../mock'
import { useApi, useDebounced } from './useApi'
import { Empty } from './common'

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

  // 数据集列表列（纯展示，muted 复用旧次级文字色）
  const columns: TableProps<DatasetDTO>['columns'] = [
    { title: '数据集', dataIndex: 'name', key: 'name' },
    { title: '来源', dataIndex: 'sourceName', key: 'sourceName', render: (v: string) => <span className="muted">{v}</span> },
    { title: '行数', dataIndex: 'rowCount', key: 'rowCount', render: (v: number) => <span className="muted">{v.toLocaleString()}</span> },
    { title: '更新', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => <span className="muted">{v}</span> },
  ]

  // 预览列由所选数据集 schema 动态生成；值为 'true' 的单元格保留 abnormal 标红
  const previewColumns: TableProps<DatasetRow>['columns'] = (selected?.schema ?? []).map((f) => ({
    title: f.field,
    dataIndex: f.field,
    key: f.field,
    onCell: (row) => ({ className: String(row[f.field]) === 'true' ? 'abnormal' : '' }),
    render: (v: string | number | boolean) => String(v),
  }))

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
        <Input
          style={{ width: 260 }}
          placeholder="搜索数据集 / 来源"
          prefix={<SearchOutlined />}
          allowClear
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value)
            setPage(1)
          }}
        />
        <Button onClick={() => listState.reload()}>刷新</Button>
      </div>

      <div className="ds-layout">
        <div className="ds-list">
          {listState.error && <Alert type="error" showIcon message={`加载失败：${listState.error}`} style={{ marginBottom: 12 }} />}
          {!listState.error && (
            <Table<DatasetDTO>
              columns={columns}
              dataSource={rows}
              rowKey="id"
              size="small"
              loading={listState.loading}
              locale={{ emptyText: '无匹配数据集' }}
              onRow={(d) => ({ onClick: () => setSelectedId(d.id) })}
              rowClassName={(d) => `clickable${d.id === selectedId ? ' ant-table-row-active' : ''}`}
              pagination={{
                current: page,
                pageSize,
                total,
                onChange: setPage,
                showSizeChanger: false,
                showTotal: (t) => `共 ${t} 个数据集`,
              }}
            />
          )}
        </div>

        <div className="ds-detail">
          <h3 className="ds-detail-title">
            {selected ? `数据预览 · ${selected.name}` : '数据预览'}
          </h3>
          {!selected && <Empty>从左侧选择一个数据集查看采样数据</Empty>}
          {selected && queryState.error && <Alert type="error" showIcon message={`查询失败：${queryState.error}`} style={{ marginBottom: 12 }} />}
          {selected && !queryState.error && (
            <Table<DatasetRow>
              columns={previewColumns}
              dataSource={queryState.data?.list ?? []}
              rowKey={(_, i) => String(i)}
              size="small"
              loading={queryState.loading}
              pagination={false}
            />
          )}
        </div>
      </div>
    </div>
  )
}
