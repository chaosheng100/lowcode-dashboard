import { useState } from 'react'
import { App, Button, Input, Modal, Popconfirm, Select, Space, Switch, Table, Tag } from 'antd'
import { PlusOutlined, DeleteOutlined } from '@ant-design/icons'
import { api } from '../mock'
import { useApi } from './useApi'
import type { AgentFlowDTO, AgentFlowNode, FlowRunResult } from '../mock/types'
import { PageHeader } from './common'

const NODE_TYPES = ['echo', 'chat', 'generate', 'review', 'datasetMeta', 'componentSearch']
const NODE_LABEL: Record<string, string> = {
  echo: '透传',
  chat: 'AI 对话',
  generate: '代码生成',
  review: '结构校验',
  datasetMeta: '数据集元信息',
  componentSearch: '组件搜索',
}
type EditableNode = Omit<AgentFlowNode, 'args'> & {
  args?: Record<string, unknown> | string
}

let nodeCounter = 0
const nextNodeId = () => `node_${Date.now().toString(36)}_${nodeCounter++}`

export default function FlowPage() {
  const { message } = App.useApp()
  const { data, loading, reload } = useApi(() => api.listAIFlows({ pageSize: 100 }), [])
  const list = data?.list ?? []

  const [editing, setEditing] = useState<AgentFlowDTO | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState<{
    name: string
    description: string
    enabled: boolean
    nodes: EditableNode[]
  }>({ name: '', description: '', enabled: true, nodes: [] })

  const [runTarget, setRunTarget] = useState<AgentFlowDTO | null>(null)
  const [runInput, setRunInput] = useState('')
  const [runResult, setRunResult] = useState<FlowRunResult | null>(null)
  const [running, setRunning] = useState(false)

  const openNew = () => {
    setEditing(null)
    setForm({ name: '', description: '', enabled: true, nodes: [] })
    setModalOpen(true)
  }
  const openEdit = (f: AgentFlowDTO) => {
    setEditing(f)
    setForm({
      name: f.name,
      description: f.description ?? '',
      enabled: f.enabled,
      nodes: f.nodes,
    })
    setModalOpen(true)
  }

  const addNode = () =>
    setForm((f) => ({
      ...f,
      nodes: [...f.nodes, { id: nextNodeId(), type: 'echo', label: '', args: {} }],
    }))
  const patchNode = (id: string, patch: Partial<EditableNode>) =>
    setForm((f) => ({
      ...f,
      nodes: f.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }))
  const removeNode = (id: string) =>
    setForm((f) => ({ ...f, nodes: f.nodes.filter((n) => n.id !== id) }))

  const save = async () => {
    if (!form.name.trim()) {
      message.warning('流程名称不能为空')
      return
    }
    const nodes = form.nodes.map((n) => {
      let args: Record<string, unknown> = {}
      try {
        args = n.args && typeof n.args === 'string'
          ? JSON.parse(n.args as unknown as string)
          : (n.args ?? {})
      } catch {
        args = {}
      }
      return { ...n, args }
    })
    const r = await api.saveAIFlow(
      editing
        ? { id: editing.id, name: form.name, description: form.description, enabled: form.enabled, nodes }
        : { name: form.name, description: form.description, enabled: form.enabled, nodes },
    )
    if (r.code === 0) {
      message.success('已保存流程')
      setModalOpen(false)
      setEditing(null)
      reload()
    } else {
      message.error(r.message)
    }
  }

  const removeFlow = async (id: string) => {
    const r = await api.deleteAIFlow(id)
    if (r.code === 0) {
      message.success('已删除')
      reload()
    } else {
      message.error(r.message)
    }
  }

  const run = async () => {
    if (!runTarget) return
    setRunning(true)
    setRunResult(null)
    const r = await api.runAIFlow(runTarget.id, runInput)
    setRunResult(r.code === 0 ? r.data : null)
    if (r.code !== 0) message.error(r.message)
    setRunning(false)
  }

  return (
    <div className="feature-page">
      <PageHeader title="Agent 工作流" subtitle="节点式编排：透传 / AI 对话 / 代码生成 / 结构校验 / 数据集元信息 / 组件搜索">
<Button type="primary" icon={<PlusOutlined />} onClick={openNew}>新建流程</Button>
</PageHeader>
      <Table<AgentFlowDTO>
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={list}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: '名称', dataIndex: 'name', width: 200 },
          {
            title: '节点数',
            width: 90,
            render: (_, f) => f.nodes.length,
          },
          {
            title: '启用',
            dataIndex: 'enabled',
            width: 90,
            render: (v: boolean) => <Tag color={v ? 'green' : 'default'}>{v ? '启用' : '停用'}</Tag>,
          },
          { title: '更新时间', dataIndex: 'updatedAt', width: 180 },
          {
            title: '操作',
            width: 210,
            render: (_, f) => (
              <Space>
                <Button size="small" onClick={() => { setRunTarget(f); setRunInput(''); setRunResult(null) }}>运行</Button>
                <Button size="small" onClick={() => openEdit(f)}>编辑</Button>
                <Popconfirm title="确定删除该流程？" onConfirm={() => removeFlow(f.id)}>
                  <Button size="small" danger>删除</Button>
                </Popconfirm>
              </Space>
            ),
          },
        ]}
      />

      <Modal
        title={editing ? `编辑流程 · ${editing.name}` : '新建流程'}
        open={modalOpen}
        onOk={save}
        onCancel={() => setModalOpen(false)}
        okText="保存"
        cancelText="取消"
        width={760}
      >
        <Space direction="vertical" style={{ width: '100%' }} size={10}>
          <Space wrap>
            <Input style={{ width: 220 }} placeholder="流程名称" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            <Input style={{ width: 260 }} placeholder="描述" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <span style={{ fontSize: 12, color: '#86868b' }}>
              启用
              <Switch size="small" checked={form.enabled} onChange={(enabled) => setForm({ ...form, enabled })} style={{ marginLeft: 6 }} />
            </span>
          </Space>
          {form.nodes.map((n, i) => (
            <Space key={n.id} wrap align="start">
              <span style={{ color: '#86868b', fontSize: 12, width: 24, lineHeight: '30px' }}>{i + 1}</span>
              <Select
                style={{ width: 150 }}
                value={n.type}
                onChange={(type) => patchNode(n.id, { type: type as AgentFlowNode['type'] })}
                options={NODE_TYPES.map((t) => ({ value: t, label: NODE_LABEL[t] }))}
              />
              <Input style={{ width: 160 }} placeholder="节点标签" value={n.label ?? ''} onChange={(e) => patchNode(n.id, { label: e.target.value })} />
              <Input
                style={{ width: 300 }}
                placeholder='参数 JSON，如 {"lang":"ts","datasetId":"xxx"}'
                value={typeof n.args === 'string' ? (n.args as unknown as string) : JSON.stringify(n.args ?? {})}
                onChange={(e) => patchNode(n.id, { args: e.target.value })}
              />
              <Button type="text" danger icon={<DeleteOutlined />} onClick={() => removeNode(n.id)} />
            </Space>
          ))}
          <Button icon={<PlusOutlined />} onClick={addNode}>添加节点</Button>
        </Space>
      </Modal>

      <Modal
        title={`运行流程 · ${runTarget?.name ?? ''}`}
        open={!!runTarget}
        onOk={run}
        confirmLoading={running}
        onCancel={() => setRunTarget(null)}
        okText="运行"
        cancelText="关闭"
        width={720}
      >
        <Input.TextArea
          rows={3}
          placeholder="流程输入"
          value={runInput}
          onChange={(e) => setRunInput(e.target.value)}
          style={{ marginBottom: 10 }}
        />
        {runResult && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 360, overflow: 'auto' }}>
            {runResult.steps.map((s, i) => (
              <div key={s.id || i} style={{ padding: 8, background: '#f5f5f7', border: '1px solid #e5e5ea', borderRadius: 6, fontSize: 12 }}>
                <Tag color={s.ok ? 'green' : 'red'}>{s.ok ? '成功' : '失败'}</Tag>
                <b>{s.label || s.type}</b>
                <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#86868b' }}>{s.output}</pre>
              </div>
            ))}
            <div style={{ padding: 8, background: 'rgba(0, 113, 227,.06)', border: '1px solid rgba(0, 113, 227,.25)', borderRadius: 6, fontSize: 12 }}>
              <b>最终输出</b>
              <pre style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap', wordBreak: 'break-all', color: '#1d1d1f' }}>{runResult.output}</pre>
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
