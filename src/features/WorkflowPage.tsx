import { useApi } from './useApi'
import { api } from '../mock'
import { Tag } from './common'

/** 数据工作流：Flow 流程数据加工（解析 → 清洗 → 入库 → 大屏推送） */
export default function WorkflowPage() {
  const { data, loading, error } = useApi(() => api.listWorkflows({ pageSize: 50 }), [])
  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">数据工作流</h2>
          <p className="fp-sub">Flow 流程编排：触发 → 加工节点 → 大屏数据集</p>
        </div>
        <span className="fp-count">共 {data?.list.length ?? 0} 条流程</span>
      </div>
      {loading && <div className="fp-loading">加载中…</div>}
      {error && <div className="fp-error">{error}</div>}
      {!loading && !error && (
        <table className="data-table">
          <thead><tr><th>流程名称</th><th>触发器</th><th>节点</th><th>状态</th></tr></thead>
          <tbody>
            {(data?.list ?? []).map((w) => (
              <tr key={w.id}>
                <td>{w.name}</td>
                <td className="muted">{w.trigger}</td>
                <td className="flex">{w.nodes.map((n) => <Tag key={n}>{n}</Tag>)}</td>
                <td><span className={'status-dot ' + (w.status === 'running' ? 'active' : 'disabled')}>{w.status === 'running' ? '运行中' : '草稿'}</span></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}
