import { useState } from 'react'
import { Alert, Button, Checkbox, Table, type TableProps } from 'antd'
import { api } from '../mock'
import type { SyncTaskDTO } from '../mock/types'
import { useApi } from './useApi'
import { Field, Input, Modal, Tag } from './common'

/** 数据同步任务：列表 + 新建/编辑/删除 + 执行（显示 lastRows / lastStatus） */
export default function SyncTaskPage() {
  const { data, loading, error, reload } = useApi(() => api.listSyncTasks({ pageSize: 100 }), [])
  const [editing, setEditing] = useState<Partial<SyncTaskDTO> | null>(null)
  const [busy, setBusy] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const rows = data?.list ?? []

  const save = async () => {
    if (!editing || !editing.name?.trim()) {
      setNotice('请填写任务名称')
      return
    }
    setBusy(true)
    await api.saveSyncTask(editing)
    setBusy(false)
    setEditing(null)
    reload()
  }

  const remove = async (id: string) => {
    setBusy(true)
    await api.deleteSyncTask(id)
    setBusy(false)
    reload()
  }

  const run = async (id: string) => {
    setRunning(id)
    const r = await api.runSyncTask(id)
    setRunning(null)
    if (r.code === 0) setNotice(`同步完成：状态 ${r.data.lastStatus ?? ''}，处理 ${r.data.lastRows ?? 0} 行`)
    reload()
  }

  const columns: TableProps<SyncTaskDTO>['columns'] = [
    { title: '任务名称', dataIndex: 'name', key: 'name' },
    { title: '来源', dataIndex: 'source', key: 'source', render: (v?: string) => <span className="muted">{v || '—'}</span> },
    { title: '目标', dataIndex: 'target', key: 'target', render: (v?: string) => <span className="muted">{v || '—'}</span> },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (e?: boolean) => <span className={'status-dot ' + (e ? 'active' : 'disabled')}>{e ? '已启用' : '已停用'}</span>
    },
    { title: '上次同步行数', dataIndex: 'lastRows', key: 'lastRows', render: (v?: number) => <span className="muted">{v != null ? v : '—'}</span> },
    {
      title: '上次状态',
      dataIndex: 'lastStatus',
      key: 'lastStatus',
      render: (v?: string) => (v ? <Tag color={v === 'success' ? '#34c759' : '#ff3b30'}>{v}</Tag> : '—')
    },
    {
      title: '操作',
      key: 'action',
      render: (_, t) => (
        <>
          <Button size="small" type="link" loading={running === t.id} disabled={running === t.id} onClick={() => run(t.id)}>执行</Button>
          <Button size="small" type="link" onClick={() => setEditing(t)}>编辑</Button>
          <Button size="small" type="link" danger disabled={busy} onClick={() => remove(t.id)}>删除</Button>
        </>
      )
    }
  ]

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div><h2 className="fp-title">数据同步任务</h2><p className="fp-sub">跨源数据同步编排与即时执行</p></div>
        <Button type="primary" onClick={() => setEditing({ name: '', source: '', target: '', enabled: true })}>＋ 新建同步</Button>
      </div>

      {notice && <Alert type="info" showIcon closable message={notice} onClose={() => setNotice(null)} style={{ marginBottom: 12 }} />}
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      {loading && <div className="muted2" style={{ padding: 16 }}>加载中…</div>}
      {!loading && !error && (
        <Table<SyncTaskDTO> size="small" rowKey="id" dataSource={rows} columns={columns} pagination={false} locale={{ emptyText: '暂无同步任务' }} />
      )}

      {editing && (
        <Modal title={editing.id ? '编辑同步任务' : '新建同步任务'} onClose={() => setEditing(null)}>
          <Field label="任务名称"><Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="来源"><Input value={editing.source || ''} onChange={(e) => setEditing({ ...editing, source: e.target.value })} /></Field>
          <Field label="目标"><Input value={editing.target || ''} onChange={(e) => setEditing({ ...editing, target: e.target.value })} /></Field>
          <Field label="启用">
            <Checkbox checked={!!editing.enabled} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })}>启用该任务</Checkbox>
          </Field>
          <div className="fp-toolbar" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setEditing(null)}>取消</Button>
            <Button type="primary" loading={busy} onClick={save}>保存</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
