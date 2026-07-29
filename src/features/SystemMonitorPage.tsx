import { useEffect, useState } from 'react'
import { Alert, Button, Card, Input, Table, type TableProps } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { api } from '../mock'
import type { AlertRuleDTO, AuditLogDTO, SystemMetricsDTO } from '../mock/types'
import { useApi, useDebounced } from './useApi'
import { Field, Input as CInput, Modal, Stat, Tag } from './common'

function fmtUptime(sec: number): string {
  if (!sec || sec < 0) return '—'
  const d = Math.floor(sec / 86400)
  const h = Math.floor((sec % 86400) / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = Math.floor(sec % 60)
  return `${d > 0 ? d + '天 ' : ''}${h}时${m}分${s}秒`
}

/** 系统监控：指标卡片（5s 轮询）+ 审计日志（分页/关键词）+ 告警规则（增删） */
export default function SystemMonitorPage() {
  // 指标：每 5 秒轮询
  const { data: metrics, reload: reloadMetrics } = useApi<SystemMetricsDTO | null>(() => api.getSystemMetrics(), [])
  useEffect(() => {
    const t = setInterval(() => reloadMetrics(), 5000)
    return () => clearInterval(t)
  }, [reloadMetrics])

  // 审计日志
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 8
  const debounced = useDebounced(keyword, 300)
  const { data: logs, loading: logLoading, error: logError, reload: reloadLogs } = useApi(
    () => api.getSystemLogs({ keyword: debounced, page, pageSize }),
    [debounced, page]
  )

  // 告警规则
  const { data: alerts, loading: alertLoading, reload: reloadAlerts } = useApi(() => api.listAlertRules({ pageSize: 100 }), [])
  const [rule, setRule] = useState<Partial<AlertRuleDTO> | null>(null)
  const [busy, setBusy] = useState(false)

  const logRows = logs?.list ?? []
  const total = logs?.total ?? 0
  const counts = metrics?.counts ?? {}

  const saveRule = async () => {
    if (!rule || !rule.name?.trim()) return
    setBusy(true)
    await api.saveAlertRule(rule)
    setBusy(false)
    setRule(null)
    reloadAlerts()
  }
  const removeRule = async (id: string) => {
    setBusy(true)
    await api.deleteAlertRule(id)
    setBusy(false)
    reloadAlerts()
  }

  const logColumns: TableProps<AuditLogDTO>['columns'] = [
    { title: '级别', dataIndex: 'level', key: 'level', render: (v?: string) => (v ? <Tag>{v}</Tag> : '—') },
    { title: '操作', dataIndex: 'action', key: 'action', render: (v?: string) => <span className="muted">{v || '—'}</span> },
    { title: '操作人', dataIndex: 'operator', key: 'operator', render: (v?: string) => <span className="muted">{v || '—'}</span> },
    { title: '详情', dataIndex: 'detail', key: 'detail', render: (v?: string) => <span className="muted">{v || '—'}</span> },
    { title: '时间', dataIndex: 'createdAt', key: 'createdAt', render: (v?: string) => <span className="muted">{v || '—'}</span> }
  ]

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div><h2 className="fp-title">系统监控</h2><p className="fp-sub">运行指标实时轮询（5s）+ 审计日志 + 告警规则</p></div>
        <Button onClick={() => { reloadMetrics(); reloadLogs(); reloadAlerts() }}>刷新</Button>
      </div>

      {/* 指标卡片 */}
      <div className="metrics-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 16 }}>
        <Card className="sec" styles={{ body: { padding: 14 } }}>
          <Stat label="运行时长" value={fmtUptime(metrics?.uptimeSec ?? 0)} accent="#4f8cff" />
        </Card>
        <Card className="sec" styles={{ body: { padding: 14 } }}>
          <Stat label="内存占用" value={metrics?.memory != null ? String(metrics.memory) : '—'} accent="#4ade80" />
        </Card>
        {Object.entries(counts).map(([k, v]) => (
          <Card key={k} className="sec" styles={{ body: { padding: 14 } }}>
            <Stat label={k} value={v} accent="#22d3ee" />
          </Card>
        ))}
      </div>

      {/* 审计日志 */}
      <Card className="sec" title={<span className="sec-title">审计日志</span>} style={{ marginBottom: 16 }}>
        <div className="fp-toolbar">
          <Input
            style={{ width: 280 }}
            placeholder="关键词搜索"
            prefix={<SearchOutlined />}
            allowClear
            value={keyword}
            onChange={(e) => { setKeyword(e.target.value); setPage(1) }}
          />
        </div>
        {logError && <Alert type="error" showIcon message={logError} style={{ marginBottom: 10 }} />}
        <Table<AuditLogDTO>
          size="small"
          rowKey={(r) => r.id}
          dataSource={logRows}
          columns={logColumns}
          loading={logLoading}
          pagination={{ current: page, pageSize, total, onChange: setPage, showSizeChanger: false, showTotal: (t) => `共 ${t} 条` }}
          locale={{ emptyText: '暂无日志' }}
        />
      </Card>

      {/* 告警规则 */}
      <Card
        className="sec"
        title={<span className="sec-title">告警规则</span>}
        extra={<Button size="small" type="primary" onClick={() => setRule({ name: '', level: 'warning', enabled: true })}>＋ 新增</Button>}
      >
        {alertLoading && <div className="muted2">加载中…</div>}
        {(alerts?.list ?? []).length === 0 && !alertLoading && <div className="muted2">暂无告警规则</div>}
        <div className="flex">
          {(alerts?.list ?? []).map((a) => (
            <div key={a.id} className="card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 260 }}>
              <div>
                <b>{a.name}</b>
                <div className="muted2">{a.metric ? `${a.metric} ${a.op ?? ''} ${a.threshold ?? ''}` : '—'} · {a.level ?? '—'}</div>
              </div>
              <Button size="small" danger disabled={busy} onClick={() => removeRule(a.id)}>删除</Button>
            </div>
          ))}
        </div>
      </Card>

      {rule && (
        <Modal title="新增告警规则" onClose={() => setRule(null)}>
          <Field label="规则名称"><CInput value={rule.name || ''} onChange={(e) => setRule({ ...rule, name: e.target.value })} /></Field>
          <Field label="指标"><CInput value={rule.metric || ''} onChange={(e) => setRule({ ...rule, metric: e.target.value })} /></Field>
          <Field label="级别">
            <CInput value={rule.level || ''} onChange={(e) => setRule({ ...rule, level: e.target.value })} />
          </Field>
          <div className="fp-toolbar" style={{ justifyContent: 'flex-end' }}>
            <Button onClick={() => setRule(null)}>取消</Button>
            <Button type="primary" loading={busy} onClick={saveRule}>保存</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
