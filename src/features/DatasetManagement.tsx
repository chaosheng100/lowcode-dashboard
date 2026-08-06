import { useState } from 'react'
import { Alert, App, Button, Input, Table, type TableProps } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { api } from '../mock'
import type { DatasetDTO, DatasetField, DatasetRow, PageResult } from '../mock'
import { useApi, useDebounced } from './useApi'
import { Empty, Modal, Field, Select, Textarea } from './common'

// ---------------- 字段语义工具（自动推断） ----------------

function inferFieldType(v: unknown): DatasetField['fieldType'] {
  if (typeof v === 'number') return 'number'
  if (typeof v === 'boolean') return 'boolean'
  if (typeof v === 'string' && !isNaN(Date.parse(v))) return 'date'
  return 'string'
}

function inferSemanticType(key: string, v: unknown): 'dimension' | 'metric' {
  if (typeof v === 'number') return 'metric'
  if (/^(is|has|flag)/i.test(key)) return 'dimension'
  if (/(date|time|year|month|day|region|area|name|type|category|status|channel|平台|区域|地区|月份|日期|名称|类别|渠道|状态)/i.test(key)) return 'dimension'
  return 'metric'
}

/** 解析静态数据（JSON 数组） */
function parseRows(text: string): DatasetRow[] | null {
  const trimmed = text.trim()
  if (!trimmed) return []
  try {
    const v = JSON.parse(trimmed)
    return Array.isArray(v) ? (v as DatasetRow[]) : null
  } catch {
    return null
  }
}

/** 从样例行自动推断字段语义元信息 */
function inferFields(rows: DatasetRow[]): DatasetField[] {
  if (!rows.length) return []
  const keys = Object.keys(rows[0])
  return keys.map((k) => {
    const vals = rows.map((r) => r[k]).filter((v) => v != null)
    const first = vals[0]
    const fieldType = inferFieldType(first)
    const semanticType = inferSemanticType(k, first)
    return {
      fieldKey: k,
      label: k,
      fieldType,
      semanticType,
      aggregation: semanticType === 'metric' ? 'sum' : 'none',
      sampleValues: vals.slice(0, 3),
      sortOrder: 0,
    }
  })
}

/** 从数据集 config 中提取静态数据行 */
function extractStaticRows(config: unknown): unknown[] {
  if (!config) return []
  if (typeof config === 'string') {
    try {
      const c = JSON.parse(config)
      return Array.isArray(c.data) ? c.data : Array.isArray(c.rows) ? c.rows : []
    } catch {
      return []
    }
  }
  const c = config as Record<string, unknown>
  return Array.isArray(c.data)
    ? (c.data as unknown[])
    : Array.isArray(c.rows)
      ? (c.rows as unknown[])
      : []
}

/** 将 config 统一解析为对象，供编辑回填与保存合并使用 */
function parseConfig(config: unknown): Record<string, unknown> {
  if (typeof config === 'string') {
    try {
      const c = JSON.parse(config)
      return c && typeof c === 'object' ? (c as Record<string, unknown>) : {}
    } catch {
      return {}
    }
  }
  return config && typeof config === 'object'
    ? (config as Record<string, unknown>)
    : {}
}

const AGG_OPTIONS = ['sum', 'avg', 'count', 'max', 'min', 'none']
const TYPE_OPTIONS: Array<{ value: DatasetField['fieldType']; label: string }> = [
  { value: 'string', label: '文本' },
  { value: 'number', label: '数值' },
  { value: 'date', label: '日期' },
  { value: 'boolean', label: '布尔' },
]
const DATASET_TYPES: Array<{ value: DatasetDTO['type']; label: string }> = [
  { value: 'static', label: '静态数据' },
  { value: 'sql', label: 'SQL 查询' },
  { value: 'api', label: 'API 接口' },
  { value: 'csv', label: 'CSV 文件' },
]

