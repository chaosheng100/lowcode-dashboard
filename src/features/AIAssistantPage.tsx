import { useCallback, useEffect, useRef, useState } from 'react'
import { App, Button, Collapse, Empty, Input, Modal, Space, Spin, Tag } from 'antd'
import { useNavigate } from 'react-router-dom'
import { api } from '../mock/api'
import type { AIBotDTO, AISessionItem, CodeLang } from '../mock/types'

const CARD = {
  background: '#0d1322',
  border: '1px solid #1b2740',
  borderRadius: 10,
  padding: 14,
}

type GenType = 'html' | 'react' | 'echarts'

const GEN_OPTIONS: { value: GenType; label: string; hint: string }[] = [
  { value: 'html', label: 'HTML', hint: '独立 HTML 页面/组件' },
  { value: 'react', label: 'React', hint: 'TSX 组件文件' },
  { value: 'echarts', label: 'ECharts', hint: 'ECharts 图表组件（带预览）' },
]

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
          <div style={{ fontSize: 13, color: '#9fb0cc', lineHeight: 1.8 }}>
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
      .then((r) => r.code === 0 && setSessions(r.data.list))
      .catch(() => {})
  }, [])
  useEffect(loadSessions, [loadSessions])

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
  const [compLoading, setCompLoading] = useState(false)
  const [compError, setCompError] = useState('')
  const compAccRef = useRef('')

  const handleGenerate = async () => {
    const p = compPrompt.trim()
    if (!p) {
      message.warning('请输入组件描述')
      return
    }
    setCompLoading(true)
    setCompError('')
    setCompCode('')
    compAccRef.current = ''
    try {
      const r = await api.aiGenerate(p, compType, {
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
    const csp =
      '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data: https:; font-src data: https:">'
    if (compType === 'html') {
      if (/^\s*<(?:!doctype|html)/i.test(compCode)) return compCode
      return `<!doctype html><html><head><meta charset="utf-8">${csp}</head><body>${compCode}</body></html>`
    }
    if (compType === 'echarts') {
      return `<!doctype html><html><head><meta charset="utf-8">${csp}<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script></head><body style="margin:0;background:#0b1325"><div id="chart" style="width:100vw;height:100vh"></div><script>\n${compCode}\ntry { echarts.init(document.getElementById('chart')).setOption(option || window.option || {}); } catch (e) { document.body.innerHTML = '<pre style="color:#f87171;padding:12px">' + e.message + '</pre>' }\n<\/script></body></html>`
    }
    return ''
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
    const type = `ai_${Date.now().toString(36)}`
    const r = await api.saveWidget({
      type,
      name: snippetName(),
      icon: 'CodeOutlined',
      category: 'AI 生成',
      version: '1.0.0',
      desc: compPrompt.trim() || 'AI 生成组件',
    })
    if (r.code === 0) message.success(`已登记到组件中心（${type}）`)
    else message.error(r.message)
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
    <div style={{ padding: 24, color: '#e8f0ff', height: '100%', overflow: 'auto' }}>
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
                      ? 'rgba(0,212,255,.12)'
                      : 'rgba(255,255,255,.03)',
                  border:
                    '1px solid ' +
                    (activeSessionId === s.id
                      ? 'rgba(0,212,255,.3)'
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
                  <span style={{ fontSize: 11, color: '#7e8aa3' }}>
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
                <div style={{ color: '#ff6b6b', fontSize: 13 }}>⚠️ {compError}</div>
              )}
              {compCode && (
                <>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <Tag color="cyan">{compType.toUpperCase()}</Tag>
                    <span style={{ fontSize: 12, color: '#9fb0cc' }}>
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
                  {(compType === 'html' || compType === 'echarts') && (
                    <iframe
                      title="AI 组件预览"
                      srcDoc={previewSrcDoc()}
                      sandbox="allow-scripts allow-same-origin"
                      style={{
                        width: '100%',
                        height: 260,
                        border: '1px solid #1b2740',
                        borderRadius: 8,
                        background: '#0a101d',
                      }}
                    />
                  )}
                  <pre
                    style={{
                      maxHeight: 420,
                      overflow: 'auto',
                      background: '#0a101d',
                      border: '1px solid #1b2740',
                      borderRadius: 8,
                      padding: 12,
                      fontSize: 12.5,
                      lineHeight: 1.7,
                      color: '#cfe3ff',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-all',
                    }}
                  >
                    {compCode}
                  </pre>
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
                  background: '#0a101d',
                  border: '1px solid #1b2740',
                  borderRadius: 8,
                  padding: 12,
                }}
              >
                {chat.length === 0 && (
                  <div style={{ color: '#5b6776', fontSize: 13 }}>
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
                      background: m.role === 'user' ? '#1668dc' : '#131c2e',
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
    </div>
  )
}
