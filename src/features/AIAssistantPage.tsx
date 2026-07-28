import { useState } from 'react'
import { useApi } from './useApi'
import { api } from '../mock'
import { Tag } from './common'
import type { AIBotDTO } from '../mock/types'

type Lang = 'vue' | 'echart' | 'html'

/** AI 助手：智能问答 + 自定义机器人 + 智能生成 Vue/EChart/HTML 组件 */
export default function AIAssistantPage() {
  const { data: bots, reload: reloadBots } = useApi(() => api.listAIBots({ pageSize: 50 }), [])
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

  const send = async () => {
    const text = input.trim()
    if (!text || chatLoading) return
    setMessages((m) => [...m, { role: 'u', text }])
    setInput('')
    setChatLoading(true)
    try {
      const r = await api.aiChat(text)
      const reply = r.code === 0 ? r.data.reply : '（服务异常，请稍后重试）'
      setMessages((m) => [...m, { role: 'a', text: reply }])
    } catch {
      setMessages((m) => [...m, { role: 'a', text: '（网络异常，请稍后重试）' }])
    } finally {
      setChatLoading(false)
    }
  }

  const runGen = async () => {
    if (genLoading) return
    setGenLoading(true)
    try {
      const r = await api.aiGenerate(genPrompt, lang)
      setCode(r.code === 0 ? r.data.code : '// 生成失败，请稍后重试')
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
  const deleteBot = async (b: AIBotDTO) => {
    if (!window.confirm(`确定删除机器人「${b.name}」？`)) return
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
      <div className="tabs">
        <span className={'tab' + (tab === 'chat' ? ' active' : '')} onClick={() => setTab('chat')}>智能问答</span>
        <span className={'tab' + (tab === 'gen' ? ' active' : '')} onClick={() => setTab('gen')}>生成组件</span>
        <span className={'tab' + (tab === 'bot' ? ' active' : '')} onClick={() => setTab('bot')}>我的机器人</span>
      </div>

      {tab === 'chat' && (
        <div className="card" style={{ height: 420, display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
            {messages.map((m, i) => (
              <div key={i} style={{ textAlign: m.role === 'u' ? 'right' : 'left', margin: '8px 0' }}>
                <span style={{ display: 'inline-block', padding: '8px 12px', borderRadius: 10, background: m.role === 'u' ? '#1c3a6e' : '#111a27', color: '#e6edf3', maxWidth: '80%' }}>{m.text}</span>
              </div>
            ))}
            {chatLoading && <div style={{ textAlign: 'left', margin: '8px 0', color: '#9aa7b4', fontSize: 12 }}>助手正在思考…</div>}
          </div>
          <div className="flex" style={{ marginTop: 8 }}>
            <input className="inp" style={{ flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="描述你的大屏需求…" />
            <button className="btn" onClick={send} disabled={chatLoading}>{chatLoading ? '生成中…' : '发送'}</button>
          </div>
        </div>
      )}

      {tab === 'gen' && (
        <div className="grid2">
          <div className="card">
            <div className="field"><span className="field-label">目标语言</span>
              <span className="field-ctrl">
                <select className="inp" value={lang} onChange={(e) => setLang(e.target.value as Lang)}>
                  <option value="vue">Vue 组件</option><option value="echart">EChart 组件</option><option value="html">HTML 组件</option>
                </select>
              </span>
            </div>
            <div className="field"><span className="field-label">需求描述</span>
              <span className="field-ctrl"><input className="inp" value={genPrompt} onChange={(e) => setGenPrompt(e.target.value)} placeholder="例如：展示月度销售额的柱状图" /></span>
            </div>
            <button className="btn" onClick={runGen} disabled={genLoading}>{genLoading ? '生成中…' : '✨ 智能生成'}</button>
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
                <button className="btn sm" disabled={busyBotId === b.id} onClick={() => toggleBot(b)}>
                  {b.enabled ? '停用' : '启用'}
                </button>
                <button className="btn sm" disabled={busyBotId === b.id} onClick={() => deleteBot(b)}>
                  删除
                </button>
              </div>
            </div>
          ))}
          {!bots?.list.length && <div className="empty-tip">暂无机器人</div>}
        </div>
      )}
    </div>
  )
}
