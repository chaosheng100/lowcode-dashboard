import { useEffect, useRef, useState } from 'react'
import { App, Collapse, Empty, Input, Tag, Select, Button, Space, Switch, Spin } from 'antd'
import { useNavigate, Link } from 'react-router-dom'
import { api } from '../mock/api'
import type { AIModelDTO, AIBotDTO } from '../mock/types'
import type { AIDesignSchema, AIDesignIntent, AIDesignReview, AIDesignData } from '../data/types'
import { useDesignerStore } from '../data/store/useDesignerStore'
import AIDashboardPreview from './ai/AIDashboardPreview'
import GenHistoryPanel from './ai/GenHistoryPanel'
import { useGenHistory } from './ai/aiGenHistory'
import type { GenVersion } from './ai/aiGenHistory'

const CARD = { background: '#0d1322', border: '1px solid #1b2740', borderRadius: 10, padding: 14 }

// 模型选择器（会话/生成共用）：返回完整模型对象，便于设计接口按 modelId 解析 provider/key
function ModelSelector({
  models,
  value,
  onChange,
}: {
  models: AIModelDTO[]
  value: AIModelDTO | null
  onChange: (m: AIModelDTO | null) => void
}) {
  return (
    <Select
      style={{ width: 220 }}
      placeholder="选择 AI 模型"
      value={value?.id}
      onChange={(id) => onChange(models.find((m) => m.id === id) || null)}
      options={models.map((m) => ({
        value: m.id,
        label: `${m.name} · ${m.provider}`,
      }))}
    />
  )
}

// 我的机器人列表（复用 /api/aiBots）
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
  if (!bots.length) return <Empty description="还没有机器人，去「系统 / AI 机器人」创建一个吧" />
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
            <div>提示词：{b.systemPrompt ? b.systemPrompt.slice(0, 120) + '…' : '—'}</div>
          </div>
        ),
      }))}
    />
  )
}

/**
 * AI 助手页：智能问答 / AI 生成大屏 / 我的机器人
 * —— 生成大屏走多智能体流水线（Orchestrator 反推意图 → WidgetAgent 生成 Schema →
 *    DataAgent 数据绑定 → ReviewAgent 结构校验），结果可实时预览并一键应用进画布。
 * —— 内置「生成历史版本管理」：每次生成都保存为一个版本节点，
 *    支持切换预览、从历史版本继续迭代、版本命名/删除，避免后续微调方案与第一次截然不同。
 */
