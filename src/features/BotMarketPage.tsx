import { useEffect, useMemo, useState } from 'react'
import {
  App,
  Button,
  Input,
  Modal,
  Popconfirm,
  Select,
  Space,
  Spin,
  Switch,
  Tabs,
  Tag,
} from 'antd'
import { api } from '../mock/api'
import type { AIBotDTO, AIMarketBotDTO, AIModelDTO } from '../mock/types'

type BotForm = {
  id?: string
  name: string
  description: string
  modelId: string | null
  prompt: string
  enabled: boolean
  isPublic: boolean
}

const EMPTY_FORM: BotForm = {
  name: '',
  description: '',
  modelId: null,
  prompt: '',
  enabled: true,
  isPublic: false,
}

export default function BotMarketPage() {
  const { message } = App.useApp()
  const [tab, setTab] = useState<'mine' | 'market'>('mine')
  const [mine, setMine] = useState<AIBotDTO[]>([])
  const [market, setMarket] = useState<AIMarketBotDTO[]>([])
  const [models, setModels] = useState<AIModelDTO[]>([])
  const [loading, setLoading] = useState(false)
  const [editing, setEditing] = useState<BotForm | null>(null)
  const [saving, setSaving] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async () => {
    setLoading(true)
    try {
      const [mineR, marketR, modelR] = await Promise.all([
        api.listAIBots({ pageSize: 100 }),
        api.listAIMarketBots({ pageSize: 100 }),
        api.listAIModels({ pageSize: 100 }),
      ])
      if (mineR.code === 0) setMine(mineR.data.list)
      if (marketR.code === 0) setMarket(marketR.data.list)
      if (modelR.code === 0) setModels(modelR.data.list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  const modelName = (id: string | null) =>
    models.find((m) => m.id === id)?.name || id || '默认模型'

  const save = async () => {
    if (!editing) return
    if (!editing.name.trim()) {
      message.warning('请填写机器人名称')
      return
    }
    setSaving(true)
    try {
      const body: Partial<AIBotDTO> = {
        name: editing.name.trim(),
        description: editing.description.trim(),
        modelId: editing.modelId,
        prompt: editing.prompt,
        enabled: editing.enabled,
        isPublic: editing.isPublic,
      }
      if (editing.id) body.id = editing.id
      const r = await api.saveAIBot(body)
      if (r.code === 0) {
        message.success('已保存机器人')
        setEditing(null)
        load()
      } else {
        message.error(r.message)
      }
    } catch (e: any) {
      message.error(e?.message || '保存失败')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    setBusyId(id)
    try {
      const r = await api.deleteAIBot(id)
      if (r.code === 0) {
        message.success('已删除')
        load()
      } else {
        message.error(r.message)
      }
    } finally {
      setBusyId(null)
    }
  }

  const publish = async (bot: AIBotDTO, isPublic: boolean) => {
    setBusyId(bot.id)
    try {
      const r = await api.publishAIBot(bot.id, isPublic)
      if (r.code === 0) {
        message.success(isPublic ? '已发布到共享市场' : '已从市场下架')
        load()
      } else {
        message.error(r.message)
      }
    } finally {
      setBusyId(null)
    }
  }

  const install = async (id: string) => {
    setBusyId(id)
    try {
      const r = await api.installAIBot(id)
      if (r.code === 0) {
        message.success('已安装到我的机器人')
        setTab('mine')
        load()
      } else {
        message.error(r.message)
      }
    } finally {
      setBusyId(null)
    }
  }

  const renderBotCard = (bot: AIBotDTO, marketItem: boolean) => (
    <div key={bot.id} className="card">
      <div className="flex" style={{ justifyContent: 'space-between' }}>
        <b style={{ color: '#1d1d1f' }}>{bot.name}</b>
        <Space size={4}>
          {bot.isPublic ? <Tag color="#34c759">已共享</Tag> : <Tag color="#86868b">私有</Tag>}
          {!bot.enabled && <Tag color="#ff9500">停用</Tag>}
        </Space>
      </div>
      <div className="muted2" style={{ margin: '6px 0' }}>
        {bot.description || '暂无描述'}
      </div>
      <div className="muted2">
        绑定模型：{modelName(bot.modelId)} · 安装 {bot.installCount ?? 0} 次
      </div>
      {marketItem && (
        <div className="muted2" style={{ marginTop: 4 }}>
          作者：{(bot as AIMarketBotDTO).ownerName || '平台'}
        </div>
      )}
      <div className="fp-toolbar" style={{ marginTop: 10 }}>
        {marketItem ? (
          <Button
            size="small"
            type="primary"
            loading={busyId === bot.id}
            onClick={() => install(bot.id)}
          >
            安装
          </Button>
        ) : (
          <>
            <Button
              size="small"
              onClick={() =>
                setEditing({
                  id: bot.id,
                  name: bot.name,
                  description: bot.description || '',
                  modelId: bot.modelId,
                  prompt: bot.prompt || bot.systemPrompt || '',
                  enabled: bot.enabled,
                  isPublic: !!bot.isPublic,
                })
              }
            >
              编辑
            </Button>
            <Button
              size="small"
              loading={busyId === bot.id}
              onClick={() => publish(bot, !bot.isPublic)}
            >
              {bot.isPublic ? '下架' : '发布'}
            </Button>
            <Popconfirm
              title="确认删除该机器人？"
              onConfirm={() => remove(bot.id)}
            >
              <Button size="small" danger loading={busyId === bot.id}>
                删除
              </Button>
            </Popconfirm>
          </>
        )}
      </div>
    </div>
  )

  const modelOptions = useMemo(
    () =>
      models.map((m) => ({
        label: `${m.name}（${m.provider}）`,
        value: m.id,
      })),
    [models],
  )

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">机器人共享市场</h2>
          <p className="fp-sub">
            创建可复用的智能机器人，发布到市场供团队安装；也可从市场一键安装共享机器人。
          </p>
        </div>
        <Button onClick={() => setEditing({ ...EMPTY_FORM })}>+ 新建机器人</Button>
      </div>
      <Tabs
        activeKey={tab}
        onChange={(key) => setTab(key as 'mine' | 'market')}
        items={[
          {
            key: 'mine',
            label: `我的机器人（${mine.length}）`,
            children: loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <Spin />
              </div>
            ) : (
              <div className="grid3">
                {mine.map((b) => renderBotCard(b, false))}
                {!mine.length && (
                  <div className="muted2">还没有机器人，点击右上角新建一个。</div>
                )}
              </div>
            ),
          },
          {
            key: 'market',
            label: `共享市场（${market.length}）`,
            children: loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
                <Spin />
              </div>
            ) : (
              <div className="grid3">
                {market.map((b) => renderBotCard(b, true))}
                {!market.length && (
                  <div className="muted2">市场暂时没有共享机器人。</div>
                )}
              </div>
            ),
          },
        ]}
      />
      <Modal
        title={editing?.id ? '编辑机器人' : '新建机器人'}
        open={!!editing}
        onCancel={() => setEditing(null)}
        onOk={save}
        confirmLoading={saving}
        okText="保存"
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <div className="muted2" style={{ marginBottom: 4 }}>名称</div>
            <Input
              value={editing?.name || ''}
              onChange={(e) => setEditing((p) => p && { ...p, name: e.target.value })}
              placeholder="机器人名称"
            />
          </div>
          <div>
            <div className="muted2" style={{ marginBottom: 4 }}>描述</div>
            <Input
              value={editing?.description || ''}
              onChange={(e) =>
                setEditing((p) => p && { ...p, description: e.target.value })
              }
              placeholder="简要说明用途"
            />
          </div>
          <div>
            <div className="muted2" style={{ marginBottom: 4 }}>绑定模型</div>
            <Select
              value={editing?.modelId || ''}
              onChange={(v) => setEditing((p) => p && { ...p, modelId: v || null })}
              placeholder="选择 AI 模型"
              options={modelOptions}
              style={{ width: '100%' }}
              allowClear
            />
          </div>
          <div>
            <div className="muted2" style={{ marginBottom: 4 }}>系统提示词</div>
            <Input.TextArea
              rows={5}
              value={editing?.prompt || ''}
              onChange={(e) =>
                setEditing((p) => p && { ...p, prompt: e.target.value })
              }
              placeholder="设定机器人的角色、能力与回复规则"
            />
          </div>
          <div className="flex" style={{ gap: 16 }}>
            <label className="flex" style={{ gap: 6, alignItems: 'center' }}>
              <span className="muted2">启用</span>
              <Switch
                size="small"
                checked={!!editing?.enabled}
                onChange={(v) => setEditing((p) => p && { ...p, enabled: v })}
              />
            </label>
            <label className="flex" style={{ gap: 6, alignItems: 'center' }}>
              <span className="muted2">发布到市场</span>
              <Switch
                size="small"
                checked={!!editing?.isPublic}
                onChange={(v) => setEditing((p) => p && { ...p, isPublic: v })}
              />
            </label>
          </div>
        </div>
      </Modal>
    </div>
  )
}
