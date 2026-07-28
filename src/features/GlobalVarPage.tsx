import { useState } from 'react'
import { useApi } from './useApi'
import { api } from '../mock'
import { Modal, Field, Input, Select, Textarea, Tag } from './common'
import type { GlobalVarDTO, VarKind } from '../mock/types'

const KIND_LABEL: Record<VarKind, string> = { variable: '变量', function: '函数', formatter: '数据格式化' }

/** 全局变量：跨组件共享的变量 / 函数 / 数据格式化表达式 */
export default function GlobalVarPage() {
  const { data, loading, error, reload } = useApi(() => api.listVars({ pageSize: 50 }), [])
  const [editing, setEditing] = useState<Partial<GlobalVarDTO> | null>(null)

  const save = async () => { if (!editing) return; await api.saveVar(editing); setEditing(null); reload() }
  const remove = async (id: string) => { await api.deleteVar(id); reload() }

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">全局变量</h2>
          <p className="fp-sub">全局函数 / 变量 / 数据格式化共享，画布组件跨组件绑定与联动</p>
        </div>
        <button className="btn" onClick={() => setEditing({ name: '', kind: 'variable', value: '', scope: 'global' })}>＋ 新建</button>
      </div>
      {loading && <div className="fp-loading">加载中…</div>}
      {error && <div className="fp-error">{error}</div>}
      {!loading && !error && (
        <table className="data-table">
          <thead><tr><th>名称</th><th>类型</th><th>作用域</th><th>值 / 表达式</th><th>操作</th></tr></thead>
          <tbody>
            {(data?.list ?? []).map((v) => (
              <tr key={v.id}>
                <td>{v.name}</td>
                <td><Tag>{KIND_LABEL[v.kind]}</Tag></td>
                <td className="muted">{v.scope === 'global' ? '全局' : '大屏'}</td>
                <td className="muted" style={{ maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.value}</td>
                <td>
                  <button className="btn sm" onClick={() => setEditing(v)}>编辑</button>{' '}
                  <button className="btn sm danger" onClick={() => remove(v.id)}>删除</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      {editing && (
        <Modal title={editing.id ? '编辑变量' : '新建变量'} onClose={() => setEditing(null)}>
          <Field label="名称"><Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="类型">
            <Select value={editing.kind || 'variable'} onChange={(e) => setEditing({ ...editing, kind: e.target.value as VarKind })}>
              {Object.keys(KIND_LABEL).map((k) => <option key={k} value={k}>{KIND_LABEL[k as VarKind]}</option>)}
            </Select>
          </Field>
          <Field label="作用域">
            <Select value={editing.scope || 'global'} onChange={(e) => setEditing({ ...editing, scope: e.target.value as 'global' | 'screen' })}>
              <option value="global">全局</option><option value="screen">大屏</option>
            </Select>
          </Field>
          <Field label="值 / 表达式"><Textarea value={editing.value || ''} onChange={(e) => setEditing({ ...editing, value: e.target.value })} /></Field>
          <div className="fp-toolbar"><button className="btn" onClick={save}>保存</button></div>
        </Modal>
      )}
    </div>
  )
}