export default function AIAssistantPage() {
  const { message } = App.useApp()
  const navigate = useNavigate()
  const [activeTab, setActiveTab] = useState('generate')

  // 智能问答
  const [chatInput, setChatInput] = useState('')
  const [chat, setChat] = useState<{ role: 'user' | 'ai'; content: string }[]>([])
  const [chatLoading, setChatLoading] = useState(false)

  // AI 生成大屏 — 用历史版本管理替代原来的单状态
  const history = useGenHistory()
  const { versions, active, activeId, latest, setActiveId, addVersion, renameVersion, deleteVersion, clearAll } = history

  // 当前输入
  const [genInput, setGenInput] = useState('')
  const [correction, setCorrection] = useState('')

  // 生成中状态（流式过程中的增量数据，生成完毕后写入版本）
  const [genThought, setGenThought] = useState('')
  const [genIntent, setGenIntent] = useState<AIDesignIntent | null>(null)
  const [genReview, setGenReview] = useState<AIDesignReview | null>(null)
  const [genData, setGenData] = useState<AIDesignData | null>(null)
  const [genLoading, setGenLoading] = useState(false)
  const [genError, setGenError] = useState('')

  // 模型 / 数据源
  const [models, setModels] = useState<AIModelDTO[]>([])
  const [selectedModel, setSelectedModel] = useState<AIModelDTO | null>(null)
  const [useCustom, setUseCustom] = useState(false)
  const [customProvider, setCustomProvider] = useState('openai')
  const [customBaseURL, setCustomBaseURL] = useState('')
  const [customApiKey, setCustomApiKey] = useState('')
  const [customModel, setCustomModel] = useState('')
  const [datasets, setDatasets] = useState<{ id: string; name: string }[]>([])
  const [datasetId, setDatasetId] = useState<string | undefined>(undefined)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    api
      .listAIModels({ pageSize: 100 })
      .then((r) => r.code === 0 && setModels(r.data.list))
      .catch(() => {})
    api
      .listDatasets({ pageSize: 100 })
      .then((r) => r.code === 0 && setDatasets(r.data.list.map((d) => ({ id: d.id, name: d.name }))))
      .catch(() => {})
  }, [])

  // 当前展示用的 schema（生成中用流式增量，生成后用选中版本的）
  const displaySchema: AIDesignSchema | null = genLoading
    ? null
    : active
      ? active.schema
      : null

  const displayIntent = genLoading ? genIntent : active?.intent ?? null
  const displayReview = genLoading ? genReview : active?.review ?? null
  const displayData = genLoading ? genData : active?.data ?? null
  const displayThought = genLoading ? genThought : active?.thought ?? ''

  // —— 智能问答 ——
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
        signal: ctrl.signal,
        onDelta: (t) => {
          acc += t
          setChat((c) => {
            const next = [...c]
            next[next.length - 1] = { role: 'ai', content: acc }
            return next
          })
        },
        onError: (m) => {
          setChat((c) => {
            const next = [...c]
            next[next.length - 1] = { role: 'ai', content: '⚠️ ' + m }
            return next
          })
        },
      })
      .finally(() => setChatLoading(false))
  }

  // —— AI 生成大屏（多智能体 + 版本历史）——
  /**
   * 调用 AI 设计接口
   * @param prompt 完整 prompt
   * @param baseSchema 基于哪个 schema 修改（undefined = 从零生成）
   * @param parentId 父版本 id（写入历史用）
   * @param source 生成来源
   */
  const runDesign = (
    prompt: string,
    baseSchema?: AIDesignSchema,
    parentId?: string,
    source: 'initial' | 'iterate' | 'regenerate' = 'initial',
  ) => {
    if (!prompt.trim()) {
      message.warning('请输入大屏描述')
      return
    }
    setGenLoading(true)
    setGenError('')
    setGenThought('')
    setGenIntent(null)
    setGenReview(null)
    setGenData(null)

    // 暂存流式数据，生成完成后一次性写入版本
    let finalSchema: AIDesignSchema | null = null
    let finalIntent: AIDesignIntent | null = null
    let finalReview: AIDesignReview | null = null
    let finalData: AIDesignData | null = null
    let finalThought = ''

    const ctrl = new AbortController()
    abortRef.current = ctrl
    const opts: any = {
      signal: ctrl.signal,
      baseSchema,
      onDelta: (t: string) => {
        finalThought += t
        setGenThought(finalThought)
      },
      onIntent: (i: AIDesignIntent) => {
        finalIntent = i
        setGenIntent(i)
      },
      onSchema: (s: AIDesignSchema) => {
        finalSchema = s
      },
      onReview: (r: AIDesignReview) => {
        finalReview = r
        setGenReview(r)
      },
      onData: (d: AIDesignData) => {
        finalData = d
        setGenData(d)
      },
      onError: (m: string) => {
        setGenError(m)
        setGenLoading(false)
      },
    }
    if (useCustom) {
      opts.provider = customProvider
      opts.baseURL = customBaseURL
      opts.apiKey = customApiKey
      opts.model = customModel
    } else if (selectedModel) {
      opts.modelId = selectedModel.id
    }
    if (datasetId) opts.datasetId = datasetId

    api
      .aiDesign(prompt, opts)
      .then(() => {
        setGenLoading(false)
        if (finalSchema && finalSchema.components?.length > 0) {
          // 写入版本历史
          const newId = addVersion(
            {
              prompt,
              schema: finalSchema,
              intent: finalIntent ?? undefined,
              review: finalReview ?? undefined,
              data: finalData ?? undefined,
              thought: finalThought,
            },
            parentId,
            source,
          )
          message.success(
            source === 'initial'
              ? '生成完成，已保存为 v1'
              : `生成完成，已保存为新版本`,
          )
          // 自动选中新版本
          setActiveId(newId)
        } else if (!genError) {
          message.warning('AI 未返回有效大屏设计')
        }
      })
      .catch(() => setGenLoading(false))
  }

  /** 初始生成 / 重新生成（从零开始） */
  const handleDesign = () => {
    runDesign(genInput, undefined, undefined, 'initial')
  }

  /** 过程纠偏：在当前选中版本基础上修改 */
  const handleIterate = () => {
    if (!correction.trim()) {
      message.warning('请输入修改指令')
      return
    }
    const base = active ?? latest
    const baseSchema = base?.schema
    const prompt = base
      ? `${base.prompt}；修改：${correction}`
      : `${genInput}；修改：${correction}`
    runDesign(prompt, baseSchema, base?.id, 'iterate')
    setCorrection('')
  }

  /** 重新生成当前版本（用同样的 prompt，但不带 baseSchema） */
  const handleRegenerate = () => {
    const base = active ?? latest
    if (!base) {
      handleDesign()
      return
    }
    // 重新生成：父版本 = 当前版本的父版本，重新跑一次
    runDesign(base.prompt, undefined, base.parentId, 'regenerate')
  }

  /** 从指定版本继续：把该版本设为基准，输入框填入修改提示 */
  const handleContinueFrom = (version: GenVersion) => {
    setActiveId(version.id)
    setGenInput(version.prompt)
    // 聚焦到修改输入框（通过设置一个 flag，用 useEffect 实现）
    const el = document.getElementById('correction-input') as HTMLInputElement | null
    if (el) {
      el.focus()
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
    message.info(`已选择 v${version.version} 作为基准，请输入修改指令`)
  }

  const handleApply = (asNew: boolean) => {
    const schema = displaySchema
    if (!schema) {
      message.warning('暂无可用的大屏设计，请先生成')
      return
    }
    const st = useDesignerStore.getState()
    if (asNew) {
      const id = st.createDashboard('AI 生成大屏')
      st.selectRoute(id)
    }
    st.applyAISchema(schema)
    message.success(asNew ? '已生成新大屏并应用' : '已应用到当前画布')
  }

  const cancelGen = () => {
    abortRef.current?.abort()
    setGenLoading(false)
  }

  return (
    <div style={{ padding: 24, color: '#e8f0ff', height: '100%', overflow: 'auto' }}>
      <h2 style={{ marginTop: 0 }}>AI 助手</h2>
      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        {/* 左侧：生成历史版本面板 */}
        <GenHistoryPanel
          versions={versions}
          activeId={activeId}
          onSelect={setActiveId}
          onContinueFrom={handleContinueFrom}
          onRename={renameVersion}
          onDelete={deleteVersion}
          onClearAll={clearAll}
        />

        {/* 中间/右侧：主操作区 */}
        <div style={{ flex: 1, minWidth: 460, ...CARD }}>
          {/* 顶部 Tab：智能问答 / AI 生成大屏 / 我的机器人 */}
          <Space style={{ marginBottom: 16 }}>
            <Button type={activeTab === 'generate' ? 'primary' : 'default'} onClick={() => setActiveTab('generate')}>
              AI 生成大屏
            </Button>
            <Button type={activeTab === 'chat' ? 'primary' : 'default'} onClick={() => setActiveTab('chat')}>
              智能问答
            </Button>
            <Button type={activeTab === 'bot' ? 'primary' : 'default'} onClick={() => setActiveTab('bot')}>
              我的机器人
            </Button>
          </Space>

          {activeTab === 'generate' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <Input.TextArea
                rows={3}
                placeholder="描述你想要的数据大屏，例如：做一个生产车间实时监控大屏，包含今日产量指标、各产线良率折线图、设备告警表格"
                value={genInput}
                onChange={(e) => setGenInput(e.target.value)}
              />

              <Space wrap>
                <ModelSelector models={models} value={selectedModel} onChange={setSelectedModel} />
                <Select
                  style={{ width: 200 }}
                  placeholder="绑定数据集（可选，AI 自动匹配字段）"
                  allowClear
                  value={datasetId}
                  onChange={(v) => setDatasetId(v)}
                  options={datasets.map((d) => ({ value: d.id, label: d.name }))}
                />
                <span style={{ fontSize: 13, color: '#9fb0cc' }}>
                  自定义模型
                  <Switch
                    size="small"
                    checked={useCustom}
                    onChange={setUseCustom}
                    style={{ marginLeft: 8 }}
                  />
                </span>
              </Space>

              {useCustom && (
                <Space wrap>
                  <Select
                    style={{ width: 140 }}
                    value={customProvider}
                    onChange={setCustomProvider}
                    options={[
                      { value: 'openai', label: 'OpenAI' },
                      { value: 'azure', label: 'Azure' },
                      { value: 'anthropic', label: 'Anthropic' },
                      { value: 'ollama', label: 'Ollama(私有)' },
                      { value: 'vllm', label: 'vLLM(私有)' },
                    ]}
                  />
                  <Input
                    style={{ width: 220 }}
                    placeholder="baseURL（私有化部署地址）"
                    value={customBaseURL}
                    onChange={(e) => setCustomBaseURL(e.target.value)}
                  />
                  <Input
                    style={{ width: 180 }}
                    placeholder="model 名"
                    value={customModel}
                    onChange={(e) => setCustomModel(e.target.value)}
                  />
                  <Input.Password
                    style={{ width: 200 }}
                    placeholder="apiKey（可选）"
                    value={customApiKey}
                    onChange={(e) => setCustomApiKey(e.target.value)}
                  />
                </Space>
              )}

              <Space>
                {genLoading ? (
                  <Button danger onClick={cancelGen}>
                    取消生成
                  </Button>
                ) : (
                  <Button type="primary" onClick={handleDesign}>
                    生成大屏
                  </Button>
                )}
                <Button onClick={() => navigate('/')}>返回设计器</Button>
              </Space>

              {genError && (
                <div style={{ color: '#ff6b6b', fontSize: 13 }}>⚠️ {genError}</div>
              )}

              {/* 当前基准版本提示 */}
              {active && !genLoading && (
                <div style={{
                  padding: '8px 12px',
                  background: 'rgba(22,119,255,0.1)',
                  border: '1px solid rgba(22,119,255,0.3)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: '#69b1ff',
                }}>
                  当前基准：v{active.version} {active.label || ''}
                  （{active.schema.components?.length ?? 0} 个组件）
                  — 「过程纠偏」将基于此版本修改
                </div>
              )}

              {/* Orchestrator：结构化设计意图（过程纠偏透明化） */}
              {displayIntent && (
                <Collapse
                  items={[
                    {
                      key: 'intent',
                      label: '设计意图（AI 怎么理解的）',
                      children: (
                        <div style={{ fontSize: 13, color: '#9fb0cc', lineHeight: 1.9 }}>
                          <div>{displayIntent.summary}</div>
                          <div style={{ marginTop: 6 }}>
                            <span style={{ color: '#7e8aa3' }}>指标/图表：</span>
                            {displayIntent.metrics.map((m, i) => (
                              <Tag key={i} color="blue">
                                {m}
                              </Tag>
                            ))}
                          </div>
                          <div style={{ marginTop: 6 }}>
                            <span style={{ color: '#7e8aa3' }}>维度：</span>
                            {displayIntent.dimensions.map((d, i) => (
                              <Tag key={i}>{d}</Tag>
                            ))}
                          </div>
                          <div style={{ marginTop: 6 }}>
                            {displayIntent.components.map((c, i) => (
                              <span key={i} style={{ marginRight: 12 }}>
                                {c.title} {c.hasData ? '✅数据' : '⚪样例'}
                              </span>
                            ))}
                          </div>
                        </div>
                      ),
                    },
                  ]}
                />
              )}

              {/* 思考过程（流式） */}
              {displayThought && (
                <Collapse
                  items={[
                    {
                      key: 'think',
                      label: '模型思考过程',
                      children: (
                        <pre
                          style={{
                            whiteSpace: 'pre-wrap',
                            wordBreak: 'break-word',
                            color: '#8aa0c2',
                            fontSize: 12,
                            margin: 0,
                            maxHeight: 160,
                            overflow: 'auto',
                          }}
                        >
                          {displayThought}
                        </pre>
                      ),
                    },
                  ]}
                />
              )}

              {/* ReviewAgent：结构校验结果 */}
              {displayReview && (
                <div style={{ fontSize: 13, color: '#cdd9ee' }}>
                  <div style={{ color: '#7e8aa3', marginBottom: 4 }}>
                    结构校验（{displayReview.issues.length ? displayReview.issues.length + ' 项已自动修复' : '无问题'}）
                  </div>
                  {displayReview.issues.map((iss, i) => (
                    <div key={i} style={{ color: '#ffd166' }}>
                      · {iss}
                    </div>
                  ))}
                </div>
              )}

              {/* DataAgent：数据绑定结果 */}
              {displayData && (
                <div style={{ fontSize: 13, color: '#7ee0a0' }}>
                  {displayData.datasetName
                    ? `已绑定数据集「${displayData.datasetName}」，注入 ${displayData.rowCount} 行样例数据，字段：${displayData.columns.join('、')}`
                    : `已绑定数据源，注入 ${displayData.rowCount} 行样例数据，字段：${displayData.columns.join('、')}`}
                </div>
              )}

              {/* 实时预览 */}
              <AIDashboardPreview schema={displaySchema} />

              {/* 应用 / 重新生成 / 过程纠偏 */}
              <Space wrap>
                <Button type="primary" disabled={!displaySchema || genLoading} onClick={() => handleApply(false)}>
                  应用到当前画布
                </Button>
                <Button disabled={!displaySchema || genLoading} onClick={() => handleApply(true)}>
                  作为新大屏生成
                </Button>
                <Button disabled={genLoading} onClick={handleRegenerate}>
                  重新生成
                </Button>
              </Space>

              <Space.Compact style={{ width: '100%' }}>
                <Input
                  id="correction-input"
                  style={{ width: 'calc(100% - 120px)' }}
                  placeholder="过程纠偏：追加修改指令，例如「改成深色科技风，折线改柱状」"
                  value={correction}
                  onChange={(e) => setCorrection(e.target.value)}
                  onPressEnter={handleIterate}
                />
                <Button
                  type="primary"
                  disabled={!correction.trim() || genLoading}
                  onClick={handleIterate}
                >
                  据此修改
                </Button>
              </Space.Compact>
            </div>
          )}

          {activeTab === 'chat' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ minHeight: 200, maxHeight: 360, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {chat.length === 0 && <Empty description="问点什么吧，比如：本月销量环比如何？" />}
                {chat.map((m, i) => (
                  <div
                    key={i}
                    style={{
                      alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start',
                      background: m.role === 'user' ? '#16324f' : '#13203a',
                      padding: '8px 12px',
                      borderRadius: 10,
                      maxWidth: '80%',
                      whiteSpace: 'pre-wrap',
                      wordBreak: 'break-word',
                      fontSize: 13,
                    }}
                  >
                    {m.content}
                  </div>
                ))}
                {chatLoading && <Spin size="small" />}
              </div>
              <Space.Compact style={{ width: '100%' }}>
                <Input
                  style={{ width: 'calc(100% - 80px)' }}
                  placeholder="输入问题…"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onPressEnter={handleChat}
                />
                <Button type="primary" onClick={handleChat} disabled={chatLoading}>
                  发送
                </Button>
              </Space.Compact>
              <Link to="/">返回设计器</Link>
            </div>
          )}

          {activeTab === 'bot' && <BotList />}
        </div>
      </div>
    </div>
  )
}
