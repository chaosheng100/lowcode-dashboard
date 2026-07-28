import { useState } from 'react'
import { useApi } from './useApi'
import { api } from '../mock'
import { Modal, Tag } from './common'
import type { CodeSnippetDTO, CodeLang } from '../mock/types'

const LANG_LABEL: Record<CodeLang, string> = { vue: 'Vue', html: 'HTML', ts: 'TypeScript', js: 'JavaScript', sql: 'SQL' }

/** 代码仓库：源码组件 / Vue / HTML / SQL 片段，可封装为画布自定义组件 */
export default function CodeRepoPage() {
  const { data, loading, error } = useApi(() => api.listSnippets({ pageSize: 50 }), [])
  const [open, setOpen] = useState<CodeSnippetDTO | null>(null)

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
        <div className="grid3">
          {(data?.list ?? []).map((s) => (
            <div key={s.id} className="card">
              <div className="flex" style={{ justifyContent: 'space-between' }}>
                <b style={{ color: '#e6edf3' }}>{s.name}</b><Tag>{LANG_LABEL[s.lang]}</Tag>
              </div>
              <div className="flex" style={{ margin: '8px 0' }}>{s.tags.map((t) => <Tag key={t}>{t}</Tag>)}</div>
              <div className="muted2" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.code.split('\n')[0]}</div>
              <div className="fp-toolbar" style={{ marginTop: 8 }}><button className="btn sm" onClick={() => setOpen(s)}>查看 / 编辑</button></div>
            </div>
          ))}
        </div>
      )}
      {open && (
        <Modal title={open.name} onClose={() => setOpen(null)} width={680}>
          <div className="flex" style={{ marginBottom: 10 }}>
            <Tag>{LANG_LABEL[open.lang]}</Tag>{open.tags.map((t) => <Tag key={t}>{t}</Tag>)}
          </div>
          <pre style={{ background: '#0b111b', padding: 14, borderRadius: 8, fontSize: 12.5, color: '#9ec1ff', overflow: 'auto', maxHeight: 360, margin: 0 }}>{open.code}</pre>
        </Modal>
      )}
    </div>
  )
}
