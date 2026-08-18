import { useState } from 'react'
import { Alert, Button, Table, type TableProps } from 'antd'
import { api } from '../mock'
import type { NotificationDTO, NotificationLevel } from '../mock/types'
import { useApi } from './useApi'
import { Field, Input, Modal, Select, Tag , PageHeader } from './common'

const LEVEL_COLOR: Record<NotificationLevel, string> = {
  info: '#0a84ff',
  warning: '#ff9500',
  error: '#ff3b30',
  success: '#34c759'
}
const LEVELS: NotificationLevel[] = ['info', 'warning', 'error', 'success']

/** 通知中心：列表（level 徽标 / 已读置灰）+ 全部已读 + 单条已读 + 发送测试通知 */
export default function NotificationPage() {
  const { data, loading, error, reload } = useApi(() => api.listNotifications({ pageSize: 100 }), [])
  const [busy, setBusy] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [compose, setCompose] = useState<{ title: string; content: string; level: NotificationLevel } | null>(null)

  const rows = data?.list ?? []

  const readOne = async (id: string) => {
    setBusy(id)
    await api.readNotification(id)
    setBusy(null)
    reload()
  }
  const readAll = async () => {
    setBusy('__all__')
    await api.readAllNotifications()
    setBusy(null)
    reload()
  }
  const send = async () => {
    if (!compose || !compose.title.trim()) return
    setSending(true)
    await api.sendNotification(compose)
    setSending(false)
    setCompose(null)
    reload()
  }

  const columns: TableProps<NotificationDTO>['columns'] = [
    {
      title: '级别',
      dataIndex: 'level',
      key: 'level',
      render: (lv: NotificationLevel) => <Tag color={LEVEL_COLOR[lv]}>{lv}</Tag>
    },
    {
      title: '标题',
      dataIndex: 'title',
      key: 'title',
      render: (v: string, r) => <span style={r.read ? { color: 'var(--sub)' } : undefined}>{v}</span>
    },
    {
      title: '内容',
      dataIndex: 'content',
      key: 'content',
      render: (v: string, r) => <span className="muted" style={r.read ? { opacity: 0.6 } : undefined}>{v}</span>
    },
    {
      title: '状态',
      dataIndex: 'read',
      key: 'read',
      render: (read: boolean) => <span className={'status-dot ' + (read ? 'disabled' : 'active')}>{read ? '已读' : '未读'}</span>
    },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', render: (v: string) => <span className="muted">{v || '—'}</span> },
    {
      title: '操作',
      key: 'action',
      render: (_, n) => (
        <Button size="small" type="link" loading={busy === n.id} disabled={busy === n.id || n.read} onClick={() => readOne(n.id)}>
          {n.read ? '已读' : '标记已读'}
        </Button>
      )
    }
  ]

  return (
    <div className="feature-page">
      <PageHeader title="通知中心" subtitle="平台消息与告警通知（level 徽标 / 已读置灰）">
<div className="fp-toolbar" style={{ marginBottom: 0 }}>
          <Button onClick={() => setCompose({ title: '', content: '', level: 'info' })}>发送测试通知</Button>
          <Button onClick={readAll} loading={busy === '__all__'} disabled={busy === '__all__'}>全部已读</Button>
        </div>
</PageHeader>

      {error && <Alert type="error" showIcon message={error} style={{ marginBottom: 12 }} />}
      {loading && <div className="muted2" style={{ padding: 16 }}>加载中…</div>}
      {!loading && !error && (
        <Table<NotificationDTO> size="small" rowKey="id" dataSource={rows} columns={columns} pagination={false} locale={{ emptyText: '暂无通知' }} />
      )}

      {compose && (
        <Modal title="发送测试通知" onClose={() => setCompose(null)}>
          <Field label="标题"><Input value={compose.title} onChange={(e) => setCompose({ ...compose, title: e.target.value })} /></Field>
          <Field label="内容"><Input value={compose.content} onChange={(e) => setCompose({ ...compose, content: e.target.value })} /></Field>
          <Field label="级别">
            <Select value={compose.level} onChange={(e) => setCompose({ ...compose, level: e.target.value as NotificationLevel })}>
              {LEVELS.map((l) => <option key={l} value={l}>{l}</option>)}
            </Select>
          </Field>
          <div className="fp-toolbar" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setCompose(null)}>取消</Button>
            <Button type="primary" loading={sending} onClick={send}>发送</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
