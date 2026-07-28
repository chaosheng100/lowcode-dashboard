import { useState } from 'react'
import { useApi } from './useApi'
import { api } from '../mock'
import { Modal, Field, Input, Tag } from './common'
import type { CategoryDTO } from '../mock/types'

const COLORS = ['#4f8cff', '#22d3ee', '#a855f7', '#e0b15a', '#4ade80']

/** 分类标签：大屏 / 组件 / 资源的分类与标签治理 */
export default function CategoryPage() {
  const { data, loading, error, reload } = useApi(() => api.listCategories({ pageSize: 50 }), [])
  const [editing, setEditing] = useState<Partial<CategoryDTO> | null>(null)

  const save = async () => { if (!editing) return; await api.saveCategory(editing); setEditing(null); reload() }
  const remove = async (id: string) => { await api.deleteCategory(id); reload() }

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">分类标签</h2>
          <p className="fp-sub">大屏 / 组件 / 资源的分类与标签，沉淀为画布模板与分组</p>
        </div>
        <button className="btn" onClick={() => setEditing({ name: '', group: '大屏分类', color: '#4f8cff', count: 0 })}>＋ 新建分类</button>
      </div>
      {loading && <div className="fp-loading">加载中…</div>}
      {error && <div className="fp-error">{error}</div>}
      {!loading && !error && (
        <div className="flex">
          {(data?.list ?? []).map((c) => (
            <div key={c.id} className="card" style={{ minWidth: 180 }}>
              <div className="flex" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: c.color, display: 'inline-block' }} />
                <b style={{ color: '#e6edf3', flex: 1, marginLeft: 8 }}>{c.name}</b>
                <Tag color={c.color}>{c.group}</Tag>
              </div>
              <div className="muted2" style={{ marginTop: 8 }}>关联 {c.count} 项</div>
              <div className="fp-toolbar" style={{ marginTop: 6 }}>
                <button className="btn sm" onClick={() => setEditing(c)}>编辑</button>
                <button className="btn sm danger" onClick={() => remove(c.id)}>删除</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {editing && (
        <Modal title={editing.id ? '编辑分类' : '新建分类'} onClose={() => setEditing(null)}>
          <Field label="名称"><Input value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
          <Field label="分组"><Input value={editing.group || ''} onChange={(e) => setEditing({ ...editing, group: e.target.value })} /></Field>
          <Field label="颜色">
            <span className="flex">
              {COLORS.map((c) => (
                <span key={c} onClick={() => setEditing({ ...editing, color: c })}
                  style={{ width: 22, height: 22, borderRadius: '50%', background: c, cursor: 'pointer', border: editing.color === c ? '2px solid #fff' : '2px solid transparent' }} />
              ))}
            </span>
          </Field>
          <div className="fp-toolbar"><button className="btn" onClick={save}>保存</button></div>
        </Modal>
      )}
    </div>
  )
}
