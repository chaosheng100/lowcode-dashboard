import { useEffect, useState } from 'react'
import { App, Button, InputNumber, Space, Table, Tag } from 'antd'
import { api } from '../mock'
import { useApi } from './useApi'
import type { AIQuota, AIUsageItem, AIUsageStats } from '../mock/types'

export default function AgentUsagePage() {
  const { message } = App.useApp()
  const { data, loading } = useApi(() => api.listAIUsage({ pageSize: 50 }), [])
  const [stats, setStats] = useState<AIUsageStats | null>(null)
  const [quota, setQuota] = useState<AIQuota>({ dailyLimit: 1000, modelWhitelist: [] })
  const [dailyLimit, setDailyLimit] = useState(1000)

  useEffect(() => {
    api.getAIUsageStats().then((r) => r.code === 0 && setStats(r.data))
    api.getAIQuota().then((r) => {
      if (r.code === 0) {
        setQuota(r.data)
        setDailyLimit(r.data.dailyLimit)
      }
    })
  }, [])

  const saveQuota = async () => {
    const r = await api.saveAIQuota({ ...quota, dailyLimit })
    if (r.code === 0) {
      setQuota({ ...quota, dailyLimit })
      message.success('配额已保存')
    } else {
      message.error(r.message)
    }
  }

  const list = data?.list ?? []
  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">Agent 用量与配额</h2>
          <p className="fp-sub">统计 AI 调用次数、Token 与耗时，配置每日调用上限</p>
        </div>
        <Space>
          <span style={{ fontSize: 13, color: '#86868b' }}>每日上限</span>
          <InputNumber
            min={0}
            value={dailyLimit}
            onChange={(v) => setDailyLimit(Number(v) || 0)}
          />
          <Button type="primary" onClick={saveQuota}>保存配额</Button>
        </Space>
      </div>

      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
        {[
          { label: '总调用', value: stats?.totalCalls ?? 0 },
          { label: '总 Token', value: stats?.totalTokens ?? 0 },
          { label: '今日调用', value: stats?.todayCalls ?? 0 },
          { label: '总耗时(ms)', value: stats?.totalDurationMs ?? 0 },
        ].map((s) => (
          <div
            key={s.label}
            style={{
              flex: '1 1 180px',
              padding: 12,
              background: '#ffffff',
              border: '1px solid #e5e5ea',
              borderRadius: 8,
            }}
          >
            <div style={{ fontSize: 12, color: '#86868b' }}>{s.label}</div>
            <div style={{ fontSize: 20, color: '#1d1d1f' }}>{s.value}</div>
          </div>
        ))}
      </div>
      <div style={{ marginBottom: 12 }}>
        {(stats?.byScene ?? []).map((b) => (
          <Tag key={b.scene} color="cyan" style={{ marginBottom: 4 }}>
            {b.scene}：{b._count._all} 次 · {b._sum.estimatedTokens ?? 0} token
          </Tag>
        ))}
      </div>

      <Table<AIUsageItem>
        rowKey="id"
        size="small"
        loading={loading}
        dataSource={list}
        pagination={{ pageSize: 20, showSizeChanger: false }}
        columns={[
          { title: '场景', dataIndex: 'scene', width: 110 },
          {
            title: '状态',
            dataIndex: 'status',
            width: 100,
            render: (v: string) => <Tag color={v === 'success' ? 'green' : 'red'}>{v}</Tag>,
          },
          { title: 'Prompt Tokens', dataIndex: 'promptTokens', width: 120 },
          { title: 'Completion Tokens', dataIndex: 'completionTokens', width: 140 },
          { title: '估算 Token', dataIndex: 'estimatedTokens', width: 110 },
          { title: '耗时(ms)', dataIndex: 'durationMs', width: 100 },
          { title: '时间', dataIndex: 'createdAt', width: 180 },
        ]}
      />
    </div>
  )
}
