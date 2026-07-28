import PluginManagement from './PluginManagement'
import { api } from '../mock'
import type { ReportDTO } from '../mock/types'
import { Tag } from './common'
import ReportDesignPage from './ReportDesignPage'

/** 报表管理：报表列表 + 进入编辑器（报表设计器）+ 预览（关系与大屏管理一致） */
export default function ReportManagement() {
  return (
    <PluginManagement<ReportDTO>
      title="报表管理"
      subtitle="数据报表设计与可视化展示，支持编辑器设计 + 预览"
      countLabel="报表"
      fetcher={() => api.listReports({ pageSize: 50 })}
      saveItem={(b) => api.saveReport(b)}
      deleteItem={(id) => api.deleteReport(id)}
      blankItem={() => ({ id: '', name: '新建报表', sourceName: '', format: ['xlsx'], schedule: '手动', updatedAt: '' })}
      renderMeta={(r) => [`来源：${r.sourceName || '—'}`, `调度：${r.schedule}`, `格式：${r.format.join(' / ')}`]}
      renderTags={(r) => <div className="flex" style={{ margin: '6px 0' }}>{r.format.map((f) => <Tag key={f}>{f}</Tag>)}</div>}
      renderEditor={() => <ReportDesignPage />}
      renderPreview={(r) => <ReportPreview item={r} />}
    />
  )
}

function ReportPreview({ item }: { item: ReportDTO }) {
  const rows = [
    { dim: '华东', value: 320 }, { dim: '华北', value: 210 },
    { dim: '华南', value: 260 }, { dim: '西部', value: 150 }
  ]
  const total = rows.reduce((a, b) => a + b.value, 0)
  return (
    <div style={{ maxWidth: 820, margin: '0 auto' }}>
      <div className="flex" style={{ justifyContent: 'space-between', marginBottom: 12 }}>
        <b style={{ color: '#e6edf3', fontSize: 20 }}>{item.name}</b>
        <span className="muted2">来源：{item.sourceName || '—'} · {item.schedule}</span>
      </div>
      <table style={{ width: '100%', borderCollapse: 'collapse', background: '#0d1420', borderRadius: 8, overflow: 'hidden' }}>
        <thead>
          <tr style={{ background: '#11203a' }}>
            <th style={{ padding: '10px 14px', textAlign: 'left', color: '#9fb0c3', fontWeight: 600 }}>区域</th>
            <th style={{ padding: '10px 14px', textAlign: 'right', color: '#9fb0c3', fontWeight: 600 }}>数值</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.dim} style={{ borderTop: '1px solid #1a2433' }}>
              <td style={{ padding: '10px 14px', color: '#e6edf3' }}>{r.dim}</td>
              <td style={{ padding: '10px 14px', textAlign: 'right', color: '#00d4ff', fontWeight: 600 }}>{r.value}</td>
            </tr>
          ))}
          <tr style={{ borderTop: '2px solid #2a3340', background: '#0b1729' }}>
            <td style={{ padding: '10px 14px', color: '#e6edf3', fontWeight: 700 }}>合计</td>
            <td style={{ padding: '10px 14px', textAlign: 'right', color: '#4ade80', fontWeight: 700 }}>{total}</td>
          </tr>
        </tbody>
      </table>
      <div className="muted2" style={{ marginTop: 12, textAlign: 'right' }}>生成时间：{new Date().toLocaleString()}</div>
    </div>
  )
}
