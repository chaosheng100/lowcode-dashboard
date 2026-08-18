import { useState } from 'react'
import { Alert, Button, Spin } from 'antd'
import { useApi } from './useApi'
import { api } from '../mock'
import type { MessageChannelDTO, ChannelKind } from '../mock/types'
import { Modal, Field, Input, Select, Tag , PageHeader } from './common'

const KIND_LABEL: Record<ChannelKind, string> = {
  wechat: '企业微信', dingtalk: '钉钉', email: '邮件', 'sms-aliyun': '阿里云短信', 'sms-tencent': '腾讯云短信'
}
const KINDS: ChannelKind[] = ['wechat', 'dingtalk', 'email', 'sms-aliyun', 'sms-tencent']

/** 消息推送：企业微信 / 钉钉 / 邮件 / 阿里云短信 / 腾讯云短信 */
export default function MessagePushPage() {
  const { data, loading, error, reload } = useApi(() => api.listChannels({ pageSize: 50 }), [])
  const [editing, setEditing] = useState<Partial<MessageChannelDTO> | null>(null)

  const save = async () => { if (!editing) return; await api.saveChannel(editing); setEditing(null); reload() }
  const remove = async (id: string) => { await api.deleteChannel(id); reload() }
  const toggle = async (c: MessageChannelDTO) => { await api.saveChannel({ id: c.id, enabled: !c.enabled }); reload() }

  return (
    <div className="feature-page">
      <PageHeader title="消息推送" subtitle="企业微信 / 钉钉 / 邮件 / 阿里云短信 / 腾讯云短信 —— 联动告警与大屏实时推送">
<Button onClick={() => setEditing({ name: '', kind: 'wechat', endpoint: '', enabled: true })}>＋ 新建通道</Button>
</PageHeader>
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spin /></div>}
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 10 }} />}
      {!loading && !error && (
        <div className="grid3">
          {(data?.list ?? []).map((c) => (
            <div key={c.id} className="card">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <b style={{ color: '#1d1d1f' }}>{c.name}</b>
                <Tag color={c.enabled ? '#34c759' : '#ff3b30'}>{c.enabled ? '启用' : '停用'}</Tag>
              </div>
              <div className="muted2" style={{ margin: '8px 0' }}>{KIND_LABEL[c.kind]}</div>
              <div className="muted2" style={{ wordBreak: 'break-all' }}>{c.endpoint}</div>
              <div className="fp-toolbar" style={{ marginTop: 10 }}>
                <Button size="small" onClick={() => toggle(c)}>{c.enabled ? '停用' : '启用'}</Button>
                <Button size="small" onClick={() => setEditing(c)}>编辑</Button>
                <Button size="small" danger onClick={() => remove(c.id)}>删除</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <Modal title={editing.id ? '编辑通道' : '新建通道'} onClose={() => setEditing(null)}>
          <Field label="名称"><Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="通道类型">
            <Select value={editing.kind || 'wechat'} onChange={(e) => setEditing({ ...editing, kind: e.target.value as ChannelKind })}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </Select>
          </Field>
          <Field label="Webhook / 网关">
            <Input value={editing.endpoint || ''} onChange={(e) => setEditing({ ...editing, endpoint: e.target.value })} placeholder="webhook 地址 / SMTP / 短信网关" />
          </Field>
          <div className="fp-toolbar"><Button onClick={save}>保存</Button></div>
        </Modal>
      )}
    </div>
  )
}
