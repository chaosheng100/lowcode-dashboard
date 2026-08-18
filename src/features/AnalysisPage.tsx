import { Alert, Table, Typography } from 'antd'
import type { TableProps } from 'antd'
import { useApi } from './useApi'
import { api } from '../mock'
import type { AnalyticsDTO } from '../mock'
import EChartBox from './EChartBox'
import { Stat } from './common'

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
  const { data, loading, error } = useApi(() => api.getAnalytics(), [])
  const list = data ?? []
  const totalPv = list.reduce((s, d) => s + d.pv, 0)
  const avgPerf = list.length ? Math.round(list.reduce((s, d) => s + d.perfP95, 0) / list.length) : 0
  const avgErr = list.length ? (list.reduce((s, d) => s + d.errorRate, 0) / list.length).toFixed(2) : '0'

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">大屏分析</h2>
          <p className="fp-sub">对画布运行态做监控与性能 / 异常分析</p>
        </div>
      </div>
      <div className="flex" style={{ marginBottom: 14 }}>
        <Stat label="总访问量(PV)" value={totalPv.toLocaleString()} accent="#0a84ff" />
        <Stat label="平均性能 P95" value={avgPerf + 'ms'} accent="#0a84ff" />
        <Stat label="平均错误率" value={avgErr + '%'} accent="#ff3b30" />
        <Stat label="监控大屏数" value={list.length} accent="#34c759" />
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="muted2" style={{ marginBottom: 8 }}>各大大屏访问量</div>
        <EChartBox height={240} option={{
          xAxis: { type: 'category', data: list.map((d) => d.name), axisLabel: { color: '#86868b', rotate: 20 } },
          yAxis: { type: 'value', splitLine: { lineStyle: { color: '#e5e5ea' } } },
          series: [{ type: 'bar', data: list.map((d) => d.pv), itemStyle: { color: '#0a84ff', borderRadius: [4, 4, 0, 0] } }]
        }} />
      </div>
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 14 }} />}
      {!error && (
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
