import { useState } from 'react'
import { useDesignerStore } from '../store/useDesignerStore'
import type { RouteConfig } from '../types'

// 单个 JSON 字段：失焦时解析并提交，解析失败给出提示
function JsonFieldBlock({
  label,
  value,
  onCommit,
  hint
}: {
  label: string
  value: Record<string, unknown>
  onCommit: (v: Record<string, unknown>) => void
  hint?: string
}) {
  const [text, setText] = useState(() => JSON.stringify(value, null, 2))
  const [err, setErr] = useState('')

  const commit = () => {
    try {
      const parsed = JSON.parse(text || '{}')
      setErr('')
      onCommit(parsed)
    } catch (e) {
      setErr('JSON 解析失败：' + (e as Error).message)
    }
  }

  return (
    <div className="rc-block">
      <h4>{label}</h4>
      <div className="field">
        <textarea value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} />
      </div>
      {hint && <div className="rc-hint">{hint}</div>}
      {err && <div className="rc-err">{err}</div>}
    </div>
  )
}

export default function RouteConfigPanel({ route }: { route: RouteConfig }) {
  const updateRoute = useDesignerStore((s) => s.updateRoute)

  return (
    <div className="route-config">
      <div className="rc-block">
        <h4>基本信息</h4>
        <div className="field">
          <label>页面名称</label>
          <input value={route.name} onChange={(e) => updateRoute(route.id, { name: e.target.value })} />
        </div>
        <div className="field">
          <label>路由路径</label>
          <input value={route.path} onChange={(e) => updateRoute(route.id, { path: e.target.value })} />
        </div>
      </div>

      <JsonFieldBlock
        key={'params-' + route.id}
        label="参数设置 (params)"
        value={route.params}
        hint="路由参数，例如 { region: 'all' }"
        onCommit={(v) => updateRoute(route.id, { params: v })}
      />
      <JsonFieldBlock
        key={'props-' + route.id}
        label="属性调整 (props)"
        value={route.props}
        hint="页面级属性，供组件 / 模板读取"
        onCommit={(v) => updateRoute(route.id, { props: v })}
      />
      <JsonFieldBlock
        key={'state-' + route.id}
        label="状态管理 (state)"
        value={route.state}
        hint="页面级状态，例如 { lastRefresh: '2026-07-27' }"
        onCommit={(v) => updateRoute(route.id, { state: v })}
      />
    </div>
  )
}
