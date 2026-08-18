import { useState } from 'react'
import { App, Button, Input, Select } from 'antd'
import { api } from '../mock'
import { useApi } from './useApi'
import { PageHeader } from './common'

export default function ToolsPage() {
  const { message } = App.useApp()
  const { data, loading } = useApi(() => api.listAITools(), [])
  const tools = data ?? []
  const [toolId, setToolId] = useState('')
  const [args, setArgs] = useState<Record<string, string>>({})
  const [result, setResult] = useState<unknown>(null)
  const [running, setRunning] = useState(false)

  const selected = tools.find((t) => t.id === toolId) ?? null

  const run = async () => {
    if (!toolId) {
      message.warning('请选择工具')
      return
    }
    setRunning(true)
    const payload: Record<string, unknown> = {}
    for (const a of selected?.args ?? []) {
      const v = args[a.key] ?? ''
      if (a.required && !v) {
        message.warning(`参数 ${a.key} 必填`)
        setRunning(false)
        return
      }
      payload[a.key] = v
    }
    const r = await api.runAITool(toolId, payload)
    setResult(r.code === 0 ? r.data : { error: r.message })
    setRunning(false)
  }

  return (
    <div className="feature-page">
      <PageHeader title="Agent 工具" subtitle="数据集元信息 / 组件搜索 / 代码片段搜索 / 资产搜索，供 Agent 与人工调试调用" />
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {tools.map((t) => (
          <div
            key={t.id}
            onClick={() => {
              setToolId(t.id)
              setArgs({})
              setResult(null)
            }}
            style={{
              flex: '1 1 240px',
              padding: 10,
              cursor: 'pointer',
              background: toolId === t.id ? 'rgba(0, 113, 227,.1)' : '#ffffff',
              border: '1px solid ' + (toolId === t.id ? 'rgba(0, 113, 227,.4)' : '#e5e5ea'),
              borderRadius: 8,
            }}
          >
            <b>{t.name}</b>
            <div style={{ fontSize: 12, color: '#86868b', marginTop: 4 }}>{t.description}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
        <Select
          style={{ width: 220 }}
          placeholder="选择工具"
          value={toolId || undefined}
          loading={loading}
          onChange={setToolId}
          options={tools.map((t) => ({ value: t.id, label: t.name }))}
        />
        {selected?.args.map((a) => (
          <Input
            key={a.key}
            style={{ width: 200 }}
            placeholder={`${a.key}${a.required ? ' *' : ''}`}
            value={args[a.key] ?? ''}
            onChange={(e) => setArgs({ ...args, [a.key]: e.target.value })}
          />
        ))}
        <Button type="primary" loading={running} onClick={run}>
          运行
        </Button>
      </div>
      {result !== null && (
        <pre
          style={{
            background: '#f5f5f7',
            border: '1px solid #e5e5ea',
            borderRadius: 8,
            padding: 12,
            maxHeight: 420,
            overflow: 'auto',
            fontSize: 12.5,
            color: '#1d1d1f',
            whiteSpace: 'pre-wrap',
          }}
        >
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </div>
  )
}
