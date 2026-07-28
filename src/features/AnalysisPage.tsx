import { useApi } from './useApi'
import { api } from '../mock'
import EChartBox from './EChartBox'
import { Stat } from './common'

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
        <Stat label="总访问量(PV)" value={totalPv.toLocaleString()} accent="#4f8cff" />
        <Stat label="平均性能 P95" value={avgPerf + 'ms'} accent="#22d3ee" />
        <Stat label="平均错误率" value={avgErr + '%'} accent="#ff8585" />
        <Stat label="监控大屏数" value={list.length} accent="#4ade80" />
      </div>
      <div className="card" style={{ marginBottom: 14 }}>
        <div className="muted2" style={{ marginBottom: 8 }}>各大大屏访问量</div>
        <EChartBox height={240} option={{
          xAxis: { type: 'category', data: list.map((d) => d.name), axisLabel: { color: '#9fb0c3', rotate: 20 } },
          yAxis: { type: 'value', splitLine: { lineStyle: { color: '#1b2636' } } },
          series: [{ type: 'bar', data: list.map((d) => d.pv), itemStyle: { color: '#4f8cff', borderRadius: [4, 4, 0, 0] } }]
        }} />
      </div>
      {loading && <div className="fp-loading">加载中…</div>}
      {error && <div className="fp-error">{error}</div>}
      {!loading && !error && (
        <table className="data-table">
          <thead><tr><th>大屏</th><th>PV</th><th>平均时长(s)</th><th>性能P95(ms)</th><th>错误率</th></tr></thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.dashboardId}>
                <td>{d.name}</td><td className="muted">{d.pv}</td><td className="muted">{d.durationSec}</td>
                <td className="muted">{d.perfP95}</td><td className={d.errorRate > 1 ? 'abnormal' : 'muted'}>{d.errorRate}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
