// ============================================================
// 组件库页「AI 调整」弹窗：基于已登记组件内容迭代生成新源码/option，
// 确认后更新组件资产并自动发布小版本（保存即记版）。
// ============================================================
import { useRef, useState } from 'react'
import { App, Button, Input, Modal, Space, Tag } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { api } from '../mock/api'
import { useDesignerStore } from '../data/store/useDesignerStore'
import type { WidgetDefDTO } from '../mock/types'
import { componentIterationPrompt } from '../data/ai/componentIterate'
import {
  buildEchartsPreviewSrcDoc,
  buildHtmlPreviewSrcDoc,
  buildReactPreviewSrcDoc,
  extractEchartsOption,
  extractOptionFromFrame,
} from './ai/aiComponentPreview'

interface Props {
  widget: WidgetDefDTO
  open: boolean
  onClose: () => void
  onSaved: () => void
}

/** 语义化版本号递增（1.0.0 → 1.0.1；非法值兜底 0.0.1） */
function bumpVersion(version?: string): string {
  const parts = String(version || '0.0.0')
    .split('.')
    .map((p) => parseInt(p, 10) || 0)
  while (parts.length < 3) parts.push(0)
  parts[2] += 1
  return parts.join('.')
}

export default function ComponentLibraryAIAdjustModal({ widget, open, onClose, onSaved }: Props) {
  const { message } = App.useApp()
  const previewFrameRef = useRef<HTMLIFrameElement>(null)
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')

  const isEcharts = !!(widget.kind === 'echarts' || widget.category === 'ECharts' || widget.optionJson)
  const isReact = !isEcharts && (widget.renderer === 'reactComponent' || widget.schema?.type === 'reactComponent')
  const lang = isEcharts ? ('js' as const) : isReact ? ('ts' as const) : ('html' as const)

  const reset = () => {
    setPrompt('')
    setCode('')
    setError('')
    setLoading(false)
  }

  const close = () => {
    if (loading) return
    reset()
    onClose()
  }

  const run = async () => {
    const p = prompt.trim()
    if (!p) {
      message.warning('请输入调整指令')
      return
    }
    setLoading(true)
    setError('')
    setCode('')
    let acc = ''
    try {
      const r = await api.aiGenerate(componentIterationPrompt(widget, p), lang, {
        onDelta: (t) => {
          acc += t
          setCode(acc)
        },
        onFallback: (info) =>
          message.info(
            `模型 ${info.from || ''} 调用失败，已自动切换到 ${info.to || ''}`,
          ),
        onError: (m) => setError(m),
      })
      if (r.code === 0 && r.data.code) setCode(r.data.code)
      if (!r.data.code && !acc && !error) setError('AI 未返回有效的代码')
    } catch {
      setError('调整请求失败')
    } finally {
      setLoading(false)
    }
  }

  const save = async () => {
    const finalCode = code.trim()
    if (!finalCode) {
      message.warning('暂无调整结果')
      return
    }
    const targetType = widget.type
    const patch: Partial<WidgetDefDTO> = { type: targetType }
    if (isEcharts) {
      const raw = extractEchartsOption(finalCode) || extractOptionFromFrame(previewFrameRef.current)
      if (!raw) {
        message.error('未识别到 ECharts option，无法更新组件')
        return
      }
      const optionJson = JSON.stringify(JSON.parse(raw), null, 2)
      patch.optionJson = optionJson
      patch.schema = { type: 'echartCustom', optionJson }
    } else {
      const rendererType = isReact ? 'reactComponent' : 'htmlComponent'
      patch.renderer = rendererType
      patch.sourceCode = finalCode
      patch.sandboxMode = 'sandbox'
      patch.schema = { type: rendererType, sourceCode: finalCode, sandboxMode: 'sandbox' }
    }
    const r = await api.saveWidget(patch)
    if (r.code !== 0) {
      message.error(r.message)
      return
    }
    const nextVersion = bumpVersion(widget.version)
    const vr = await api.publishWidgetVersion(targetType, {
      version: nextVersion,
      changelog: `AI 调整更新：${prompt.trim() || '修改组件内容'}`,
    })
    if (vr.code !== 0) {
      message.warning(`内容已更新，但版本记录失败：${vr.message}`)
    } else {
      message.success(`已更新组件（${targetType} → v${nextVersion}）`)
    }
    useDesignerStore.getState().loadCatalog()
    reset()
    onSaved()
    onClose()
  }

  const previewSrcDoc = (): string => {
    if (!code) return ''
    if (isEcharts) return buildEchartsPreviewSrcDoc(code)
    if (isReact) return buildReactPreviewSrcDoc(code)
    return buildHtmlPreviewSrcDoc(code)
  }

  return (
    <Modal
      title={
        <span>
          <RobotOutlined style={{ marginRight: 6, color: '#0071e3' }} />
          AI 调整组件
        </span>
      }
      open={open}
      onCancel={close}
      footer={null}
      width={560}
      maskClosable={!loading}
      destroyOnClose
    >
      <div style={{ marginBottom: 12 }}>
        <Space wrap>
          <Tag color="blue">{widget.name}</Tag>
          <Tag>{widget.type}</Tag>
          <Tag>{isEcharts ? 'ECharts' : isReact ? 'React' : 'HTML'}</Tag>
        </Space>
      </div>

      <Input.TextArea
        rows={3}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="例如：把柱状图颜色改成渐变色，标题加粗"
        disabled={loading}
      />

      <div style={{ marginTop: 10, display: 'flex', gap: 8 }}>
        <Button size="small" loading={loading} onClick={run} type="primary" icon={<RobotOutlined />}>
          生成调整方案
        </Button>
      </div>

      {error && (
        <div style={{ marginTop: 10, color: '#ff3b30', fontSize: 12 }}>⚠️ {error}</div>
      )}

      {loading && (
        <div
          style={{
            marginTop: 10,
            fontSize: 12,
            color: '#86868b',
            maxHeight: 120,
            overflow: 'auto',
            whiteSpace: 'pre-wrap',
            background: 'rgba(0,113,227,0.05)',
            borderRadius: 8,
            padding: '8px 10px',
          }}
        >
          AI 正在调整该组件…
        </div>
      )}

      {code && !loading && (
        <>
          <div
            style={{
              marginTop: 10,
              height: 200,
              border: '1px solid #e5e5ea',
              borderRadius: 8,
              background: '#f5f5f7',
              overflow: 'hidden',
            }}
          >
            <iframe
              ref={previewFrameRef}
              title="AI 调整组件预览"
              srcDoc={previewSrcDoc()}
              sandbox="allow-scripts allow-same-origin"
              style={{ width: '100%', height: '100%', border: 0, background: 'transparent' }}
            />
          </div>
          <div style={{ marginTop: 8, fontSize: 12, color: '#86868b' }}>
            {code.length} 字符 · 确认后保存为组件新版本，所有已投放该组件的大屏将同步更新
          </div>
        </>
      )}

      <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
        <Button size="small" onClick={close} disabled={loading}>
          取消
        </Button>
        <Button size="small" type="primary" disabled={!code || loading} onClick={save}>
          保存为组件新版本
        </Button>
      </div>
    </Modal>
  )
}
