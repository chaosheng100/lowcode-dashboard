import { useState } from 'react'
import { Alert, Button, Input, Popconfirm, Select, Tabs } from 'antd'
import { useApi } from './useApi'
import { api } from '../mock'
import { Tag } from './common'
import { useDesignerStore } from '../data/store/useDesignerStore'
import type { AIBotDTO, AIModelDTO } from '../mock/types'

type Lang = 'vue' | 'echart' | 'html'

/** AI 助手：智能问答 + 自定义机器人 + 智能生成 Vue/EChart/HTML 组件 */
export default function AIAssistantPage() {
  const { data: bots, reload: reloadBots } = useApi(() => api.listAIBots({ pageSize: 50 }), [])
  const { data: models } = useApi(() => api.listAIModels({ pageSize: 50 }), [])
  const selectRoute = useDesignerStore((s) => s.selectRoute)

  // 是否已有「已配置密钥」的可对话模型；缺模型时禁止对话并提示用户接入
  const hasModel = (models?.list ?? []).some((m: AIModelDTO) => !!m.apiKey)

  const [tab, setTab] = useState<'chat' | 'gen' | 'bot'>('chat')
  const [messages, setMessages] = useState<{ role: 'u' | 'a'; text: string }[]>([
    { role: 'a', text: '你好，我是大屏编排助手，可以帮你生成组件、规划布局或解释数据。' }
  ])
  const [input, setInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const [genPrompt, setGenPrompt] = useState('')
  const [lang, setLang] = useState<Lang>('vue')
  const [code, setCode] = useState('')
  const [genLoading, setGenLoading] = useState(false)
  const [busyBotId, setBusyBotId] = useState<string | null>(null)

  // 把增量 delta 追加到「最后一条助手消息」，实现打字机式流式渲染
  const appendToLastAssistant = (delta: string) =>
    setMessages((m) => {
      const copy = m.slice()
      const last = copy[copy.length - 1]
      if (last && last.role === 'a') copy[copy.length - 1] = { role: 'a', text: last.text + delta }
      return copy
    })
  const setLastAssistant = (text: string) =>
    setMessages((m) => {
      const copy = m.slice()
      if (copy[copy.length - 1]?.role === 'a') copy[copy.length - 1] = { role: 'a', text }
      return copy
    })

  const send = async () => {
    const text = input.trim()
    if (!text || chatLoading || !hasModel) return
    // 先压入空助手气泡，随后由 onDelta 逐块填充
    setMessages((m) => [...m, { role: 'u', text }, { role: 'a', text: '' }])
    setInput('')
    setChatLoading(true)
    try {
      const r = await api.aiChat(text, (delta) => appendToLastAssistant(delta))
      // 失败时不显示笼统的「服务异常」，而是把后端真实原因（如未配置密钥 / 模型不存在）透出
      if (r.code !== 0) {
        setLastAssistant(`⚠️ 对话失败：${r.message || '请稍后重试'}（可在「AI 模型管理」检查密钥与模型配置）`)
      }
    } catch {
      setLastAssistant('（网络异常，请稍后重试）')
    } finally {
      setChatLoading(false)
    }
  }

  const runGen = async () => {
    if (genLoading || !hasModel) return
    setGenLoading(true)
    setCode('')
    try {
      // 逐块回填到 code 状态，实现代码流式输出
      const r = await api.aiGenerate(genPrompt, lang, (delta) => setCode((c) => c + delta))
      if (r.code !== 0) {
        setCode(`// 生成失败：${r.message || '请稍后重试'}（可在「AI 模型管理」检查密钥与模型配置）`)
      }
    } catch {
      setCode('// 网络异常，请稍后重试')
    } finally {
      setGenLoading(false)
    }
  }

  const toggleBot = async (b: AIBotDTO) => {
    setBusyBotId(b.id)
    try {
      await api.saveAIBot({ id: b.id, enabled: !b.enabled })
      reloadBots()
    } finally {
      setBusyBotId(null)
    }
  }
  // 删除确认由 Popconfirm 承载，这里只做删除与刷新
  const deleteBot = async (b: AIBotDTO) => {
    setBusyBotId(b.id)
    try {
      await api.deleteAIBot(b.id)
      reloadBots()
    } finally {
      setBusyBotId(null)
    }
  }

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">AI 助手</h2>
          <p className="fp-sub">智能问答 · 自定义机器人 · 智能生成 Vue / EChart / HTML 组件 · 代码自动加注释与格式化</p>
        </div>
      </div>

      {!hasModel && (
        <Alert
          type="warning"
          showIcon
          style={{ marginBottom: 14 }}
          message="尚未接入可用的 AI 模型，AI 助手暂不可对话"
          description={
            <div className="flex" style={{ alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <span>请先在「AI 模型管理」中接入至少一个模型并填写 API Key，才能使用问答与组件生成。</span>
              <Button type="primary" size="small" onClick={() => selectRoute('/ai/models')}>
                前往接入模型
              </Button>
            </div>
          }
        />
      )}

      <Tabs
        activeKey={tab}
        onChange={(k) => setTab(k as 'chat' | 'gen' | 'bot')}
        items={[
          { key: 'chat', label: '智能问答' },
          { key: 'gen', label: '生成组件' },
          { key: 'bot', label: '我的机器人' },
        ]}
      />

      {tab === 'chat' && (
        <div className="card" style={{ height: 420, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {messages.map((m, i) => {
              const streamingLast = m.role === 'a' && chatLoading && i === messages.length - 1
              return (
                <div key={i} style={{ textAlign: m.role === 'u' ? 'right' : 'left', margin: '8px 0' }}>
                  <span style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 10, background: m.role === 'u' ? '#1c3a6e' : '#111a27', color: '#e6edf3', maxWidth: '80%', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                    {m.text || (streamingLast ? '助手正在思考…' : '')}
                    {streamingLast && m.text ? '▌' : ''}
                  </span>
                </div>
              )
            })}
          </div>
          <div className="flex" style={{ marginTop: 8 }}>
            <Input style={{ flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="描述你的大屏需求…" disabled={!hasModel} />
            <Button onClick={send} disabled={chatLoading || !hasModel}>{chatLoading ? '生成中…' : '发送'}</Button>
          </div>
        </div>
      )}

      {tab === 'gen' && (
        <div className="grid2">
          <div className="card">
            <div className="field"><span className="field-label">目标语言</span>
              <span className="field-ctrl">
                <Select<Lang>
                  style={{ minWidth: 160 }}
                  value={lang}
                  onChange={setLang}
                  options={[
                    { value: 'vue', label: 'Vue 组件' },
                    { value: 'echart', label: 'EChart 组件' },
                    { value: 'html', label: 'HTML 组件' },
                  ]}
                />
              </span>
            </div>
            <div className="field"><span className="field-label">需求描述</span>
              <span className="field-ctrl"><Input value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)} placeholder="例如：展示月度销售额的柱状图" disabled={!hasModel} /></span>
            </div>
            <Button onClick={runGen} disabled={genLoading || !hasModel}>{genLoading ? '生成中…' : '✨ 智能生成'}</Button>
          </div>
          <div className="card">
            <div className="muted2" style={{ marginBottom: 8 }}>生成结果（可复制进自定义组件）</div>
            <pre style={{ background: '#0b111b', padding: 12, borderRadius: 8, fontSize: 12, color: '#9ec1ff', overflow: 'auto', maxHeight: 320, margin: 0 }}>{code || '// 点击「智能生成」后在此显示代码'}</pre>
          </div>
        </div>
      )}

      {tab === 'bot' && (
        <div className="grid3">
          {(bots?.list ?? []).map((b: AIBotDTO) => (
            <div key={b.id} className="card">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <b style={{ color: '#e6edf3' }}>{b.name}</b><Tag color={b.enabled ? '#4ade80' : '#ff8585'}>{b.enabled ? '已启用' : '停用'}</Tag>
              </div>
              <div className="muted2" style={{ margin: '8px 0' }}>{b.prompt}</div>
              <div className="muted2">绑定模型：{b.modelId}</div>
              <div className="fp-toolbar" style={{ marginTop: 10 }}>
                <Button size="small" disabled={busyBotId === b.id} onClick={() => toggleBot(b)}>
                  {b.enabled ? '停用' : '启用'}
                </Button>
                <Popconfirm
                  title={`确定删除机器人「${b.name}」？`}
                  okText="删除"
                  cancelText="取消"
                  onConfirm={() => deleteBot(b)}
                >
                  <Button size="small" danger disabled={busyBotId === b.id}>删除</Button>
                </Popconfirm>
              </div>
            </div>
          ))}
          {!bots?.list.length && <div className="empty-tip">暂无机器人</div>}
        </div>
      )}
    </div>
  )
}
