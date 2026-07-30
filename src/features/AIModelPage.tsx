import { useState } from 'react'
import { Alert, Button, Spin } from 'antd'
import { useApi } from './useApi'
import { api } from '../mock'
import { Modal, Field, Input, Select, Tag } from './common'
import type { AIModelDTO, AIModelType } from '../mock/types'

const TYPE_LABEL: Record<AIModelType, string> = { chat: '对话', vision: '视觉', code: '代码', embedding: '向量' }

/** AI 模型管理：模型注册、密钥接入、连通性测试与状态 */
export default function AIModelPage() {
  const { data, loading, error, reload } = useApi(() => api.listAIModels({ pageSize: 50 }), [])
  const [editing, setEditing] = useState<Partial<AIModelDTO> | null>(null)
  const [pingingId, setPingingId] = useState<string | null>(null)
  const [pingResult, setPingResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null)

  const save = async () => {
    if (!editing) return
    await api.saveAIModel(editing)
    setEditing(null)
    setPingResult(null)
    reload()
  }
  const remove = async (id: string) => {
    await api.deleteAIModel(id)
    setPingResult(null)
    reload()
  }
  const ping = async (id: string) => {
    setPingingId(id)
    setPingResult(null)
    try {
      const r = await api.pingAIModel(id)
      setPingResult({
        id,
        ok: r.code === 0 && !!r.data?.ok,
        msg: r.code === 0 ? r.data?.message || (r.data?.ok ? '模型可用，连接成功' : '测试未通过') : r.message,
      })
    } finally {
      setPingingId(null)
    }
  }

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">AI 模型管理</h2>
          <p className="fp-sub">智能生成组件 / 代码加注释 / AI 问答 + 自定义机器人的模型底座（需填写 API Key 才能接入对话）</p>
        </div>
        <Button
          onClick={() =>
            setEditing({ name: '', provider: '', type: 'chat', baseUrl: '', apiKey: '', status: 'unset' })
          }
        >
          ＋ 接入模型
        </Button>
      </div>
      {loading && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
          <Spin />
        </div>
      )}
      {error && (
        <Alert type="error" message={error} showIcon style={{ marginBottom: 10 }} />
      )}
      {!loading && !error && (data?.list ?? []).length === 0 && (
        <Alert
          type="info"
          showIcon
          message="尚未接入任何 AI 模型"
          description="AI 助手需要先接入模型并填写 API Key 才能对话。点击右上角「接入模型」开始配置（如 DeepSeek / 通义 / OpenAI 等）。"
          style={{ marginBottom: 10 }}
        />
      )}
      {pingResult && (
        <Alert
          type={pingResult.ok ? 'success' : 'error'}
          showIcon
          message={pingResult.ok ? '连通性测试通过' : '连通性测试未通过'}
          description={pingResult.msg}
          closable
          onClose={() => setPingResult(null)}
          style={{ marginBottom: 10 }}
        />
      )}
      {!loading && !error && (
        <div className="grid3">
          {(data?.list ?? []).map((m) => (
            <div key={m.id} className="card">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <b style={{ color: '#e6edf3' }}>{m.name}</b>
                <Tag color={m.status === 'ready' ? '#4ade80' : m.status === 'error' ? '#ff8585' : '#e0b15a'}>
                  {m.status}
                </Tag>
              </div>
              <div className="muted2" style={{ margin: '8px 0' }}>
                {m.provider} · {TYPE_LABEL[m.type]}
              </div>
              <div className="muted2" style={{ wordBreak: 'break-all' }}>{m.baseUrl}</div>
              <div className="muted2" style={{ marginTop: 4 }}>
                {m.apiKey ? '🔑 已配置密钥' : '⚠️ 未配置密钥（无法对话）'}
              </div>
              <div className="fp-toolbar" style={{ marginTop: 10 }}>
                <Button size="small" onClick={() => setEditing(m)}>
                  编辑
                </Button>
                <Button size="small" onClick={() => ping(m.id)} loading={pingingId === m.id}>
                  测试连接
                </Button>
                <Button size="small" danger onClick={() => remove(m.id)}>
                  删除
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <Modal title="接入模型" onClose={() => setEditing(null)}>
          <Field label="模型名称">
            <Input
              value={editing.name || ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="如：DeepSeek 对话"
            />
          </Field>
          <Field label="供应商">
            <Input
              value={editing.provider || ''}
              onChange={(e) => setEditing({ ...editing, provider: e.target.value })}
              placeholder="deepseek / openai / qwen-token-plan-cn ..."
            />
          </Field>
          <Field label="模型标识">
            <Input
              value={editing.model || ''}
              onChange={(e) => setEditing({ ...editing, model: e.target.value })}
              placeholder="如 deepseek-chat / gpt-4o-mini（须为 pi-ai 目录内真实 id）"
            />
          </Field>
          <Field label="类型">
            <Select
              value={editing.type || 'chat'}
              onChange={(e) => setEditing({ ...editing, type: e.target.value as AIModelType })}
            >
              {Object.keys(TYPE_LABEL).map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABEL[t as AIModelType]}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Base URL">
            <Input
              value={editing.baseUrl || ''}
              onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })}
              placeholder="留空使用供应商默认地址"
            />
          </Field>
          <Field label="API Key">
            <Input
              type="password"
              value={editing.apiKey ?? ''}
              onChange={(e) => setEditing({ ...editing, apiKey: e.target.value })}
              placeholder="填写后模型方能接入对话"
            />
          </Field>
          <div className="fp-toolbar">
            <Button onClick={save}>保存</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
