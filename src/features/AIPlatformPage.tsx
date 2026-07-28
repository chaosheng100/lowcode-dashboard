import { useDesignerStore } from '../data/store/useDesignerStore'
import { Section, Stat } from './common'

/** 其他系统：外部 AI 模型平台接入（统一跳转到 AI 模型管理） */
export default function AIPlatformPage() {
  const selectRoute = useDesignerStore((s) => s.selectRoute)
  return (
    <div className="feature-page">
      <div className="fp-head">
        <div><h2 className="fp-title">AI 模型平台</h2><p className="fp-sub">外部 AI 平台模型接入画布智能组件</p></div>
      </div>
      <div className="flex" style={{ marginBottom: 14 }}>
        <Stat label="已接入平台" value={3} accent="#4f8cff" />
        <Stat label="可用模型" value={4} accent="#22d3ee" />
        <Stat label="自定义机器人" value={2} accent="#a855f7" />
      </div>
      <Section title="接入方式" desc="将外部平台模型注册为画布可用的智能能力">
        <ul className="muted2" style={{ lineHeight: 1.9, margin: 0 }}>
          <li>通义 / 文心 / openai：配置 Base URL 与密钥即接入对话与代码模型</li>
          <li>本地模型（Ollama / vLLM）：填写本地地址，离线可用的私有智能</li>
          <li>接入后在「AI 助手」中生成组件、加注释，或在「模型管理」统一治理</li>
        </ul>
        <div className="fp-toolbar">
          <button className="btn" onClick={() => selectRoute('/ai/models')}>前往「AI 模型管理」</button>
          <button className="btn" onClick={() => selectRoute('/ai/assistant')}>前往「AI 助手」</button>
        </div>
      </Section>
    </div>
  )
}