export default function DatasetManagement() {
  const { message } = App.useApp()
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
  const queryState = useApi<{ list: DatasetRow[]; total: number; columns: string[] }>(
    () => (selectedId ? api.queryDataset(selectedId, { pageSize: 12 }) : Promise.resolve({ code: 0, message: 'ok', data: { list: [], total: 0, columns: [] } })),
    [selectedId]
  )

  // —— 新建 / 编辑 ——
  const [editor, setEditor] = useState<(Partial<DatasetDTO> & { fields?: DatasetField[] }) | null>(null)
  const [staticText, setStaticText] = useState('')
  const [sqlText, setSqlText] = useState('')
  const [saving, setSaving] = useState(false)
  const [generatingFields, setGeneratingFields] = useState(false)
  const [dataSources, setDataSources] = useState<{ id: string; name: string; type: string }[]>([])

  const loadSources = () => {
    api.listDataEngineSources().then((r) => {
      if (r.code === 0) setDataSources(r.data)
    }).catch(() => {})
  }

  const openCreate = () => {
    loadSources()
    setEditor({ name: '', type: 'static', rowCount: 0, fields: [] })
    setStaticText('')
    setSqlText('')
  }

  const openEdit = async (d: DatasetDTO) => {
    loadSources()
    setEditor({ ...d, type: d.type ?? 'static' })
    try {
      const r = await api.getDataset(d.id)
      if (r.code === 0) {
        const cfg = parseConfig(r.data.config)
        setEditor({ ...r.data, type: r.data.type ?? 'static', config: cfg })
        setStaticText(JSON.stringify(extractStaticRows(r.data.config), null, 2))
        setSqlText(typeof cfg.sql === 'string' ? cfg.sql : '')
      } else {
        setStaticText('')
        setSqlText('')
      }
    } catch {
      setStaticText('')
      setSqlText('')
    }
  }

  const patchField = (key: string, patch: Partial<DatasetField>) => {
    setEditor((e) =>
      e ? { ...e, fields: (e.fields ?? []).map((f) => (f.fieldKey === key ? { ...f, ...patch } : f)) } : e
    )
  }

  /** 手动新增一个字段，供 SQL/API 等无查询结果的场景配置语义 */
  const addField = () => {
    if (!editor) return
    const fields = editor.fields ?? []
    const used = new Set(fields.map((f) => f.fieldKey))
    let n = fields.length + 1
    while (used.has(`field_${n}`)) n += 1
    const fieldKey = `field_${n}`
    setEditor({
      ...editor,
      fields: [
        ...fields,
        {
          fieldKey,
          label: fieldKey,
          fieldType: 'string',
          semanticType: 'dimension',
          aggregation: 'none',
          sampleValues: [],
          sortOrder: fields.reduce((m, f) => Math.max(m, f.sortOrder ?? 0), 0) + 1,
        },
      ],
    })
  }

  /** 根据数据集查询结果的列生成字段语义，保留已手动编辑的字段 */
  const generateFieldsFromQuery = async () => {
    if (!editor?.id) return
    setGeneratingFields(true)
    try {
      const r = await api.queryDataset(editor.id, { pageSize: 50 })
      const rows = r.data.list ?? []
      const inferred: DatasetField[] = rows.length
        ? inferFields(rows)
        : (r.data.columns ?? []).map((c) => ({
            fieldKey: c,
            label: c,
            fieldType: 'string',
            semanticType: 'dimension',
            aggregation: 'none',
            sampleValues: [],
            sortOrder: 0,
          }))
      if (!inferred.length) {
        message.warning('查询结果为空，请手动添加字段')
        return
      }
      const existing = editor.fields ?? []
      const byKey = new Map(existing.map((f) => [f.fieldKey, f]))
      const maxSort = existing.reduce((m, f) => Math.max(m, f.sortOrder ?? 0), 0)
      const merged = inferred.map((f) => {
        const old = byKey.get(f.fieldKey)
        return old ? old : { ...f, sortOrder: (f.sortOrder ?? 0) + maxSort + 1 }
      })
      const known = new Set(inferred.map((f) => f.fieldKey))
      const kept = existing.filter((f) => !known.has(f.fieldKey))
      setEditor({ ...editor, fields: [...merged, ...kept] })
      message.success(`已从查询结果生成 ${inferred.length} 个字段，可继续调整语义`)
    } catch (e) {
      message.error('从查询结果生成失败：' + (e as Error).message)
    } finally {
      setGeneratingFields(false)
    }
  }

  /** 解析静态数据 → 自动推断字段语义 */
  const parseAndInfer = () => {
    if (!editor) return
    const rows = parseRows(staticText)
    if (rows === null) {
      message.warning('静态数据需为 JSON 数组，如 [{ "月份": "1月", "销售额": 120 }]')
      return
    }
    if (rows.length === 0) {
      message.warning('静态数据为空')
      return
    }
    setEditor({ ...editor, fields: inferFields(rows), rowCount: rows.length })
    message.success(`已解析 ${rows.length} 行，自动推断 ${rows.length ? Object.keys(rows[0]).length : 0} 个字段，可手动调整语义`)
  }

  const save = async () => {
    if (!editor || !editor.name?.trim()) {
      message.warning('请输入数据集名称')
      return
    }
    setSaving(true)
    try {
      const fields = editor.fields ?? []
      const emptyKey = fields.find((f) => !f.fieldKey?.trim())
      if (emptyKey) {
        message.warning('字段名不能为空')
        setSaving(false)
        return
      }
      const keys = new Set(fields.map((f) => f.fieldKey.trim()))
      if (keys.size !== fields.length) {
        message.warning('字段名不能重复')
        setSaving(false)
        return
      }
      const isStatic = (editor.type ?? 'static') === 'static'
      const rows = isStatic ? parseRows(staticText) : null
      if (isStatic && rows === null) {
        message.warning('静态数据需为 JSON 数组')
        setSaving(false)
        return
      }
      const cfg = parseConfig(editor.config)
      await api.saveDataset({
        id: editor.id,
        name: editor.name,
        description: editor.description,
        type: editor.type ?? 'static',
        dataSourceId: editor.dataSourceId,
        config: isStatic
          ? { data: rows ?? [] }
          : (editor.type ?? '') === 'sql'
            ? { ...cfg, sql: sqlText }
            : cfg,
        fields,
        rowCount: isStatic ? (rows?.length ?? editor.rowCount) : editor.rowCount,
      })
      setEditor(null)
      listState.reload()
      message.success(editor.id ? '已保存' : '已创建')
    } catch (e) {
      message.error('保存失败：' + (e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (d: DatasetDTO) => {
    try {
      await api.deleteDataset(d.id)
      if (selectedId === d.id) setSelectedId(null)
      listState.reload()
      message.success('已删除')
    } catch (e) {
      message.error('删除失败：' + (e as Error).message)
    }
  }

  // —— 列表 ——
  const rows = listState.data?.list ?? []
  const total = listState.data?.total ?? 0

  const columns: TableProps<DatasetDTO>['columns'] = [
    { title: '数据集', dataIndex: 'name', key: 'name' },
    { title: '来源', dataIndex: 'sourceName', key: 'sourceName', render: (v: string) => <span className="muted">{v || '-'}</span> },
    { title: '字段', key: 'fields', render: (_, d) => <span className="muted">{d.fields?.length ?? 0} 个</span> },
    { title: '行数', dataIndex: 'rowCount', key: 'rowCount', render: (v: number) => <span className="muted">{v?.toLocaleString() ?? '-'}</span> },
    { title: '更新', dataIndex: 'updatedAt', key: 'updatedAt', render: (v: string) => <span className="muted">{v}</span> },
    {
      title: '操作', key: 'actions', width: 120,
      render: (_, d) => (
        <>
          <Button size="small" type="link" onClick={() => openEdit(d)}>编辑</Button>
          <Button size="small" type="link" danger onClick={() => remove(d)}>删除</Button>
        </>
      ),
    },
  ]

  // 预览列以查询结果真实列为主，缺失时回退到字段语义元信息
  const queryColumnKeys =
    queryState.data?.columns?.length
      ? queryState.data.columns
      : (selected?.fields ?? []).map((f) => f.fieldKey)
  const previewColumns: TableProps<DatasetRow>['columns'] = queryColumnKeys.map((key) => {
    const field = selected?.fields?.find((f) => f.fieldKey === key)
    return {
      title: field?.label || key,
      dataIndex: key,
      key,
      render: (v: unknown) => String(v ?? ''),
    }
  })

  const fieldColumns: TableProps<DatasetField>['columns'] = [
    {
      title: '字段', dataIndex: 'fieldKey', key: 'fieldKey', width: 110,
      render: (_, f) => <Input size="small" value={f.fieldKey} onChange={(e) => patchField(f.fieldKey, { fieldKey: e.target.value })} />,
    },
    {
      title: '业务名称', dataIndex: 'label', key: 'label', width: 110,
      render: (_, f) => <Input size="small" value={f.label} onChange={(e) => patchField(f.fieldKey, { label: e.target.value })} />,
    },
    {
      title: '语义', dataIndex: 'semanticType', key: 'semanticType', width: 90,
      render: (_, f) => (
        <Select value={f.semanticType} onChange={(e) => patchField(f.fieldKey, { semanticType: e.target.value as DatasetField['semanticType'] })}>
          <option value="dimension">维度</option>
          <option value="metric">指标</option>
        </Select>
      ),
    },
    {
      title: '聚合', dataIndex: 'aggregation', key: 'aggregation', width: 90,
      render: (_, f) => (
        <Select value={f.aggregation ?? 'none'} onChange={(e) => patchField(f.fieldKey, { aggregation: e.target.value })}>
          {AGG_OPTIONS.map((a) => <option key={a} value={a}>{a}</option>)}
        </Select>
      ),
    },
    {
      title: '类型', dataIndex: 'fieldType', key: 'fieldType', width: 80,
      render: (_, f) => (
        <Select value={f.fieldType} onChange={(e) => patchField(f.fieldKey, { fieldType: e.target.value as DatasetField['fieldType'] })}>
          {TYPE_OPTIONS.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
        </Select>
      ),
    },
    {
      title: '格式', dataIndex: 'format', key: 'format', width: 110,
      render: (_, f) => <Input size="small" placeholder="如 ￥#,##0.00" value={f.format ?? ''} onChange={(e) => patchField(f.fieldKey, { format: e.target.value })} />,
    },
    {
      title: '样例值', dataIndex: 'sampleValues', key: 'sampleValues',
      render: (v: unknown[] | undefined) => <span className="muted">{(v ?? []).slice(0, 3).join(', ') || '-'}</span>,
    },
  ]

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">数据集管理</h2>
          <p className="fp-sub">基于数据源构建可复用数据集，字段语义元信息供 AI 自动匹配组件数据</p>
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
        <Button type="primary" onClick={openCreate}>＋ 新建数据集</Button>
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

      {editor && (
        <Modal title={editor.id ? `编辑数据集 · ${editor.name}` : '新建数据集'} onClose={() => setEditor(null)} width={920}>
          <Field label="名称"><Input value={editor.name ?? ''} onChange={(e) => setEditor({ ...editor, name: e.target.value })} /></Field>
          <Field label="描述"><Input value={editor.description ?? ''} onChange={(e) => setEditor({ ...editor, description: e.target.value })} /></Field>
          <Field label="类型">
            <Select value={editor.type ?? 'static'} onChange={(e) => setEditor({ ...editor, type: e.target.value as DatasetDTO['type'] })}>
              {DATASET_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </Select>
          </Field>
          <Field label="数据源">
            <Select
              value={editor.dataSourceId ?? ''}
              onChange={(e) => setEditor({ ...editor, dataSourceId: e.target.value || undefined })}
              placeholder="可选，静态数据会自动创建"
            >
              <option value="">（自动 / 内置静态数据）</option>
              {dataSources.map((s) => <option key={s.id} value={s.id}>{s.name}（{s.type}）</option>)}
            </Select>
          </Field>

          {(editor.type ?? 'static') === 'static' && (
            <Field label="静态数据">
              <Textarea
                style={{ minHeight: 100, fontFamily: 'monospace' }}
                placeholder={'JSON 数组，如：\n[{ "月份": "1月", "销售额": 120 }, { "月份": "2月", "销售额": 200 }]'}
                value={staticText}
                onChange={(e) => setStaticText(e.target.value)}
              />
              <div className="fp-toolbar" style={{ marginTop: 6 }}>
                <Button size="small" onClick={parseAndInfer}>⚡ 解析并自动推断字段</Button>
                <span className="muted2" style={{ fontSize: 12 }}>字段语义（维度/指标、聚合方式）可手动调整，供 AI 自动匹配</span>
              </div>
            </Field>
          )}

          {(editor.type ?? 'static') === 'sql' && (
            <Field label="预编 SQL">
              <Textarea
                style={{ minHeight: 120, fontFamily: 'monospace' }}
                placeholder="SELECT * FROM datasource LIMIT 50"
                value={sqlText}
                onChange={(e) => setSqlText(e.target.value)}
              />
            </Field>
          )}

          <Field label="字段语义">
            <div className="fp-toolbar" style={{ marginBottom: 6 }}>
              <Button size="small" onClick={addField}>＋ 添加字段</Button>
              {editor.id && (editor.type ?? 'static') !== 'static' && (
                <Button size="small" loading={generatingFields} onClick={generateFieldsFromQuery}>⚡ 从查询结果生成字段</Button>
              )}
              <span className="muted2" style={{ fontSize: 12 }}>可手动调整业务名称与语义，供 AI 自动匹配</span>
            </div>
            <div style={{ maxHeight: 300, overflow: 'auto' }}>
              <Table<DatasetField>
                size="small"
                rowKey={(_, i) => String(i)}
                columns={fieldColumns}
                dataSource={editor.fields ?? []}
                pagination={false}
                locale={{ emptyText: (editor.type ?? 'static') === 'static' ? '粘贴静态数据并点击「解析并自动推断字段」' : '请手动配置字段' }}
              />
            </div>
          </Field>

          <div className="fp-toolbar" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setEditor(null)}>取消</Button>
            <Button type="primary" loading={saving} onClick={save}>保存</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
