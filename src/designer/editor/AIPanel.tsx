import { useState } from 'react'
import { App, Button, Input, Space, Tag, Tooltip } from 'antd'
import { CloseOutlined, RobotOutlined } from '@ant-design/icons'
import { api } from '../../mock/api'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import type {
  AIDesignIntent,
  AIDesignReview,
  AIDesignSchema,
  ComponentInstance,
  PageConfig,
} from '../../data/types'

/** 大屏设计器内嵌的 AI 编排助手：基于当前画布生成/调整大屏结构 */
export default function AIPanel({ onClose }: { onClose: () => void }) {
  const { message } = App.useApp()
  const route = useDesignerStore((s) =>
    s.routes.find((r) => r.id === s.selectedRouteId),
  )
  const applyAISchema = useDesignerStore((s) => s.applyAISchema)

  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [thought, setThought] = useState('')
  const [intent, setIntent] = useState<AIDesignIntent | null>(null)
  const [review, setReview] = useState<AIDesignReview | null>(null)
  const [schema, setSchema] = useState<AIDesignSchema | null>(null)
  const [error, setError] = useState('')
  const [snapshot, setSnapshot] = useState<{
    components: ComponentInstance[]
    page: PageConfig
  } | null>(null)

  /** 当前画布 → AI baseSchema（让 AI 基于现状编排，而不是凭空生成） */
  const currentSchema = (): AIDesignSchema | undefined => {
    if (!route) return undefined
    return {
      version: '1.0',
      page: {
        width: route.page.width,
        height: route.page.height,
        background: route.page.background,
      },
      components: route.components.map((c) => ({
        id: c.id,
        type: c.type,
        style: { ...c.style },
        props: { ...c.props },
        ...(c.dataSource ? { dataSource: c.dataSource } : {}),
      })),
    }
  }

  const run = async (mode: 'current' | 'new') => {
    const p = prompt.trim()
    if (!p) {
      message.warning('请输入编排指令')
      return
    }
    setLoading(true)
    setError('')
    setSchema(null)
    setThought('')
    setIntent(null)
    setReview(null)
    const result: { schema: AIDesignSchema | null } = { schema: null }
    try {
      await api.aiDesign(p, {
        baseSchema: mode === 'current' ? currentSchema() : undefined,
        onDelta: (t) => setThought((prev) => prev + t),
        onIntent: setIntent,
        onSchema: (s) => {
          result.schema = s
        },
        onReview: setReview,
        onFallback: (info) =>
          message.info(
            `模型 ${info.from || ''} 调用失败，已自动切换到 ${info.to || ''}`,
          ),
        onError: (m) => {
          setError(m)
          setLoading(false)
        },
      })
      setLoading(false)
      const final = result.schema
      if (final && final.components?.length) {
        setSchema(final)
        message.success('编排完成，确认后应用到大屏')
      } else if (!error) {
        message.warning('AI 未返回有效的编排结果')
      }
    } catch {
      setLoading(false)
      setError('编排请求失败')
    }
  }

  const apply = () => {
    if (!schema) {
      message.warning('暂无编排结果')
      return
    }
    const st = useDesignerStore.getState()
    const current = st.routes.find((r) => r.id === st.selectedRouteId)
    if (!current) return
    setSnapshot({ components: current.components, page: { ...current.page } })
    applyAISchema(schema)
    message.success('已应用到大屏画布，可撤销')
  }

  const undo = () => {
    if (!snapshot) return
    const st = useDesignerStore.getState()
    st.updateRoute(st.selectedRouteId!, {
      components: snapshot.components,
      page: snapshot.page,
    })
    setSnapshot(null)
    message.success('已撤销 AI 编排应用')
  }

  return (
    <div
      style={{
        position: 'fixed',
        top: 60,
        right: 16,
        bottom: 16,
        width: 380,
        zIndex: 1200,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: 12,
        background: '#0b1325',
        border: '1px solid #1e2a3a',
        borderRadius: 8,
        color: '#e8f0ff',
        boxShadow: '0 8px 30px rgba(0,0,0,0.45)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <b style={{ fontSize: 14 }}>
          <RobotOutlined style={{ marginRight: 6, color: '#00d4ff' }} />
          AI 编排大屏
        </b>
        <Tooltip title="关闭">
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={onClose} />
        </Tooltip>
      </div>

      <Input.TextArea
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="例如：把标题移到顶部，左侧放三个指标卡，右侧加一个销售趋势折线图，底部放数据表格"
      />

      <Space wrap>
        <Button
          type="primary"
          size="small"
          loading={loading}
          onClick={() => run('current')}
        >
          基于当前画布编排
        </Button>
        <Button size="small" loading={loading} onClick={() => run('new')}>
          重新排布
        </Button>
      </Space>

      {error && <div style={{ color: '#ff6b6b', fontSize: 12 }}>⚠️ {error}</div>}

      {loading && (
        <div style={{ fontSize: 12, color: '#9fb0cc', maxHeight: 90, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {thought || 'AI 正在编排当前大屏…'}
        </div>
      )}

      {intent && !loading && (
        <div style={{ fontSize: 12, color: '#9fb0cc' }}>
          <b style={{ color: '#69b1ff' }}>设计意图：</b>
          {intent.summary}
          <div style={{ marginTop: 4 }}>
            {(intent.metrics || []).map((m, i) => (
              <Tag key={i} color="blue" style={{ marginBottom: 4 }}>
                {m}
              </Tag>
            ))}
          </div>
        </div>
      )}

      {review && !loading && (
        <div style={{ fontSize: 12, color: '#9fb0cc' }}>
          <b style={{ color: '#facc15' }}>结构校验：</b>
          {review.issues?.length ? review.issues.join('；') : '通过'}
        </div>
      )}

      {schema && !loading && (
        <div
          style={{
            padding: '8px 10px',
            background: 'rgba(0,212,255,0.08)',
            border: '1px solid rgba(0,212,255,0.25)',
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          编排完成：共 {schema.components.length} 个组件
          {schema.page ? ` · 画布 ${schema.page.width}×${schema.page.height}` : ''}
        </div>
      )}

      <div style={{ marginTop: 'auto', display: 'flex', gap: 8 }}>
        <Button size="small" onClick={onClose} style={{ flex: 1 }}>
          取消
        </Button>
        {snapshot && (
          <Button size="small" danger onClick={undo} style={{ flex: 1 }}>
            撤销应用
          </Button>
        )}
        <Button
          size="small"
          type="primary"
          disabled={!schema || loading}
          onClick={apply}
          style={{ flex: 1 }}
        >
          应用到大屏
        </Button>
      </div>
    </div>
  )
}
