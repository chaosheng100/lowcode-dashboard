import { useState } from 'react'
import { useApi } from './useApi'
import { api } from '../mock'
import { Modal, Tag } from './common'
import type { CodeSnippetDTO, CodeLang } from '../mock/types'

const LANG_LABEL: Record<CodeLang, string> = { vue: 'Vue', html: 'HTML', ts: 'TypeScript', js: 'JavaScript', sql: 'SQL' }
const LANGS: CodeLang[] = ['vue', 'html', 'ts', 'js', 'sql']

function blankSnippet(): CodeSnippetDTO {
  return { id: '', name: '新片段', lang: 'vue', tags: [], code: '', updatedAt: '' }
}

/** 代码仓库：源码组件 / Vue / HTML / SQL 片段，可封装为画布自定义组件 */
export default function CodeRepoPage() {
  const { data, loading, error, reload } = useApi(() => api.listSnippets({ pageSize: 50 }), [])
  const [editing, setEditing] = useState<CodeSnippetDTO | null>(null)
  const [tagsText, setTagsText] = useState('')
  const [saving, setSaving] = useState(false)

  const openEdit = (s: CodeSnippetDTO) => {
    setEditing({ ...s })
    setTagsText(s.tags.join(', '))
  }
  const openNew = () => {
    const b = blankSnippet()
    setEditing(b)
    setTagsText('')
  }

  const save = async () => {
    if (!editing) return
    if (!editing.name.trim() || !editing.code.trim()) {
      window.alert('名称与代码不能为空')
      return
    }
    setSaving(true)
    try {
      const tags = tagsText.split(/[,，]/).map((t) => t.trim()).filter(Boolean)
      await api.saveSnippet({ ...editing, tags })
      reload()
      setEditing(null)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (s: CodeSnippetDTO) => {
    if (!window.confirm(`确定删除片段「${s.name}」？`)) return
    await api.deleteSnippet(s.id)
    reload()
    setEditing(null)
  }

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">代码仓库</h2>
          <p className="fp-sub">源码组件 / Vue / HTML / SQL 片段管理，支持二次开发与一键封装为组件</p>
        </div>
        <span className="fp-count">共 {data?.list.length ?? 0} 个片段</span>
      </div>
      {loading && <div className="fp-loading">加载中…</div>}
      {error && <div className="fp-error">{error}</div>}
      {!loading && !error && (
        <>
          <div className="fp-toolbar" style={{ marginBottom: 12 }}>
            <button className="btn" onClick={openNew}>＋ 新建片段</button>
          </div>
          <div className="grid3">
            {(data?.list ?? []).map((s) => (
              <div key={s.id} className="card">
                <div className="flex" style={{ justifyContent: 'space-between' }}>
                  <b style={{ color: '#e6edf3' }}>{s.name}</b><Tag>{LANG_LABEL[s.lang]}</Tag>
                </div>
                <div className="flex" style={{ margin: '8px 0' }}>{s.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
                <div className="muted2" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.code.split('\n')[0]}</div>
                <div className="fp-toolbar" style={{ marginTop: 8 }}>
                  <button className="btn sm" onClick={() => openEdit(s)}>查看 / 编辑</button>
                  <button className="btn sm" onClick={() => remove(s)}>删除</button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {editing && (
        <Modal title={editing.id ? `编辑 · ${editing.name}` : '新建片段'} onClose={() => setEditing(null)} width={720}>
          <div className="field"><label>名称</label>
            <input className="inp" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </div>
          <div className="row2">
            <div className="field"><label>语言</label>
              <select className="inp" value={editing.lang} onChange={(e) => setEditing({ ...editing, lang: e.target.value as CodeLang })}>
                {LANGS.map((l) => <option key={l} value={l}>{LANG_LABEL[l]}</option>)}
              </select>
            </div>
            <div className="field"><label>标签（逗号分隔）</label>
              <input className="inp" value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="例如：柱状图, 销售" />
            </div>
          </div>
          <div className="field"><label>代码</label>
            <textarea
              className="inp"
              style={{ minHeight: 280, fontFamily: 'monospace', fontSize: 12.5 }}
              value={editing.code}
              onChange={(e) => setEditing({ ...editing, code: e.target.value })}
            />
          </div>
          <div className="fp-toolbar" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
            {editing.id && <button className="btn" onClick={() => remove(editing)}>删除</button>}
            <button className="btn primary" onClick={save} disabled={saving}>{saving ? '保存中…' : '保存'}</button>
          </div>
        </Modal>
      )}
    </div>
  )
}
