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
import { currentCanvasSchema } from '../../data/ai/schemaUtils'
import { useGenHistory, type GenVersion } from '../../features/ai/aiGenHistory'
import GenHistoryPanel from '../../features/ai/GenHistoryPanel'

/** 大屏设计器内嵌的 AI 编排助手：基于当前画布生成/调整大屏结构，自动记录版本历史 */
export default function AIPanel({
  onClose,
  embedded = false,
}: {
  onClose?: () => void
  embedded?: boolean
}) {
  const { message } = App.useApp()
  const route = useDesignerStore((s) =>
    s.routes.find((r) => r.id === s.selectedRouteId),
  )
  const applyAISchema = useDesignerStore((s) => s.applyAISchema)
  const {
    versions,
    activeId,
    setActiveId,
    addVersion,
    renameVersion,
    deleteVersion,
    clearAll,
    latest,
  } = useGenHistory(route?.id)

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
  const [continueFrom, setContinueFrom] = useState<GenVersion | null>(null)

  /** 本次生成基于的 schema：优先「继续基准」，否则当前画布 */
  const baseSchemaFor = (mode: 'current' | 'new'): AIDesignSchema | undefined => {
    if (mode === 'current') {
      if (continueFrom) return continueFrom.schema
      return currentCanvasSchema(route)
    }
    return undefined
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
        baseSchema: baseSchemaFor(mode),
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
        // 自动记录版本：基于历史继续 = iterate；重新生成 = regenerate；首次 = initial
        const source: GenVersion['source'] =
          mode === 'current' ? 'iterate' : latest ? 'regenerate' : 'initial'
        const parentId = continueFrom?.id ?? (mode === 'current' ? latest?.id : undefined)
        addVersion(
          {
            prompt: p,
            schema: final,
            intent: intent ?? undefined,
            review: review ?? undefined,
            thought: thought || undefined,
          },
          parentId,
          source,
        )
        message.success('编排完成，已记录版本，确认后应用到大屏')
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

  /** 回退应用某个历史版本到画布（可撤销） */
  const applyVersion = (v: GenVersion) => {
    const st = useDesignerStore.getState()
    const current = st.routes.find((r) => r.id === st.selectedRouteId)
    if (!current) return
    setSnapshot({ components: current.components, page: { ...current.page } })
    applyAISchema(v.schema)
    message.success(`已回退应用到 v${v.version}，可撤销`)
  }

  /** 从此版本继续修改：设基准 + 预填提示 */
  const continueFromVersion = (v: GenVersion) => {
    setContinueFrom(v)
    setActiveId(v.id)
    setPrompt(`继续调整此版本：`)
    message.info(`已以 v${v.version} 为基准，输入修改指令后「基于当前画布编排」`)
  }

  const cancelContinue = () => {
    setContinueFrom(null)
    setPrompt('')
  }

  return (
    <div
      style={{
        position: embedded ? 'static' : 'fixed',
        top: embedded ? undefined : 60,
        right: embedded ? undefined : 16,
        bottom: embedded ? undefined : 16,
        width: embedded ? '100%' : 380,
        zIndex: embedded ? undefined : 1200,
        display: 'flex',
        flexDirection: 'column',
        gap: 10,
        padding: embedded ? 4 : 12,
        background: embedded ? 'transparent' : '#ffffff',
        border: embedded ? 'none' : '1px solid #e5e5ea',
        borderRadius: embedded ? 0 : 8,
        color: '#1d1d1f',
        boxShadow: embedded ? 'none' : '0 8px 30px rgba(0,0,0,0.45)',
        overflow: embedded ? 'visible' : 'auto',
        height: embedded ? '100%' : undefined,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <b style={{ fontSize: 14 }}>
          <RobotOutlined style={{ marginRight: 6, color: '#0071e3' }} />
          AI 编排大屏
        </b>
        <Tooltip title="关闭">
          <Button size="small" type="text" icon={<CloseOutlined />} onClick={() => onClose?.()} />
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
        {continueFrom && (
          <Button size="small" onClick={cancelContinue}>
            取消继续（v{continueFrom.version}）
          </Button>
        )}
      </Space>

      {error && <div style={{ color: '#ff3b30', fontSize: 12 }}>⚠️ {error}</div>}

      {loading && (
        <div style={{ fontSize: 12, color: '#86868b', maxHeight: 90, overflow: 'auto', whiteSpace: 'pre-wrap' }}>
          {thought || 'AI 正在编排当前大屏…'}
        </div>
      )}

      {intent && !loading && (
        <div style={{ fontSize: 12, color: '#86868b' }}>
          <b style={{ color: '#0071e3' }}>设计意图：</b>
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
        <div style={{ fontSize: 12, color: '#86868b' }}>
          <b style={{ color: '#ff9500' }}>结构校验：</b>
          {review.issues?.length ? review.issues.join('；') : '通过'}
        </div>
      )}

      {schema && !loading && (
        <div
          style={{
            padding: '8px 10px',
            background: 'rgba(0, 113, 227,0.08)',
            border: '1px solid rgba(0, 113, 227,0.25)',
            borderRadius: 6,
            fontSize: 12,
          }}
        >
          编排完成：共 {schema.components.length} 个组件
          {schema.page ? ` · 画布 ${schema.page.width}×${schema.page.height}` : ''}
        </div>
      )}

      {/* 生成历史版本面板（AIPanel 与单组件调整共享同一份版本记录） */}
      <GenHistoryPanel
        versions={versions}
        activeId={activeId}
        onSelect={setActiveId}
        onContinueFrom={continueFromVersion}
        onRename={renameVersion}
        onDelete={deleteVersion}
        onClearAll={clearAll}
        onApplyVersion={applyVersion}
      />

      <div className="ai-panel-footer" style={{ display: 'flex', gap: 8 }}>
        <Button size="small" onClick={() => onClose?.()} style={{ flex: 1 }}>
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
