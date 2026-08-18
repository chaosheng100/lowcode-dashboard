import { useState } from 'react'
import { Alert, Button, Checkbox, Table, type TableProps } from 'antd'
import { api } from '../mock'
import type { SchedulerJobDTO } from '../mock/types'
import { useApi } from './useApi'
import { Field, Input, Modal, Tag , PageHeader } from './common'

/** 调度任务管理：列表 + 新建/编辑/删除 + 立即执行 */
export default function SchedulerPage() {
  const { data, loading, error, reload } = useApi(() => api.listSchedulerJobs({ pageSize: 100 }), [])
  const [editing, setEditing] = useState<Partial<SchedulerJobDTO> | null>(null)
  const [busy, setBusy] = useState(false)
  const [running, setRunning] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const rows = data?.list ?? []

  const save = async () => {
    if (!editing || !editing.name?.trim() || !editing.cron?.trim()) {
      setNotice('请填写任务名称与 Cron 表达式')
      return
    }
    setBusy(true)
    await api.saveSchedulerJob(editing)
    setBusy(false)
    setEditing(null)
    reload()
  }

  const remove = async (id: string) => {
    setBusy(true)
    await api.deleteSchedulerJob(id)
    setBusy(false)
    reload()
  }

  const run = async (id: string) => {
    setRunning(id)
    const r = await api.runSchedulerJob(id)
    setRunning(null)
    if (r.code === 0) setNotice(`任务执行完成：${r.data.lastResult ?? ''}（${r.data.durationMs ?? 0}ms）`)
    reload()
  }

  const columns: TableProps<SchedulerJobDTO>['columns'] = [
    { title: '任务名称', dataIndex: 'name', key: 'name' },
    { title: 'Cron', dataIndex: 'cron', key: 'cron', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '启用',
      dataIndex: 'enabled',
      key: 'enabled',
      render: (e: boolean) => <span className={'status-dot ' + (e ? 'active' : 'disabled')}>{e ? '已启用' : '已停用'}</span>
    },
    { title: '上次执行', dataIndex: 'lastRunAt', key: 'lastRunAt', render: (v?: string) => <span className="muted">{v || '—'}</span> },
    { title: '结果', dataIndex: 'lastResult', key: 'lastResult', render: (v?: string) => <span className="muted">{v || '—'}</span> },
    { title: '耗时', dataIndex: 'durationMs', key: 'durationMs', render: (v?: number) => <span className="muted">{v != null ? `${v}ms` : '—'}</span> },
    {
      title: '操作',
      key: 'action',
      render: (_, j) => (
        <>
          <Button size="small" type="link" loading={running === j.id} disabled={running === j.id} onClick={() => run(j.id)}>立即执行</Button>
          <Button size="small" type="link" onClick={() => setEditing(j)}>编辑</Button>
          <Button size="small" type="link" danger disabled={busy} onClick={() => remove(j.id)}>删除</Button>
        </>
      )
    }
  ]

  return (
    <div className="feature-page">
      <PageHeader title="调度任务" subtitle="定时任务编排与即时触发（Cron 驱动）">
<Button type="primary" onClick={() => setEditing({ name: '', cron: '0 0 * * *', enabled: true })}>＋ 新建任务</Button>
</PageHeader>

      {notice && <Alert type="info" showIcon closable message={notice} onClose={() => setNotice(null)} style={{ marginBottom: 12 }} />}
      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      {loading && <div className="muted2" style={{ padding: 16 }}>加载中…</div>}
      {!loading && !error && (
        <Table<SchedulerJobDTO> size="small" rowKey="id" dataSource={rows} columns={columns} pagination={false} locale={{ emptyText: '暂无调度任务' }} />
      )}

      {editing && (
        <Modal title={editing.id ? '编辑调度任务' : '新建调度任务'} onClose={() => setEditing(null)}>
          <Field label="任务名称"><Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="Cron"><Input value={editing.cron || ''} placeholder="如 0 0 * * *" onChange={(e) => setEditing({ ...editing, cron: e.target.value })} /></Field>
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
