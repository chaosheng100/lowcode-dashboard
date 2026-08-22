import { useMemo, useState } from 'react'
import { Alert, Button, DatePicker, Select, Table, Typography } from 'antd'
import type { TableProps } from 'antd'
import type { Dayjs } from 'dayjs'
import { useApi } from './useApi'
import { governanceApi } from '../api/governanceResourceApi'
import type { AnalyticsDTO } from '../mock/types'
import EChartBox from './EChartBox'
import { MetricRow, Stat, PageHeader } from './common'

/** 明细列：数值列次要色，错误率 >1% 标红（沿用旧 .muted/.abnormal 语义） */
const columns: TableProps<AnalyticsDTO>['columns'] = [
  { title: '大屏', dataIndex: 'name' },
  { title: 'PV', dataIndex: 'pv', render: (v: number) => <Typography.Text type="secondary">{v}</Typography.Text> },
  { title: '平均时长(s)', dataIndex: 'durationSec', render: (v: number) => <Typography.Text type="secondary">{v}</Typography.Text> },
  { title: '性能P95(ms)', dataIndex: 'perfP95', render: (v: number) => <Typography.Text type="secondary">{v}</Typography.Text> },
  { title: '错误率', dataIndex: 'errorRate', render: (v: number) => <Typography.Text type={v > 1 ? 'danger' : 'secondary'}>{v}%</Typography.Text> }
]

/** 大屏分析：运行态监控（PV / 时长 / 性能 P95 / 错误率） */
export default function AnalysisPage() {
  const [range, setRange] = useState<[Dayjs | null, Dayjs | null] | null>(null)
  const [screenFilter, setScreenFilter] = useState('')
  const query = useMemo(() => {
    const q: Record<string, unknown> = { from: range?.[0]?.toISOString() || new Date(Date.now() - 24 * 3600 * 1000).toISOString(), to: range?.[1]?.toISOString() || new Date().toISOString() }
    if (screenFilter) q.screenId = screenFilter
    return q
  }, [range, screenFilter])
  const { data, loading, error, reload } = useApi(() => governanceApi.listAnalytics(query), [query])
  const trendsState = useApi(() => governanceApi.analyticsTrends(query), [query])
  const list = data ?? []
  const trends = (trendsState.data ?? []) as Array<{ bucket: string; pv: number; errorRate: number; p95Ms: number }>
  const totalPv = list.reduce((s, d) => s + d.pv, 0)
  const avgPerf = list.length ? Math.round(list.reduce((s, d) => s + d.perfP95, 0) / list.length) : 0
  const avgErr = list.length ? (list.reduce((s, d) => s + d.errorRate, 0) / list.length).toFixed(2) : '0'
  const screenIds = useMemo(() => Array.from(new Set(list.map((d) => d.dashboardId))), [list])

  return (
    <div className="feature-page">
      <PageHeader title="大屏分析" subtitle="对画布运行态做监控与性能 / 异常分析" actions={<div className="fp-head-actions">
        <Select style={{ minWidth: 180 }} allowClear placeholder="选择大屏" value={screenFilter || undefined} onChange={(v) => setScreenFilter(String(v || ''))} options={screenIds.map((id) => ({ value: id, label: id }))} />
        <DatePicker.RangePicker value={range} onChange={(v) => setRange(v as [Dayjs, Dayjs] | null)} />
        <Button onClick={reload}>刷新</Button>
      </div>} />
      <MetricRow>
        <Stat label="总访问量(PV)" value={totalPv.toLocaleString()} accent="#0a84ff" />
        <Stat label="平均性能 P95" value={avgPerf + 'ms'} accent="#0a84ff" />
        <Stat label="平均错误率" value={avgErr + '%'} accent="#ff3b30" />
        <Stat label="监控大屏数" value={list.length} accent="#34c759" />
      </MetricRow>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="fp-toolbar" style={{ marginBottom: 8 }}><div className="muted2">访问趋势</div><div className="muted2">错误率 {trends.length ? trends[trends.length - 1].errorRate : 0}%</div></div>
        <EChartBox height={240} option={{
          xAxis: { type: 'category', data: trends.map((t) => t.bucket.slice(5, 16)), axisLabel: { color: '#86868b', rotate: 20 } },
          series: [
            { type: 'line', data: trends.map((t) => t.pv), name: 'PV', itemStyle: { color: '#0a84ff' }, smooth: true },
            { type: 'line', data: trends.map((t) => t.p95Ms), name: 'P95(ms)', yAxisIndex: 1, itemStyle: { color: '#34c759' }, smooth: true },
          ],
          yAxis: [{ type: 'value', splitLine: { lineStyle: { color: '#e5e5ea' } } }, { type: 'value', splitLine: { show: false } }],
        }} />
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="muted2" style={{ marginBottom: 8 }}>错误率走势</div>
        <EChartBox height={180} option={{ xAxis: { type: 'category', data: trends.map((t) => t.bucket.slice(5, 16)) }, yAxis: { type: 'value', max: 100 }, series: [{ type: 'bar', data: trends.map((t) => t.errorRate), itemStyle: { color: '#ff3b30', borderRadius: [4, 4, 0, 0] } }] }} />
      </div>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 14 }} />}
      {!error && !loading && (
        <Table<AnalyticsDTO>
          columns={columns}
          dataSource={list}
          rowKey="dashboardId"
          size="small"
          loading={loading}
          pagination={false}
        />
      )}
    </div>
  )
}
