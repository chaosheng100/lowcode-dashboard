import { useEffect, useState } from 'react'
import { useApi } from './useApi'
import { api } from '../mock'
import { getRouteCapability } from '../data/capabilities'
import type { DataSourceDTO, DsKind, SqlVendor, ParseMode } from '../mock/types'
import { Modal, Field, Input, Select, Tag } from './common'
import { querySqlViaProxy, proxyHealth } from '../data/live/liveClient'

const KIND_LABEL: Record<DsKind, string> = {
  static: '静态数据', api: 'API 接口', sql: 'SQL 数据库', websocket: 'WebSocket',
  mqtt: 'MQTT', flow: 'Flow 流程', crawler: '爬虫/解析'
}
const VENDOR_LABEL: Record<SqlVendor, string> = {
  mysql: 'MySQL', sqlserver: 'SQLServer', postgres: 'PostgreSQL',
  starrocks: 'StarRocks', oracle: 'Oracle', other: '其他(可扩展)'
}
const KINDS: DsKind[] = ['static', 'api', 'sql', 'websocket', 'mqtt', 'flow', 'crawler']

/**
 * 数据源配置：覆盖规范全部来源类型（静态 / API / SQL[多库] / WebSocket / MQTT / Flow / 爬虫解析）。
 * 配置的数据源成为画布组件取数的来路（数据集 → 画布绑定）。
 */
