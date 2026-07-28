import { useState } from 'react'
import { useApi } from './useApi'
import { api } from '../mock'
import { Tag } from './common'
import type { AIBotDTO } from '../mock/types'

type Lang = 'vue' | 'echart' | 'html'

function generate(prompt: string, lang: Lang): string {
  const p = prompt || '示例'
  if (lang === 'vue') {
    return `<template>\n  <div class="card">\n    <h3>{{ title }}</h3>\n    <div class="value">{{ value }}</div>\n  </div>\n</template>\n\n<script setup>\nconst props = defineProps({\n  title: { type: String, default: '${p}' },\n  value: { type: [Number, String], default: 0 }\n})\n</script>`
  }
  if (lang === 'echart') {
    return `// EChart 组件：基于 ${p}\n option = {\n  xAxis: { type: 'category', data: ['一月','二月','三月'] },\n  yAxis: { type: 'value' },\n  series: [{ type: 'bar', data: [120, 200, 150], itemStyle: { color: '#4f8cff' } }]\n}`
  }
  return `<!-- HTML 组件：${p} -->\n<div class="widget" style="padding:12px">\n  <strong>${p}</strong>\n  <p>由 AI 生成的静态片段</p>\n</div>`
}

/** AI 助手：智能问答 + 自定义机器人 + 智能生成 Vue/EChart/HTML 组件 */
export default function AIAssistantPage() {
  const { data: bots } = useApi(() => api.listAIBots({ pageSize: 50 }), [])
  const [tab, setTab] = useState<'chat' | 'gen' | 'bot'>('chat')
  const [messages, setMessages] = useState<{ role: 'u' | 'a'; text: string }[]>([
    { role: 'a', text: '你好，我是大屏编排助手，可以帮你生成组件、规划布局或解释数据。' }
  ])
  const [input, setInput] = useState('')
  const [genPrompt, setGenPrompt] = useState('')
  const [lang, setLang] = useState<Lang>('vue')
  const [code, setCode] = useState('')

  const send = () => {
    if (!input.trim()) return
    const reply = `已理解「${input}」。建议：使用 ${['折线图', '指标卡', '表格'][input.length % 3]} 呈现，并绑定对应数据集；需要我直接生成组件代码吗？`
    setMessages((m) => [...m, { role: 'u', text: input }, { role: 'a', text: reply }])
    setInput('')
  }
  const runGen = () => setCode(generate(genPrompt, lang))

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
          </div>
          <div className="flex" style={{ marginTop: 8 }}>
            <input className="inp" style={{ flex: 1 }} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="描述你的大屏需求…" />
            <button className="btn" onClick={send}>发送</button>
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
            <button className="btn" onClick={runGen}>✨ 智能生成</button>
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
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
