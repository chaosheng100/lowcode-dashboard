import { useState } from 'react'
import { Alert, App, Button, Popconfirm, Select, Spin } from 'antd'
import { useApi } from './useApi'
import { api } from '../mock'
import { Field, Input, Modal, Tag, Textarea } from './common'
import type { CodeSnippetDTO, CodeLang } from '../mock/types'

const LANG_LABEL: Record<CodeLang, string> = { vue: 'Vue', html: 'HTML', ts: 'TypeScript', js: 'JavaScript', sql: 'SQL' }
const LANGS: CodeLang[] = ['vue', 'html', 'ts', 'js', 'sql']

function blankSnippet(): CodeSnippetDTO {
  return { id: '', name: '新片段', lang: 'vue', tags: [], code: '', updatedAt: '' }
}

/** 代码仓库：源码组件 / Vue / HTML / SQL 片段，可封装为画布自定义组件 */
export default function CodeRepoPage() {
  const { message } = App.useApp()
  const { data, loading, error, reload } = useApi(() => api.listSnippets({ pageSize: 50 }), [])
  const [editing, setEditing] = useState<CodeSnippetDTO | null>(null)
  const [tagsText, setTagsText] = useState('')
  const [saving, setSaving] = useState(false)

  const openEdit = (s: CodeSnippetDTO) => {
    setEditing({ ...s })
    setTagsText((s.tags ?? []).join(', '))
  }
  const openNew = () => {
    const b = blankSnippet()
    setEditing(b)
    setTagsText('')
  }

  const save = async () => {
    if (!editing) return
    if (!editing.name.trim() || !editing.code.trim()) {
      message.warning('名称与代码不能为空')
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
      {loading && <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}><Spin /></div>}
      {error && <Alert type="error" message={error} showIcon style={{ marginBottom: 10 }} />}
      {!loading && !error && (
        <>
          <div className="fp-toolbar" style={{ marginBottom: 12 }}>
            <Button onClick={openNew}>＋ 新建片段</Button>
          </div>
          <div className="grid3">
            {(data?.list ?? []).map((s) => (
              <div key={s.id} className="card">
                <div className="flex" style={{ justifyContent: 'space-between' }}>
                  <b style={{ color: '#1d1d1f' }}>{s.name}</b><Tag>{LANG_LABEL[s.lang] ?? s.lang}</Tag>
                </div>
                <div className="flex" style={{ margin: '8px 0' }}>{(s.tags ?? []).map((t) => <Tag key={t}>{t}</Tag>)}</div>
                <div className="muted2" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(s.code ?? '').split('\n')[0]}</div>
                <div className="fp-toolbar" style={{ marginTop: 8 }}>
                  <Button size="small" onClick={() => openEdit(s)}>查看 / 编辑</Button>
                  <Popconfirm title={`确定删除片段「${s.name}」？`} onConfirm={() => remove(s)}>
                    <Button size="small">删除</Button>
                  </Popconfirm>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
      {editing && (
        <Modal title={editing.id ? `编辑 · ${editing.name}` : '新建片段'} onClose={() => setEditing(null)} width={720}>
          <Field label="名称">
            <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </Field>
          <div className="row2">
            <Field label="语言">
              <Select
                value={editing.lang}
                options={LANGS.map((l) => ({ value: l, label: LANG_LABEL[l] }))}
                onChange={(v) => setEditing({ ...editing, lang: v as CodeLang })}
                style={{ width: '100%' }}
              />
            </Field>
            <Field label="标签（逗号分隔）">
              <Input value={tagsText} onChange={(e) => setTagsText(e.target.value)} placeholder="例如：柱状图, 销售" />
            </Field>
          </div>
          <Field label="代码">
            <Textarea
              style={{ minHeight: 280, fontFamily: 'monospace', fontSize: 12.5 }}
              value={editing.code}
              onChange={(e) => setEditing({ ...editing, code: e.target.value })}
            />
          </Field>
          <div className="fp-toolbar" style={{ marginTop: 10, justifyContent: 'flex-end' }}>
            {editing.id && (
              <Popconfirm title={`确定删除片段「${editing.name}」？`} onConfirm={() => remove(editing)}>
                <Button>删除</Button>
              </Popconfirm>
            )}
            <Button type="primary" loading={saving} onClick={save}>{saving ? '保存中…' : '保存'}</Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
