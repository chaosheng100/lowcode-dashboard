import { useState } from 'react'
import { App, Button, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag } from 'antd'
import { api } from '../mock'
import { useApi } from './useApi'
import type { AIPromptDTO } from '../mock/types'

const SCENE_LABEL: Record<string, string> = {
  chat: '对话',
  generate: '组件生成',
  design: '大屏设计',
}

export default function PromptTemplatePage() {
  const { message } = App.useApp()
  const { data, loading, reload } = useApi(() => api.listAIPrompts({ pageSize: 100 }), [])
  const list = data?.list ?? []

  const [editing, setEditing] = useState<AIPromptDTO | null>(null)
  const [form, setForm] = useState({
    code: '',
    name: '',
    scene: 'chat' as AIPromptDTO['scene'],
    content: '',
    enabled: true,
  })

  const openNew = () => {
    setEditing(null)
    setForm({ code: '', name: '', scene: 'chat', content: '', enabled: true })
  }
  const openEdit = (p: AIPromptDTO) => {
    setEditing(p)
    setForm({
      code: p.code,
      name: p.name,
      scene: p.scene,
      content: p.content,
      enabled: p.enabled,
    })
  }

  const save = async () => {
    if (!form.code.trim() || !form.name.trim() || !form.content.trim()) {
      message.warning('code / 名称 / 内容不能为空')
      return
    }
    const r = await api.saveAIPrompt(form)
    if (r.code === 0) {
      message.success('已保存 Prompt 模板')
      setEditing(null)
      reload()
    } else {
      message.error(r.message)
    }
  }

  const remove = async (code: string) => {
    const r = await api.deleteAIPrompt(code)
    if (r.code === 0) {
      message.success('已删除')
      reload()
    } else {
      message.error(r.message)
    }
  }

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">Prompt 模板</h2>
          <p className="fp-sub">管理对话 / 组件生成 / 大屏设计三类系统提示词，启用后 SSE 入口自动生效</p>
        </div>
        <Button type="primary" onClick={openNew}>＋ 新建模板</Button>
      </div>
      <Table<AIPromptDTO>
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={list}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: 'code', dataIndex: 'code', width: 140 },
          { title: '名称', dataIndex: 'name', width: 180 },
          {
            title: '场景',
            dataIndex: 'scene',
            width: 110,
            render: (v: string) => <Tag color="blue">{SCENE_LABEL[v] || v}</Tag>,
          },
          { title: '版本', dataIndex: 'version', width: 80 },
          {
            title: '启用',
            dataIndex: 'enabled',
            width: 90,
            render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag>,
          },
          {
            title: '内容',
            dataIndex: 'content',
            ellipsis: true,
            render: (v: string) => <span style={{ fontFamily: 'monospace', fontSize: 12 }}>{v.slice(0, 80)}</span>,
          },
          {
            title: '操作',
            width: 150,
            render: (_, p) => (
              <Space>
                <Button size="small" onClick={() => openEdit(p)}>编辑</Button>
                <Popconfirm title="确定删除该模板？" onConfirm={() => remove(p.code)}>
                  <Button size="small" danger>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? `编辑模板 · ${editing.name}` : '新建模板'}
        open={!!editing}
        onOk={save}
        onCancel={() => setEditing(null)}
        okText="保存"
        cancelText="取消"
        width={640}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Space wrap>
            <Input
              style={{ width: 200 }}
              placeholder="code（唯一标识）"
              value={form.code}
              disabled={!!editing}
              onChange={(e) => setForm({ ...form, code: e.target.value })}
            />
            <Input
              style={{ width: 180 }}
              placeholder="名称"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <Select
              style={{ width: 140 }}
              value={form.scene}
              onChange={(scene) => setForm({ ...form, scene })}
              options={Object.entries(SCENE_LABEL).map(([value, label]) => ({ value, label }))}
            />
            <span style={{ fontSize: 12, color: '#9fb0cc' }}>
              启用
              <Switch
                size="small"
                checked={form.enabled}
                onChange={(enabled) => setForm({ ...form, enabled })}
                style={{ marginLeft: 6 }}
              />
            </span>
          </Space>
          <Input.TextArea
            rows={8}
            placeholder="系统提示词内容"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
            style={{ fontFamily: 'monospace', fontSize: 12.5 }}
          />
        </Space>
      </Modal>
    </div>
  )
}
