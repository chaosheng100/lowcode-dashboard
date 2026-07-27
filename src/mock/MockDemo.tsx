import { useState } from 'react'
import { mockFetch } from '../mock'
import type { ApiResp } from '../mock'

interface Endpoint {
  label: string
  method: 'GET' | 'POST'
  path: string
  buildQuery: (injectError: boolean) => Record<string, any>
}

const ENDPOINTS: Endpoint[] = [
  {
    label: '大屏列表',
    method: 'GET',
    path: '/api/dashboards',
    buildQuery: (e) => ({ page: 1, pageSize: 5, ...(e ? { __code: 500 } : {}) })
  },
  {
    label: '数据源',
    method: 'GET',
    path: '/api/datasources',
    buildQuery: (e) => ({ page: 1, pageSize: 5, ...(e ? { __code: 403 } : {}) })
  },
  {
    label: '数据集',
    method: 'GET',
    path: '/api/datasets',
    buildQuery: (e) => ({ page: 1, pageSize: 5, ...(e ? { __code: 500 } : {}) })
  },
  {
    label: '数据集查询',
    method: 'POST',
    path: '/api/datasets/dset_3000/query',
    buildQuery: (e) => ({ pageSize: 8, ...(e ? { __code: 500 } : {}) })
  },
  {
    label: '用户',
    method: 'GET',
    path: '/api/users',
    buildQuery: (e) => ({ page: 1, pageSize: 6, ...(e ? { __code: 500 } : {}) })
  },
  {
    label: '角色',
    method: 'GET',
    path: '/api/roles',
    buildQuery: (e) => (e ? { __code: 500 } : {})
  },
  {
    label: '扩展状态',
    method: 'GET',
    path: '/api/extensions/status',
    buildQuery: (e) => (e ? { __code: 500 } : {})
  },
  {
    label: '组件库',
    method: 'GET',
    path: '/api/widgets',
    buildQuery: (e) => ({ page: 1, pageSize: 8, ...(e ? { __code: 500 } : {}) })
  },
  {
    label: '报表',
    method: 'GET',
    path: '/api/reports',
    buildQuery: (e) => ({ page: 1, pageSize: 5, ...(e ? { __code: 500 } : {}) })
  },
  {
    label: '大屏分析',
    method: 'GET',
    path: '/api/analytics/summary',
    buildQuery: (e) => ({ range: '7d', ...(e ? { __code: 500 } : {}) })
  }
]

export default function MockDemo({ onClose }: { onClose: () => void }) {
  const [active, setActive] = useState<Endpoint>(ENDPOINTS[0])
  const [loading, setLoading] = useState(false)
  const [resp, setResp] = useState<ApiResp<unknown> | null>(null)
  const [injectError, setInjectError] = useState(false)

  const run = async (ep: Endpoint) => {
    setActive(ep)
    setLoading(true)
    setResp(null)
    const r = await mockFetch(ep.method, ep.path, { query: ep.buildQuery(injectError) })
    setResp(r)
    setLoading(false)
  }

  const statusClass = !resp ? '' : resp.code === 0 ? 'ok' : 'err'

  return (
    <div className="mock-mask" onClick={onClose}>
      <div className="mock-modal" onClick={(e) => e.stopPropagation()}>
        <div className="mock-head">
          <span>Mock 接口演示</span>
          <button className="btn" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="mock-body">
          <aside className="mock-list">
            {ENDPOINTS.map((ep) => (
              <button
                key={ep.path}
                className={'mock-ep' + (active.path === ep.path ? ' active' : '')}
                onClick={() => run(ep)}
              >
                <span className={'m-method m-' + ep.method}>{ep.method}</span>
                {ep.label}
              </button>
            ))}
          </aside>
          <section className="mock-detail">
            <div className="mock-req">
              <code>
                {active.method} {active.path}
              </code>
              <label className="mock-err-toggle">
                <input
                  type="checkbox"
                  checked={injectError}
                  onChange={(e) => setInjectError(e.target.checked)}
                />
                模拟错误
              </label>
              <button className="btn" onClick={() => run(active)}>
                重新请求
              </button>
            </div>
            <div className={'mock-resp ' + statusClass}>
              {loading && <div className="mock-loading">请求中（模拟网络延迟）…</div>}
              {!loading && resp && resp.code !== 0 && (
                <div className="mock-banner err">
                  错误 code={resp.code}：{resp.message}
                </div>
              )}
              {!loading && resp && resp.code === 0 && (
                <>
                  {isPageResult(resp.data) && resp.data.list.length === 0 && (
                    <div className="mock-banner">无数据（空结果）</div>
                  )}
                  <pre>{JSON.stringify(resp.data, null, 2)}</pre>
                </>
              )}
              {!loading && !resp && <div className="mock-banner">点击左侧接口发起请求</div>}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function isPageResult(d: unknown): d is { list: unknown[]; total: number } {
  return !!d && typeof d === 'object' && Array.isArray((d as any).list) && 'total' in (d as any)
}
