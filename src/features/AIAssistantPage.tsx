import { useCallback, useEffect, useRef, useState } from 'react'
import { App, Button, Collapse, Empty, Input, Modal, Select, Space, Spin, Tag } from 'antd'
import { RobotOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import ReactECharts from 'echarts-for-react'
import { api } from '../mock/api'
import type { AIBotDTO, AISessionItem, CodeLang, WidgetDefDTO } from '../mock/types'
import { extractEchartsOption } from './aiEcharts'
import { useDesignerStore } from '../data/store/useDesignerStore'
import { componentIterationPrompt } from '../data/ai/componentIterate'
import { buildHtmlPreviewDocument } from '../designer/widgets/HtmlComponentWidget'
import { isArray, isFunction, isObject } from '../data/utils/typeGuards'

const CARD = {
  background: '#ffffff',
  border: '1px solid #e5e5ea',
  borderRadius: 10,
  padding: 14,
}

type GenType = 'html' | 'react' | 'echarts'

/** 从 AI 生成的代码里提取 ECharts option JSON（支持 HTML/JS/围栏代码块） */
function extractEChartsOption(code: string): string | null {
  const clean = code
    .trim()
    .replace(/^```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
  const script = clean.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
  const js = (script ? script[1] : clean).trim()

  const tryObject = (raw: string): string | null => {
    try {
      const value = new Function(`"use strict"; return (${raw})`)()
      if (isObject(value)) {
        return JSON.stringify(value)
      }
    } catch {
      /* try next candidate */
    }
    return null
  }

  const extractBalanced = (source: string, re: RegExp): string | null => {
    const match = re.exec(source)
    if (!match) return null
    const start = source.indexOf('{', match.index + match[0].length)
    if (start === -1) return null
    let depth = 0
    let inStr = false
    let quote = ''
    for (let i = start; i < source.length; i++) {
      const ch = source[i]
      if (inStr) {
        if (ch === quote && source[i - 1] !== '\\') inStr = false
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inStr = true
        quote = ch
        continue
      }
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) return source.slice(start, i + 1)
      }
    }
    return null
  }

  // 整段就是 option 对象
  if (/^\s*\{[\s\S]*\}\s*$/.test(js)) {
    const whole = tryObject(js)
    if (whole) return whole
  }

  // option = {...} 或 chart.setOption({...})
  for (const re of [/option\s*=\s*/, /setOption\s*\(\s*/]) {
    const raw = extractBalanced(js, re)
    if (raw) {
      const out = tryObject(raw)
      if (out) return out
    }
  }

  // option = JSON.parse('...')
  const jsonParse = js.match(/option\s*=\s*JSON\.parse\(\s*(['"])([\s\S]*?)\1\s*\)/)
  if (jsonParse) {
    try {
      const value = JSON.parse(jsonParse[2])
      if (isObject(value)) {
        return JSON.stringify(value)
      }
    } catch {
      /* ignore */
    }
  }
  return null
}

/** 预览 iframe 已渲染出 ECharts 时，直接从 chart 实例取完整 option */
function extractOptionFromFrame(frame: HTMLIFrameElement | null): string | null {
  try {
    const win = frame?.contentWindow
    if (!win) return null
    const anyWin = win as unknown as Record<string, unknown>
    const echarts = anyWin.echarts as
      | { getInstanceByDom?: (el: HTMLElement | null) => { getOption?: () => unknown } | undefined }
      | undefined
    const el = win.document.getElementById('chart')
    const inst =
      isFunction(echarts?.getInstanceByDom) ? echarts.getInstanceByDom(el) : undefined
    const option =
      anyWin.option ??
      inst?.getOption?.() ??
      (anyWin.chart as { getOption?: () => unknown } | undefined)?.getOption?.()
    if (isObject(option)) {
      return JSON.stringify(option)
    }
  } catch {
    /* ignore */
  }
  return null
}

const GEN_OPTIONS: { value: GenType; label: string; hint: string }[] = [
  { value: 'html', label: 'HTML', hint: '独立 HTML 页面/组件' },
  { value: 'react', label: 'React', hint: 'TSX 组件文件' },
  { value: 'echarts', label: 'ECharts', hint: 'ECharts 图表组件（带预览）' },
]

/** 语义化版本号递增（1.0.0 → 1.0.1；非法值兜底 0.0.1） */
function bumpVersion(version?: string): string {
  const parts = String(version || '0.0.0')
    .split('.')
    .map((p) => parseInt(p, 10) || 0)
  while (parts.length < 3) parts.push(0)
  parts[2] += 1
  return parts.join('.')
}

/** 我的机器人列表（复用 /api/aiBots） */
function BotList() {
  const [bots, setBots] = useState<AIBotDTO[]>([])
  const [loading, setLoading] = useState(false)
  const load = () => {
    setLoading(true)
    api
      .listAIBots({ pageSize: 50 })
      .then((r) => setBots(r.code === 0 ? r.data.list : []))
      .finally(() => setLoading(false))
  }
  useEffect(load, [])
  if (loading) return <Spin />
  if (!bots.length)
    return <Empty description="还没有机器人，去「系统 / AI 机器人」创建一个吧" />
  return (
    <Collapse
      items={bots.map((b) => ({
        key: b.id,
        label: `${b.name}${b.status === 'ready' ? ' · 已就绪' : ' · 待配置'}`,
        children: (
          <div style={{ fontSize: 13, color: '#86868b', lineHeight: 1.8 }}>
            <div>类型：{b.type}</div>
            <div>描述：{b.description || '—'}</div>
            <div>绑定模型：{b.modelId || '—'}</div>
            <div>
              提示词：{b.systemPrompt ? b.systemPrompt.slice(0, 120) + '…' : '—'}
            </div>
          </div>
        ),
      }))}
    />
  )
}

/**
 * 独立 AI 助手页：组件生成 / 智能问答 / 我的机器人。
 * 大屏编排已移入大屏编辑器（设计器内的 AI 编排面板），
 * 本页专注生成可复用的组件代码，并支持保存到代码仓库/组件中心。
 */
export default function AIAssistantPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState<'component' | 'chat' | 'bot'>(
    'component',
  )

  // ---- 会话管理 ----
  const [sessions, setSessions] = useState<AISessionItem[]>([])
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [renameTarget, setRenameTarget] = useState<AISessionItem | null>(null)
  const [renameTitle, setRenameTitle] = useState('')

  const loadSessions = useCallback(() => {
    api
      .listAISessions({ pageSize: 50 })
      .then((r) => r.code === 0 && setSessions(r.data.list.filter((s) => s.botId !== 'ai-design')))
      .catch(() => {})
  }, [])
  useEffect(loadSessions, [loadSessions])
  useEffect(() => {
    loadRegisteredWidgets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const newSession = async () => {
    const r = await api.createAISession({ title: '新会话' })
    if (r.code === 0) {
      setSessions((prev) => [r.data, ...prev])
      setActiveSessionId(r.data.id)
      setChat([])
      setChatInput('')
    } else {
      message.error(r.message)
    }
  }

  const selectSession = async (id: string) => {
    setActiveSessionId(id)
    const r = await api.getAISessionMessages(id)
    setChat(
      r.code === 0
        ? r.data.map((m) => ({
            role: m.role === 'user' ? 'user' : 'ai',
            content: m.content,
          }))
        : [],
    )
  }

  const confirmRename = async () => {
    if (!renameTarget) return
    const r = await api.renameAISession(renameTarget.id, renameTitle)
    if (r.code === 0) {
      setSessions((prev) =>
        prev.map((s) =>
          s.id === renameTarget.id
            ? { ...s, title: renameTitle.trim() || s.title }
            : s,
        ),
      )
      message.success('已重命名')
    } else {
      message.error(r.message)
    }
    setRenameTarget(null)
  }

  const removeSession = async (id: string) => {
    const r = await api.deleteAISession(id)
    if (r.code === 0) {
      setSessions((prev) => prev.filter((s) => s.id !== id))
      if (activeSessionId === id) {
        setActiveSessionId(null)
        setChat([])
      }
      message.success('已删除会话')
    } else {
      message.error(r.message)
    }
  }

  // ---- 组件生成 ----
  const [compPrompt, setCompPrompt] = useState('')
  const [compType, setCompType] = useState<GenType>('html')
  const [compName, setCompName] = useState('')
  const [compCode, setCompCode] = useState('')
  const [compOptionJson, setCompOptionJson] = useState('')
  const [compLoading, setCompLoading] = useState(false)
  const [compError, setCompError] = useState('')
  // 已登记组件列表（用于「更新已登记组件」覆盖已有 type）
  const [registeredWidgets, setRegisteredWidgets] = useState<WidgetDefDTO[]>([])
  const [updateTarget, setUpdateTarget] = useState<string>('')
  const [updating, setUpdating] = useState(false)
  const [adjustOpen, setAdjustOpen] = useState(false)
  const [adjustPrompt, setAdjustPrompt] = useState('')
  const [adjustLoading, setAdjustLoading] = useState(false)
  const [adjustError, setAdjustError] = useState('')
  const compAccRef = useRef('')
  const previewFrameRef = useRef<HTMLIFrameElement>(null)

  const handleGenerate = async () => {
    const p = compPrompt.trim()
    if (!p) {
      message.warning('请输入组件描述')
      return
    }
    setCompLoading(true)
    setCompError('')
    setCompCode('')
    setCompOptionJson('')
    compAccRef.current = ''
    try {
      const requestPrompt = compType === 'html'
        ? `${p}

数据契约要求：
1. 生成独立视觉组件；不要读取或依赖 window.__DASHBOARD__、dashboard:update、renderTable 或 pick。
2. 不要输出 <table data-dashboard-table></table> 这类数据网格骨架。
3. 不绑定数据集，不要调用 API、SQL 或携带 Token。
4. 视觉示例使用中性占位内容，不要生成真实业务数据表。`
        : `${p}

组件契约要求：
1. 生成独立视觉组件；不要读取或依赖数据集、dashboard:update、renderTable、pick、SQL 或 Token。
2. 不要绑定 dataSource，也不要请求任何业务接口。
3. 视觉示例使用中性占位内容，不要生成真实业务数据表。`
      const r = await api.aiGenerate(requestPrompt, compType, {
        onDelta: (t) => {
          compAccRef.current += t
          setCompCode(compAccRef.current)
        },
        onFallback: (info) =>
          message.info(
            `模型 ${info.from || ''} 调用失败，已自动切换到 ${info.to || ''}`,
          ),
        onError: (m) => setCompError(m),
      })
      if (r.code === 0 && r.data.code) setCompCode(r.data.code)
      const finalCode = r.data.code || compAccRef.current
      if (finalCode && compType === 'echarts') {
        const option = extractEchartsOption(finalCode)
        setCompOptionJson(option ? JSON.stringify(option, null, 2) : '')
      }
      else if (!compError) message.warning('AI 未返回有效代码')
    } catch {
      setCompError('生成失败')
    } finally {
      setCompLoading(false)
    }
  }

  const copyCode = async () => {
    if (!compCode) return
    try {
      await navigator.clipboard.writeText(compCode)
      message.success('代码已复制')
    } catch {
      message.error('复制失败')
    }
  }

  const snippetName = () =>
    compName.trim() || compPrompt.trim().slice(0, 30) || 'AI 生成组件'

  const previewSrcDoc = (): string => {
    if (!compCode) return ''
    const cleanCode = compCode
      .trim()
      .replace(/^```[a-zA-Z]*\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
    const safeInline = (code: string) => code.replace(/<\/script/gi, '<\\/script')
    const csp =
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' https:; style-src \'unsafe-inline\'; img-src data: https:; font-src data: https:; connect-src https: data:">'
    if (compType === 'html') {
      return buildHtmlPreviewDocument(cleanCode)
    }
    if (compType === 'echarts') {
      if (/^\s*</.test(cleanCode)) {
        if (/^\s*<(?:!doctype|html)/i.test(cleanCode)) return cleanCode
        return `<!doctype html><html><head><meta charset="utf-8">${csp}<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script></head><body>${cleanCode}</body></html>`
      }
      // 纯 JSON option：先解析成变量再渲染（裸对象直接插进 try 块会触发语法错误）
      let exec = safeInline(cleanCode)
      const trimmed = cleanCode.trim()
      if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
        try {
          const parsed = JSON.parse(trimmed)
          exec = `var option = ${JSON.stringify(parsed)};`
        } catch {
          /* 非严格 JSON（含函数/变量），按原样执行 */
        }
      }
      return `<!doctype html><html><head><meta charset="utf-8">${csp}<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script></head><body style="margin:0;background:#ffffff"><div id="chart" style="width:100vw;height:100vh"></div><script>\ntry {\n${exec}\nif (typeof echarts === 'undefined') throw new Error('ECharts CDN 未加载');\nif (!document.querySelector('#chart canvas')) {\nvar __chart = echarts.init(document.getElementById('chart'));\n__chart.setOption((typeof option !== 'undefined' ? option : window.option) || {});\n}\n} catch (e) { document.body.innerHTML = '<pre style="color:#ff3b30;padding:12px">' + (e && e.message ? e.message : String(e)) + '</pre>' }\n<\/script></body></html>`
    }
    return ''
  }

  /** React 产物在 AI 助手页的安全预览：只读快照，不支持执行任意 JSX/import */
  const reactPreviewSrcDoc = (): string => {
    if (!compCode) return ''
    const cleanCode = compCode
      .trim()
      .replace(/^```[a-zA-Z]*\s*\n?/, '')
      .replace(/\n?```\s*$/, '')
    const safe = cleanCode
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/&lt;\/script/gi, '&lt;\\/script')
    return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{height:100%;margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}pre{height:100%;box-sizing:border-box;margin:0;padding:16px;overflow:auto;font-size:12px;line-height:1.7;color:#1d1d1f;white-space:pre-wrap;word-break:break-all}</style></head><body><pre>${safe}</pre></body></html>`
  }

  const downloadFile = () => {
    if (!compCode) return
    const ext = compType === 'html' ? 'html' : compType === 'react' ? 'tsx' : 'ts'
    const blob = new Blob([compCode], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${snippetName().replace(/\s+/g, '_')}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  const saveSnippet = async () => {
    if (!compCode) {
      message.warning('请先生成组件代码')
      return
    }
    const r = await api.saveSnippet({
      id: '',
      name: snippetName(),
      lang: (compType === 'react' ? 'ts' : compType === 'echarts' ? 'js' : 'html') as CodeLang,
      tags: ['AI生成'],
      code: compCode,
      updatedAt: new Date().toISOString(),
    })
    if (r.code === 0) message.success('已保存到代码仓库')
    else message.error(r.message)
  }

  const registerWidget = async () => {
    if (!compCode) {
      message.warning('请先生成组件代码')
      return
    }
    const suffix = Date.now().toString(36)
    const type =
      compType === 'echarts'
        ? `ai_echarts_${suffix}`
        : compType === 'html'
        ? `ai_html_${suffix}`
        : `ai_react_${suffix}`
    const base = {
      type,
      name: snippetName(),
      version: '1.0.0',
      desc: compPrompt.trim() || (compType === 'echarts' ? 'AI 生成的 ECharts 组件' : 'AI 生成组件'),
    }
    let r: Awaited<ReturnType<typeof api.saveWidget>>
    if (compType === 'echarts') {
      const raw = extractEChartsOption(compCode) || extractOptionFromFrame(previewFrameRef.current)
      if (!raw) {
        message.error('未识别到 ECharts option，无法生成组件 Schema')
        return
      }
      const optionJson = JSON.stringify(JSON.parse(raw), null, 2)
      r = await api.saveWidget({
        ...base,
        kind: 'echarts',
        icon: 'BarChartOutlined',
        category: 'ECharts',
        optionJson,
        dataSchema: { generated: true },
        schema: { type: 'echartCustom', optionJson },
      })
    } else {
      const rendererType = compType === 'html' ? 'htmlComponent' : 'reactComponent'
      const defaultStyle = { x: 80, y: 80, w: 420, h: 280 }
      const defaultProps = {
        title: snippetName(),
        sourceCode: compCode,
        sandboxMode: 'sandbox',
        interactive: false,
      }
      const componentMeta = {
        type,
        name: snippetName(),
        description: compPrompt.trim() || (compType === 'html' ? 'AI 生成的 HTML 组件' : 'AI 生成的 React 组件'),
        category: 'AI 生成',
        icon: compType === 'html' ? 'HTML' : 'React',
        renderer: rendererType,
        defaultStyle,
        props: {
          title: { type: 'string' as const, default: snippetName(), label: '标题', ui: 'text' as const, group: 'data' as const },
          sourceCode: { type: 'string' as const, default: compCode, label: compType === 'html' ? 'HTML 源码' : 'TSX 源码', ui: 'textarea' as const, group: 'data' as const },
          sandboxMode: { type: 'string' as const, default: 'sandbox', label: '运行模式', ui: 'select' as const, options: [{ value: 'sandbox', label: '沙箱（隔离）' }, { value: 'trusted', label: '信任（直接渲染）' }], group: 'data' as const },
          interactive: { type: 'boolean' as const, default: false, label: '点击联动', ui: 'boolean' as const, group: 'event' as const },
          liveSourceId: { type: 'string' as const, label: '实时数据源', ui: 'select' as const, dynamicOptions: 'liveSources', group: 'data' as const },
          liveIntervalMs: { type: 'number' as const, default: 2000, label: '刷新间隔 (ms)', ui: 'number' as const, min: 300, step: 100, group: 'data' as const },
        },
        styleSchema: [{ key: 'title', label: '标题', type: 'string' as const, ui: 'text' as const }],
        bindingSchema: [
          { key: 'sourceCode', label: compType === 'html' ? 'HTML 源码' : 'TSX 源码', type: 'string' as const, ui: 'textarea' as const },
          { key: 'sandboxMode', label: '运行模式', type: 'string' as const, ui: 'select' as const, options: [{ value: 'sandbox', label: '沙箱（隔离）' }, { value: 'trusted', label: '信任（直接渲染）' }] },
          { key: 'liveSourceId', label: '实时数据源', type: 'string' as const, ui: 'select' as const, dynamicOptions: 'liveSources' },
          { key: 'liveIntervalMs', label: '刷新间隔 (ms)', type: 'number' as const, ui: 'number' as const, min: 300, step: 100 },
        ],
        eventSchema: [
          { key: 'interactive', label: '点击联动', type: 'boolean' as const, ui: 'boolean' as const },
        ],
        schemaVersion: 3,
        scope: 'custom' as const,
        enabled: true,
        version: '1.0.0',
        status: 'published' as const,
        manifest: {
          runtime: rendererType === 'htmlComponent' ? 'sandbox-iframe' : 'safe-tsx-subset',
          bridge: rendererType === 'htmlComponent' ? 'postMessage' : 'props',
          sourceCode: compCode,
          dataContract: [],
        },
      }
      await api.saveComponent(componentMeta)
      await api.publishComponent(type, { version: '1.0.0', description: compPrompt.trim() })
      r = await api.saveWidget({
        ...base,
        kind: rendererType,
        icon: 'CodeOutlined',
        category: 'AI 生成',
        renderer: rendererType,
        sourceCode: compCode,
        sandboxMode: 'sandbox',
        dataSchema: { generated: true, standaloneVisual: true, datasetBinding: false },
        schema: {
          type: rendererType,
          sourceCode: compCode,
          sandboxMode: 'sandbox',
          defaultProps,
        },
      })
    }
    if (r.code === 0) {
      message.success(`已登记到组件中心（${type}）`)
      // 登记后立即刷新组件目录，编辑器左侧可拖拽到画布
      useDesignerStore.getState().loadCatalog()
      loadRegisteredWidgets()
    } else {
      message.error(r.message)
    }
  }

  /** 加载已登记组件（用于「更新已登记组件」下拉） */
  const loadRegisteredWidgets = async () => {
    const r = await api.listWidgets({ pageSize: 50 })
    if (r.code === 0 && isArray(r.data?.list)) {
      setRegisteredWidgets(r.data.list)
      setUpdateTarget((cur) =>
        r.data.list.some((w) => w.type === cur) ? cur : '',
      )
    }
  }

  /** 更新已登记组件：覆盖内容（saveWidget PATCH）+ 自动发布新版本 */
  const updateRegisteredWidget = async () => {
    if (!compCode) {
      message.warning('请先生成组件代码')
      return
    }
    if (!updateTarget) {
      message.warning('请选择要更新的已登记组件')
      return
    }
    const target = registeredWidgets.find((w) => w.type === updateTarget)
    if (!target) return
    setUpdating(true)
    try {
      const patch: Partial<WidgetDefDTO> = {
        type: updateTarget,
        name: snippetName(),
        desc: compPrompt.trim() || target.desc,
      }
      if (compType === 'echarts') {
        const raw = extractEChartsOption(compCode) || extractOptionFromFrame(previewFrameRef.current)
        if (!raw) {
          message.error('未识别到 ECharts option，无法更新组件 Schema')
          return
        }
        const optionJson = JSON.stringify(JSON.parse(raw), null, 2)
        patch.kind = 'echarts'
        patch.optionJson = optionJson
        patch.schema = { type: 'echartCustom', optionJson }
      } else {
        const rendererType = compType === 'html' ? 'htmlComponent' : 'reactComponent'
        patch.renderer = rendererType
        patch.sourceCode = compCode
        patch.sandboxMode = 'sandbox'
        patch.schema = { type: rendererType, sourceCode: compCode, sandboxMode: 'sandbox' }
      }
      const r = await api.saveWidget(patch)
      if (r.code !== 0) {
        message.error(r.message)
        return
      }
      // 保存即记版：发布小版本到组件中心版本列表
      const nextVersion = bumpVersion(target.version)
      const vr = await api.publishWidgetVersion(updateTarget, {
        version: nextVersion,
        changelog: `AI 助手编辑更新：${compPrompt.trim() || '修改组件内容'}`,
      })
      if (vr.code !== 0) {
        message.warning(`内容已更新，但版本记录失败：${vr.message}`)
      } else {
        message.success(`已更新组件（${updateTarget} → v${nextVersion}）`)
      }
      useDesignerStore.getState().loadCatalog()
      loadRegisteredWidgets()
    } finally {
      setUpdating(false)
    }
  }

  /** AI 调整选中组件：基于现有内容迭代生成代码，填入主生成区，由「更新已登记组件」保存并记版 */
  const adjustSelectedWidget = async () => {
    const target = registeredWidgets.find((w) => w.type === updateTarget)
    if (!target) {
      message.warning('请先选择要调整的已登记组件')
      return
    }
    const p = adjustPrompt.trim()
    if (!p) {
      message.warning('请输入调整指令')
      return
    }
    setAdjustLoading(true)
    setAdjustError('')
    const isEcharts = !!(target.kind === 'echarts' || target.category === 'ECharts' || target.optionJson)
    const isReact = !isEcharts && (target.renderer === 'reactComponent' || target.schema?.type === 'reactComponent')
    const lang: GenType = isEcharts ? 'echarts' : isReact ? 'react' : 'html'
    let acc = ''
    try {
      const r = await api.aiGenerate(componentIterationPrompt(target, p), lang, {
        onDelta: (t) => {
          acc += t
        },
        onFallback: (info) =>
          message.info(
            `模型 ${info.from || ''} 调用失败，已自动切换到 ${info.to || ''}`,
          ),
        onError: (m) => setAdjustError(m),
      })
      if (r.code === 0 && r.data.code) acc = r.data.code
      if (!acc && !adjustError) setAdjustError('AI 未返回有效的代码')
      else if (acc) {
        // 填充到主生成区，复用已有预览/保存链路
        setCompType(lang)
        setCompCode(acc)
        setCompName(target.name)
        setCompOptionJson('')
        setUpdateTarget(target.type)
        setAdjustOpen(false)
        setAdjustPrompt('')
        message.success('调整方案已生成，请预览后点击「更新已登记组件」保存')
      }
    } catch {
      setAdjustError('调整请求失败')
    } finally {
      setAdjustLoading(false)
    }
  }

  // ---- 智能问答 ----
  const [chatInput, setChatInput] = useState('')
  const [chat, setChat] = useState<{ role: 'user' | 'ai'; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  const handleChat = () => {
    if (!chatInput.trim() || chatLoading) return
    const userMsg = chatInput.trim()
    setChat((c) => [...c, { role: 'user', content: userMsg }])
    setChatInput('')
    setChatLoading(true)
    let acc = ''
    setChat((c) => [...c, { role: 'ai', content: '' }])
    const ctrl = new AbortController()
    abortRef.current = ctrl
    api
      .aiChat(userMsg, {
        sessionId: activeSessionId ?? undefined,
        signal: ctrl.signal,
        onDelta: (t) => {
          acc += t
          setChat((c) => {
            const next = [...c]
            next[next.length - 1] = { role: 'ai', content: acc }
            return next
          })
        },
        onFallback: (info) =>
          message.info(
            `模型 ${info.from || ''} 调用失败，已自动切换到 ${info.to || ''}`,
          ),
        onError: (m) => {
          setChat((c) => {
            const next = [...c]
            next[next.length - 1] = { role: 'ai', content: '⚠️ ' + m }
            return next
          })
        },
      })
      .then((r) => {
        if (r.code === 0 && r.data.sessionId) {
          setActiveSessionId((prev) => prev || (r.data.sessionId as string))
        }
      })
      .finally(() => {
        setChatLoading(false)
        loadSessions()
      })
  }

  return (
    <div style={{ padding: 24, color: '#1d1d1f', height: '100%', overflow: 'auto' }}>
      <h2 style={{ marginTop: 0 }}>AI 助手</h2>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <div style={{ width: 240, ...CARD, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Button type="primary" size="small" onClick={newSession}>
            ＋ 新建会话
          </Button>
          <div
            style={{
              overflow: 'auto',
              maxHeight: 520,
              display: 'flex',
              flexDirection: 'column',
              gap: 6,
            }}
          >
            {sessions.map((s) => (
              <div
                key={s.id}
                onClick={() => selectSession(s.id)}
                style={{
                  padding: '6px 8px',
                  borderRadius: 6,
                  cursor: 'pointer',
                  background:
                    activeSessionId === s.id
                      ? 'rgba(0, 113, 227,.12)'
                      : 'rgba(255,255,255,.03)',
                  border:
                    '1px solid ' +
                    (activeSessionId === s.id
                      ? 'rgba(0, 113, 227,.3)'
                      : 'transparent'),
                }}
              >
                <div
                  style={{
                    fontSize: 12,
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                  }}
                >
                  {s.title || '未命名会话'}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', marginTop: 4 }}>
                  <span style={{ fontSize: 11, color: '#86868b' }}>
                    {s.messageCount} 条
                  </span>
                  <Space size={0} style={{ marginLeft: 'auto' }}>
                    <Button
                      type="text"
                      size="small"
                      onClick={(e) => {
                        e.stopPropagation()
                        setRenameTarget(s)
                        setRenameTitle(s.title || '')
                      }}
                    >
                      重命名
                    </Button>
                    <Button
                      type="text"
                      size="small"
                      danger
                      onClick={(e) => {
                        e.stopPropagation()
                        removeSession(s.id)
                      }}
                    >
                      删除
                    </Button>
                  </Space>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 460, ...CARD }}>
          <Space style={{ marginBottom: 16 }}>
            <Button
              type={activeTab === 'component' ? 'primary' : 'default'}
              onClick={() => setActiveTab('component')}
            >
              组件生成
            </Button>
            <Button
              type={activeTab === 'chat' ? 'primary' : 'default'}
              onClick={() => setActiveTab('chat')}
            >
              智能问答
            </Button>
            <Button
              type={activeTab === 'bot' ? 'primary' : 'default'}
              onClick={() => setActiveTab('bot')}
            >
              我的机器人
            </Button>
          </Space>

          {activeTab === 'component' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input.TextArea
                rows={3}
                placeholder="描述你想生成的组件，例如：一个带图例和提示框的柱状图，或一个倒计时卡片"
                value={compPrompt}
                onChange={(e) => setCompPrompt(e.target.value)}
              />
              <Space wrap>
                {GEN_OPTIONS.map((g) => (
                  <Button
                    key={g.value}
                    type={compType === g.value ? 'primary' : 'default'}
                    onClick={() => setCompType(g.value)}
                    title={g.hint}
                  >
                    {g.label}
                  </Button>
                ))}
                <Input
                  style={{ width: 220 }}
                  placeholder="组件名称（保存时使用）"
                  value={compName}
                  onChange={(e) => setCompName(e.target.value)}
                />
                <Button type="primary" loading={compLoading} onClick={handleGenerate}>
                  生成组件
                </Button>
              </Space>
              {compError && (
                <div style={{ color: '#ff3b30', fontSize: 13 }}>⚠️ {compError}</div>
              )}
              {compCode && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color="cyan">{compType.toUpperCase()}</Tag>
                    <span style={{ fontSize: 12, color: '#86868b' }}>
                      {compCode.length} 字符
                    </span>
                    <Space style={{ marginLeft: 'auto' }}>
                      <Button size="small" onClick={copyCode}>
                        复制代码
                      </Button>
                      <Button size="small" onClick={downloadFile}>
                        下载文件
                      </Button>
                      <Button size="small" onClick={saveSnippet}>
                        保存到代码仓库
                      </Button>
                      <Button size="small" type="primary" onClick={registerWidget}>
                        登记到组件中心
                      </Button>
                    </Space>
                  </div>
                  {compType === 'echarts' && compOptionJson && (
                    <div
                      style={{
                        height: 260,
                        border: '1px solid #e5e5ea',
                        borderRadius: 8,
                        background: '#f5f5f7',
                        overflow: 'hidden',
                      }}
                    >
                      <ReactECharts
                        option={JSON.parse(compOptionJson) as Record<string, unknown>}
                        style={{ height: 260, width: '100%' }}
                        notMerge
                      />
                    </div>
                  )}
                  {(compType === 'html' || (compType === 'echarts' && !compOptionJson)) && (
                    <iframe
                      ref={previewFrameRef}
                      title="AI 组件预览"
                      srcDoc={previewSrcDoc()}
                      sandbox="allow-scripts allow-same-origin"
                      style={{
                        width: '100%',
                        height: 260,
                        border: '1px solid #e5e5ea',
                        borderRadius: 8,
                        background: '#f5f5f7',
                      }}
                    />
                  )}
                  {compType === 'react' && (
                    <div
                      style={{
                        height: 260,
                        border: '1px solid #e5e5ea',
                        borderRadius: 8,
                        background: '#f5f5f7',
                        overflow: 'hidden',
                      }}
                    >
                      <iframe
                        title="AI React 组件安全预览"
                        srcDoc={reactPreviewSrcDoc()}
                        sandbox="allow-scripts"
                        style={{ width: '100%', height: '100%', border: 0, background: 'transparent' }}
                      />
                    </div>
                  )}
                  <Input.TextArea
                    value={compCode}
                    onChange={(e) => setCompCode(e.target.value)}
                    rows={10}
                    style={{
                      fontFamily: 'SFMono-Regular, Consolas, "Liberation Mono", monospace',
                      fontSize: 12.5,
                      lineHeight: 1.7,
                      background: '#f5f5f7',
                      border: '1px solid #e5e5ea',
                      borderRadius: 8,
                    }}
                  />
                  <Space wrap style={{ marginTop: 2 }}>
                    <Select
                      size="small"
                      style={{ width: 260 }}
                      placeholder={
                        registeredWidgets.length
                          ? '选择要更新的已登记组件'
                          : '暂无已登记组件'
                      }
                      value={updateTarget || undefined}
                      onChange={setUpdateTarget}
                      options={registeredWidgets
                        .filter(
                          (w) =>
                            w.renderer === 'htmlComponent' ||
                            w.renderer === 'reactComponent' ||
                            w.kind === 'echarts' ||
                            w.category === 'ECharts',
                        )
                        .map((w) => ({
                          value: w.type,
                          label: `${w.name}（${w.type} · v${w.version}）`,
                        }))}
                    />
                    <Button
                      size="small"
                      type="primary"
                      ghost
                      loading={updating}
                      disabled={!updateTarget}
                      onClick={updateRegisteredWidget}
                    >
                      更新已登记组件
                    </Button>
                    <Button
                      size="small"
                      icon={<RobotOutlined />}
                      disabled={!updateTarget}
                      onClick={() => {
                        setAdjustPrompt('')
                        setAdjustError('')
                        setAdjustOpen(true)
                      }}
                    >
                      AI 调整选中组件
                    </Button>
                  </Space>
                </>
              )}
              <Space>
                <Button onClick={() => navigate('/')}>返回设计器</Button>
              </Space>
            </div>
          )}

          {activeTab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div
                style={{
                  minHeight: 240,
                  maxHeight: 420,
                  overflow: 'auto',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  background: '#f5f5f7',
                  border: '1px solid #e5e5ea',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                {chat.length === 0 && (
                  <div style={{ color: '#86868b', fontSize: 13 }}>
                    问我任何关于大屏设计、组件或数据可视化的问题
                  </div>
                )}
                {chat.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      maxWidth: '82%',
                      padding: '8px 10px',
                      borderRadius: 8,
                      background: m.role === 'user' ? '#0071e3' : '#f2f2f7',
                      fontSize: 13,
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {m.content || (chatLoading ? '…' : '')}
                  </div>
                ))}
              </div>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onPressEnter={handleChat}
                  placeholder="输入问题，Enter 发送"
                />
                <Button type="primary" loading={chatLoading} onClick={handleChat}>
                  发送
                </Button>
              </Space.Compact>
            </div>
          )}

          {activeTab === 'bot' && <BotList />}
        </div>
      </div>
      <Modal
        title="重命名会话"
        open={!!renameTarget}
        onOk={confirmRename}
        onCancel={() => setRenameTarget(null)}
        okText="保存"
        cancelText="取消"
      >
        <Input
          value={renameTitle}
          onChange={(e) => setRenameTitle(e.target.value)}
          onPressEnter={confirmRename}
          placeholder="会话标题"
        />
      </Modal>
      <Modal
        title={
          <span>
            <RobotOutlined style={{ marginRight: 6, color: '#0071e3' }} />
            AI 调整选中组件
          </span>
        }
        open={adjustOpen}
        onCancel={() => !adjustLoading && setAdjustOpen(false)}
        footer={null}
        width={480}
        maskClosable={!adjustLoading}
        destroyOnClose
      >
        <p style={{ marginTop: 0, color: '#86868b', fontSize: 13 }}>
          将基于已登记组件的现有内容生成调整方案，生成后填入组件生成区预览，确认后点击「更新已登记组件」保存并记录版本。
        </p>
        <Input.TextArea
          rows={3}
          value={adjustPrompt}
          onChange={(e) => setAdjustPrompt(e.target.value)}
          placeholder="例如：把柱状图颜色改成渐变色，标题加粗"
          disabled={adjustLoading}
        />
        {adjustError && (
          <div style={{ marginTop: 10, color: '#ff3b30', fontSize: 12 }}>⚠️ {adjustError}</div>
        )}
        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <Button size="small" disabled={adjustLoading} onClick={() => setAdjustOpen(false)}>
            取消
          </Button>
          <Button
            size="small"
            type="primary"
            icon={<RobotOutlined />}
            loading={adjustLoading}
            onClick={adjustSelectedWidget}
          >
            生成调整方案
          </Button>
        </div>
      </Modal>
    </div>
  )
}
