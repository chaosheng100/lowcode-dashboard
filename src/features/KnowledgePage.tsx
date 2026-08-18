import { useState } from 'react'
import { App, Button, Input, Modal, Popconfirm, Space, Table } from 'antd'
import { api } from '../mock'
import { useApi } from './useApi'
import type { KnowledgeDocDTO } from '../mock/types'

export default function KnowledgePage() {
  const { message } = App.useApp()
  const [keyword, setKeyword] = useState('')
  const { data, loading, reload } = useApi(
    () => api.listAIKnowledge({ pageSize: 50, keyword }),
    [keyword],
  )
  const list = data?.list ?? []

  const [editing, setEditing] = useState<KnowledgeDocDTO | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ title: '', content: '', tags: '' })

  const openNew = () => {
    setEditing(null)
    setForm({ title: '', content: '', tags: '' })
    setModalOpen(true)
  }
  const openEdit = (d: KnowledgeDocDTO) => {
    setEditing(d)
    setForm({ title: d.title, content: d.content, tags: (d.tags ?? []).join(', ') })
    setModalOpen(true)
  }

  const save = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      message.warning('标题与内容不能为空')
      return
    }
    const tags = form.tags.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
    const r = await api.saveAIKnowledge(
      editing ? { id: editing.id, title: form.title, content: form.content, tags } : { title: form.title, content: form.content, tags },
    )
    if (r.code === 0) {
      message.success('已保存知识文档')
      setEditing(null)
      setModalOpen(false)
      reload()
    } else {
      message.error(r.message)
    }
  }

  const remove = async (id: string) => {
    const r = await api.deleteAIKnowledge(id)
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
          <h2 className="fp-title">AI 知识库</h2>
          <p className="fp-sub">维护可被 Agent 检索注入的文档，支持关键词搜索</p>
        </div>
        <Space>
          <Input.Search
            allowClear
            placeholder="搜索标题/内容"
            value={keyword}
            onChange={(e) => setKeyword(e.target.value)}
            onSearch={(v) => setKeyword(v)}
            style={{ width: 220 }}
          />
          <Button type="primary" onClick={openNew}>＋ 新建文档</Button>
        </Space>
      </div>
      <Table<KnowledgeDocDTO>
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={list}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: '标题', dataIndex: 'title', width: 220 },
          {
            title: '内容摘要',
            dataIndex: 'content',
            ellipsis: true,
            render: (v: string) => <span style={{ fontSize: 12 }}>{v.slice(0, 120)}</span>,
          },
          {
            title: '标签',
            dataIndex: 'tags',
            width: 160,
            render: (v: string[]) => (v ?? []).join('、') || '—',
          },
          {
            title: '操作',
            width: 150,
            render: (_, d) => (
              <Space>
                <Button size="small" onClick={() => openEdit(d)}>编辑</Button>
                <Popconfirm title="确定删除该文档？" onConfirm={() => remove(d.id)}>
                  <Button size="small" danger>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />
      <Modal
        title={editing ? `编辑文档 · ${editing.title}` : '新建知识文档'}
        open={modalOpen}
        onOk={save}
        onCancel={() => {
          setEditing(null)
          setModalOpen(false)
        }}
        okText="保存"
        cancelText="取消"
        width={640}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Input
            placeholder="标题"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <Input
            placeholder="标签（逗号分隔）"
            value={form.tags}
            onChange={(e) => setForm({ ...form, tags: e.target.value })}
          />
          <Input.TextArea
            rows={10}
            placeholder="文档内容"
            value={form.content}
            onChange={(e) => setForm({ ...form, content: e.target.value })}
          />
        </Space>
      </Modal>
    </div>
  )
}
