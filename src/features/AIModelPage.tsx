import { useMemo, useState } from 'react'
import { Alert, Button, Spin } from 'antd'
import { useApi } from './useApi'
import { api } from '../mock'
import { Modal, Field, Input, Select, Tag } from './common'
import type { AIModelDTO, AIModelType, ProviderCatalogItem } from '../mock/types'

const TYPE_LABEL: Record<AIModelType, string> = { chat: '对话', vision: '视觉', code: '代码', embedding: '向量' }

/** AI 模型管理：模型注册、密钥接入、连通性测试与状态 */
export default function AIModelPage() {
  const { data, loading, error, reload } = useApi(() => api.listAIModels({ pageSize: 50 }), [])
  const { data: catalog } = useApi<ProviderCatalogItem[]>(() => api.listAIProviderCatalog(), [])
  const [editing, setEditing] = useState<Partial<AIModelDTO> | null>(null)
  const [pingingId, setPingingId] = useState<string | null>(null)
  const [pingResult, setPingResult] = useState<{ id: string; ok: boolean; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  const providerOptions = useMemo(() => {
    return (catalog ?? []).map(p => ({ label: p.name, value: p.key }))
  }, [catalog])

  const selectedProvider = useMemo(() => {
    return (catalog ?? []).find(p => {
      if (p.key === editing?.provider) return true
      if (p.aliases.includes(editing?.provider ?? '')) return true
      return false
    })
  }, [catalog, editing?.provider])

  const isCustomProvider = selectedProvider?.key === 'custom-openai'

  const modelOptions = useMemo(() => {
    if (!selectedProvider || isCustomProvider) return []
    return selectedProvider.models.map(m => ({
      label: `${m.name}（${m.id}）`,
      value: m.id,
      desc: `${(m.contextWindow / 1000).toFixed(0)}k 上下文 · ${m.reasoning ? '推理模型' : '对话模型'}`,
    }))
  }, [selectedProvider, isCustomProvider])

  const save = async () => {
    if (!editing) return
    setSaving(true)
    setSaveError(null)
    try {
      await api.saveAIModel(editing)
      setEditing(null)
      reload()
    } catch (e: any) {
      setSaveError(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
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
            setEditing({ name: '', provider: '', type: 'chat', baseUrl: '', apiKey: '', status: 'unset', group: 'default', priority: 0 })
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
                {m.hasApiKey || m.apiKeyMasked
                  ? `🔑 已配置 ${m.apiKeyMasked || ''}`
                  : '⚠️ 未配置密钥（无法对话）'}
              </div>
              <div className="muted2" style={{ marginTop: 4 }}>
                分组 {m.group || 'default'} · 优先级 {m.priority ?? 0}
              </div>
              <div className="fp-toolbar" style={{ marginTop: 10 }}>
                <Button
                  size="small"
                  onClick={() =>
                    setEditing({
                      ...m,
                      apiKey: '',
                      group: m.group || 'default',
                      priority: m.priority ?? 0,
                    })
                  }
                >
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
        <Modal title="接入模型" onClose={() => { setEditing(null); setSaveError(null) }}>
          <Field label="模型名称">
            <Input
              value={editing.name || ''}
              onChange={(e) => setEditing({ ...editing, name: e.target.value })}
              placeholder="如：Kimi K3 生产"
            />
          </Field>
          <Field label="供应商">
            <Select
              value={editing.provider || ''}
              onChange={(e) => setEditing({ ...editing, provider: e.target.value, model: '' })}
              placeholder="选择供应商"
            >
              {providerOptions.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </Select>
          </Field>
          <Field label={isCustomProvider ? '模型标识' : '模型'}>
            {isCustomProvider ? (
              <Input
                value={editing.model || ''}
                onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                placeholder="如 gpt-4o-mini / claude-sonnet-4-5 / kimi-k3 等"
              />
            ) : (
              <Select
                value={editing.model || ''}
                onChange={(e) => setEditing({ ...editing, model: e.target.value })}
                disabled={!selectedProvider}
                placeholder={selectedProvider ? '选择模型' : '请先选择供应商'}
              >
                {modelOptions.map(o => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </Select>
            )}
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
          <Field label={isCustomProvider ? 'Base URL' : 'Base URL（可选）'}>
            <Input
              value={editing.baseUrl || ''}
              onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })}
              placeholder={isCustomProvider ? '如 https://api.deepseek.com/v1' : '留空使用供应商默认地址'}
            />
          </Field>
          <Field label="分组">
            <Input
              value={editing.group || 'default'}
              onChange={(e) => setEditing({ ...editing, group: e.target.value.trim() || 'default' })}
              placeholder="同一分组内的可用模型互为备用"
            />
          </Field>
          <Field label="优先级">
            <Input
              type="number"
              value={editing.priority ?? 0}
              onChange={(e) => setEditing({ ...editing, priority: Number(e.target.value) || 0 })}
              placeholder="数字越小越优先"
            />
          </Field>
          <Field label="API Key">
            <Input
              type="password"
              value={editing.apiKey ?? ''}
              onChange={(e) => setEditing({ ...editing, apiKey: e.target.value })}
              placeholder={editing.hasApiKey ? '已配置密钥，留空保持不变' : '填写后模型方能接入对话'}
            />
          </Field>
          {saveError && (
            <Alert type="error" message={saveError} showIcon style={{ marginBottom: 12 }} />
          )}
          <div className="fp-toolbar">
            <Button onClick={save} loading={saving}>保存</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
