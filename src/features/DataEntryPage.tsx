import { Alert, Spin } from 'antd'
import { useApi } from './useApi'
import { api } from '../mock'
import { Tag } from './common'

/** 数据填报：零代码采集业务数据，回灌为画布可绑定的数据集 */
export default function DataEntryPage() {
  const { data, loading, error } = useApi(() => api.listDataEntries({ pageSize: 50 }), [])
  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">数据填报</h2>
          <p className="fp-sub">零代码表单采集，沉淀为画布可绑定的数据集</p>
        </div>
        <span className="fp-count">共 {data?.list.length ?? 0} 张填报表</span>
      </div>
      {loading && <div style={{ textAlign: 'center', padding: 24 }}><Spin /></div>}
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 14 }} />}
      {!loading && !error && (
        <div className="grid2">
          {(data?.list ?? []).map((e) => (
            <div key={e.id} className="card">
              <b style={{ color: '#e6edf3' }}>{e.name}</b>
              <div className="muted2" style={{ margin: '8px 0' }}>字段：{e.fields.map((f) => f.name).join('、') || '无'}</div>
              <div className="flex">
                {e.fields.map((f) => <Tag key={f.name}>{f.name} · {f.type}</Tag>)}
              </div>
              <div className="muted2" style={{ marginTop: 10 }}>已录入 {e.rows.length} 条</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