export default function DataSourcePage() {
  const { data, loading, error, reload } = useApi(() => api.listDataSources({ pageSize: 50 }), [])
  const cap = getRouteCapability('/data/source')
  const [filter, setFilter] = useState<DsKind | 'all'>('all')
  const [editing, setEditing] = useState<Partial<DataSourceDTO> | null>(null)
  const [testing, setTesting] = useState<string | null>(null)
  const [result, setResult] = useState('')

  const list = (data?.list ?? []).filter((d) => filter === 'all' || d.kind === filter)

  // —— SQL 查询控制台（经后端代理真实取数） ——
  const [proxyOn, setProxyOn] = useState<boolean | null>(null)
  const [sqlConsole, setSqlConsole] = useState<DataSourceDTO | null>(null)
  const [sql, setSql] = useState('SELECT region AS name, amount AS value FROM orders LIMIT 8')
  const [sqlBusy, setSqlBusy] = useState(false)
  const [sqlOut, setSqlOut] = useState<{ columns: string[]; rows: unknown[][]; elapsedMs: number; simulated?: boolean; fallbackReason?: string } | null>(null)
  const [sqlErr, setSqlErr] = useState('')

  useEffect(() => { proxyHealth().then(setProxyOn) }, [])

  const runSql = async () => {
    if (!sqlConsole) return
    setSqlBusy(true); setSqlErr(''); setSqlOut(null)
    try {
      const out = await querySqlViaProxy({
        dsType: sqlConsole.vendor || 'mysql',
        endpoint: sqlConsole.endpoint,
        sql
      })
      setSqlOut(out)
    } catch (e) {
      setSqlErr('代理服务不可达（请先运行 npm run proxy 启动数据代理，端口 5175）：' + (e as Error).message)
    } finally { setSqlBusy(false) }
  }
  const test = async (id: string) => {
    setTesting(id); setResult('')
    try {
      const r = await api.testDataSource(id)
      setResult(r.data.ok ? `连通成功（${r.data.latencyMs}ms）` : '连通失败')
    } catch (e) { setResult('测试异常：' + (e as Error).message) } finally { setTesting(null) }
  }
  const save = async () => {
    if (!editing) return
    await api.saveDataSource(editing)
    setEditing(null); reload()
  }
  const remove = async (id: string) => { await api.deleteDataSource(id); reload() }

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">数据源配置</h2>
          <p className="fp-sub">
            画布组件取数的来路 · {cap ? `画布能力：${cap.capability}` : ''} ·{' '}
            {proxyOn === null ? '代理检测中…' : proxyOn
              ? <span style={{ color: '#4ade80' }}>● 数据代理在线（SQL/WS/MQTT 真实取数）</span>
              : <span style={{ color: '#facc15' }}>● 数据代理离线（npm run proxy 启动后启用真实取数）</span>}
          </p>
        </div>
        <button className="btn" onClick={() => setEditing({ name: '', kind: 'api', scope: 'public', endpoint: '', status: 'connected' })}>＋ 新建数据源</button>
      </div>

      <div className="tabs">
        <span className={'tab' + (filter === 'all' ? ' active' : '')} onClick={() => setFilter('all')}>全部</span>
        {KINDS.map((k) => (
          <span key={k} className={'tab' + (filter === k ? ' active' : '')} onClick={() => setFilter(k)}>{KIND_LABEL[k]}</span>
        ))}
      </div>

      {result && <div className="fp-error" style={{ color: '#9ec1ff', background: '#16202f', borderColor: '#2f4a73' }}>{result}</div>}
      {loading && <div className="fp-loading">加载中…</div>}
      {error && <div className="fp-error">{error}</div>}
      {!loading && !error && (
        <table className="data-table">
          <thead>
            <tr><th>名称</th><th>类型</th><th>库/范围</th><th>地址</th><th>解析</th><th>状态</th><th>操作</th></tr>
          </thead>
          <tbody>
            {list.map((d) => (
              <tr key={d.id}>
                <td>{d.name}</td>
                <td className="muted">{KIND_LABEL[d.kind]}</td>
                <td className="muted">{d.kind === 'sql' ? VENDOR_LABEL[d.vendor || 'other'] : (d.scope === 'public' ? '公共' : '独立')}</td>
                <td className="muted">{d.endpoint}</td>
                <td className="muted">{d.parseMode ? <Tag>{d.parseMode}</Tag> : '—'}</td>
                <td><span className={'status-dot ' + (d.status === 'connected' ? 'active' : 'disabled')}>{d.status === 'connected' ? '已连接' : '异常'}</span></td>
                <td>
                  <button className="btn sm" disabled={testing === d.id} onClick={() => test(d.id)}>{testing === d.id ? '测试中' : '连通测试'}</button>{' '}
                  {d.kind === 'sql' && <><button className="btn sm" onClick={() => { setSqlConsole(d); setSqlOut(null); setSqlErr('') }}>SQL 查询</button>{' '}</>}
                  <button className="btn sm" onClick={() => setEditing(d)}>编辑</button>{' '}
                  <button className="btn sm danger" onClick={() => remove(d.id)}>删除</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan={7} className="fp-empty">暂无数据源</td></tr>}
          </tbody>
        </table>
      )}

      {editing && (
        <Modal title={editing.id ? '编辑数据源' : '新建数据源'} onClose={() => setEditing(null)}>
          <Field label="名称"><Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="来源类型">
            <Select value={editing.kind || 'api'} onChange={(e) => setEditing({ ...editing, kind: e.target.value as DsKind })}>
              {KINDS.map((k) => <option key={k} value={k}>{KIND_LABEL[k]}</option>)}
            </Select>
          </Field>
          {editing.kind === 'sql' && (
            <Field label="数据库">
              <Select value={editing.vendor || 'mysql'} onChange={(e) => setEditing({ ...editing, vendor: e.target.value as SqlVendor })}>
                {(Object.keys(VENDOR_LABEL) as SqlVendor[]).map((v) => <option key={v} value={v}>{VENDOR_LABEL[v]}</option>)}
              </Select>
            </Field>
          )}
          <Field label="作用域">
            <Select value={editing.scope || 'public'} onChange={(e) => setEditing({ ...editing, scope: e.target.value as 'public' | 'private' })}>
              <option value="public">公共数据集</option>
              <option value="private">独立数据集</option>
            </Select>
          </Field>
          <Field label="地址 / 连接串"><Input value={editing.endpoint || ''} onChange={(e) => setEditing({ ...editing, endpoint: e.target.value })} /></Field>
          {(editing.kind === 'api' || editing.kind === 'crawler') && (
            <Field label="数据解析">
              <Select value={editing.parseMode || 'json'} onChange={(e) => setEditing({ ...editing, parseMode: e.target.value as ParseMode })}>
                <option value="json">JSON</option><option value="xml">XML</option><option value="html">HTML(爬虫)</option><option value="script">脚本</option>
              </Select>
            </Field>
          )}
          <div className="fp-toolbar"><button className="btn" onClick={save}>保存</button></div>
        </Modal>
      )}

      {sqlConsole && (
        <Modal title={`SQL 查询控制台 · ${sqlConsole.name}（${VENDOR_LABEL[sqlConsole.vendor || 'other']}）`} onClose={() => setSqlConsole(null)}>
          <div className="muted2" style={{ marginBottom: 8 }}>
            经数据代理（localhost:5175）执行只读查询；已安装真实驱动（mysql2/pg）时直连数据库，否则返回模拟结果并标注。
          </div>
          <textarea className="inp area" style={{ minHeight: 90 }} value={sql} onChange={(e) => setSql(e.target.value)} />
          <div className="fp-toolbar" style={{ margin: '10px 0' }}>
            <button className="btn" disabled={sqlBusy} onClick={runSql}>{sqlBusy ? '执行中…' : '▶ 执行查询'}</button>
          </div>
          {sqlErr && <div className="fp-error">{sqlErr}</div>}
          {sqlOut && (
            <>
              <div className="muted2" style={{ marginBottom: 6 }}>
                {sqlOut.simulated
                  ? <span style={{ color: '#facc15' }}>模拟结果（{sqlOut.fallbackReason || '驱动未安装'}）</span>
                  : <span style={{ color: '#4ade80' }}>真实查询</span>}
                {' '}· {sqlOut.rows.length} 行 · {sqlOut.elapsedMs}ms
              </div>
              <table className="data-table">
                <thead><tr>{sqlOut.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead>
                <tbody>
                  {sqlOut.rows.map((r, i) => (
                    <tr key={i}>{r.map((v, j) => <td key={j} className="muted">{String(v)}</td>)}</tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
