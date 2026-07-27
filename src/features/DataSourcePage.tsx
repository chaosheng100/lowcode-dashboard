import { useState } from 'react'
import { useApi } from './useApi'
import { api } from '../mock'
import { getRouteCapability } from '../data/capabilities'
import type { DataSourceType } from '../mock/types'

const TYPE_LABEL: Record<DataSourceType, string> = {
  mysql: 'MySQL',
  postgres: 'PostgreSQL',
  api: 'API',
  kafka: 'Kafka',
  file: '文件'
}

/**
 * 数据源配置（/data/source）—— 画布"数据源能力"的底座。
 * 配置的数据源成为画布组件取数的来路（数据集 → 画布绑定）。
 */
export default function DataSourcePage() {
  const { data, loading, error, reload } = useApi(() => api.listDataSources({ pageSize: 50 }), [])
  const cap = getRouteCapability('/data/source')
  const [testing, setTesting] = useState<string | null>(null)
  const [result, setResult] = useState<string>('')

  const test = async (id: string) => {
    setTesting(id)
    setResult('')
    try {
      const r = await api.testDataSource(id)
      setResult(r.data.ok ? `连通成功（${r.data.latencyMs}ms）` : '连通失败')
    } catch (e) {
      setResult('测试异常：' + (e as Error).message)
    } finally {
      setTesting(null)
    }
  }

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">数据源配置</h2>
          <p className="fp-sub">
            画布组件取数的来路 · {cap ? `画布能力：${cap.capability}` : ''}
          </p>
        </div>
        <span className="fp-count">共 {data?.list.length ?? 0} 个数据源</span>
      </div>
      {loading && <div className="fp-loading">加载中…</div>}
      {error && <div className="fp-error">{error}</div>}
      {result && <div className="fp-error" style={{ color: '#9ec1ff', background: '#16202f', borderColor: '#2f4a73' }}>{result}</div>}
      {!loading && !error && (
        <table className="data-table">
          <thead>
            <tr>
              <th>名称</th>
              <th>类型</th>
              <th>地址</th>
              <th>状态</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {data!.list.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td className="muted">{TYPE_LABEL[d.type]}</td>
                <td className="muted">{d.endpoint}</td>
                <td>
                  <span className={'status-dot ' + (d.status === 'connected' ? 'active' : 'disabled')}>
                    {d.status === 'connected' ? '已连接' : '异常'}
                  </span>
                </td>
                <td>
                  <button className="btn sm" disabled={testing === d.id} onClick={() => test(d.id)}>
                    {testing === d.id ? '测试中' : '连通测试'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {data && <div className="pager"><button className="btn sm" onClick={reload}>刷新</button></div>}
    </div>
  )
}
