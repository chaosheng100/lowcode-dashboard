import { useState } from 'react'
import { Alert, Button, Spin, Table } from 'antd'
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
        <Button onClick={() => setEditing({ name: '', kind: 'variable', value: '', scope: 'global' })}>＋ 新建</Button>
      </div>
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spin /></div>}
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 10 }} />}
      {!loading && !error && (
        <Table<GlobalVarDTO>
          size="small"
          rowKey="id"
          pagination={false}
          dataSource={data?.list ?? []}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '类型', key: 'kind', render: (_, v) => <Tag>{KIND_LABEL[v.kind]}</Tag> },
            { title: '作用域', key: 'scope', render: (_, v) => <span className="muted">{v.scope === 'global' ? '全局' : '大屏'}</span> },
            { title: '值 / 表达式', dataIndex: 'value', ellipsis: true, render: (val: string) => <span className="muted">{val}</span> },
            {
              title: '操作', key: 'actions', render: (_, v) => (
                <>
                  <Button size="small" type="link" onClick={() => setEditing(v)}>编辑</Button>
                  <Button size="small" type="link" danger onClick={() => remove(v.id)}>删除</Button>
                </>
              )
            }
          ]}
        />
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
          <div className="fp-toolbar"><Button onClick={save}>保存</Button></div>
        </Modal>
      )}
    </div>
  )
}
