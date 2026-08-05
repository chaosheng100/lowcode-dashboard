import { useMemo, useState, type ReactNode } from 'react'
import { Alert, Button, Input, Popconfirm, Spin } from 'antd'
import { DeleteOutlined, EditOutlined, EyeOutlined, FormOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useApi } from './useApi'
import type { ApiResp, PageResult } from '../mock/types'

/** 通用插件管理项（至少有 id + name） */
export interface PluginItem {
  id: string
  name: string
  updatedAt?: string
}

interface Props<T extends PluginItem> {
  title: string
  subtitle: string
  countLabel: string
  fetcher: () => Promise<ApiResp<PageResult<T>>>
  saveItem: (body: Partial<T>) => Promise<ApiResp<T>>
  deleteItem: (id: string) => Promise<ApiResp<{ ok: boolean }>>
  blankItem: () => T
  /** 缩略图内容（ReactNode），默认深色占位 */
  renderThumb?: (item: T) => ReactNode
  /** 卡片副信息行 */
  renderMeta?: (item: T) => string[]
  /** 卡片标签区 */
  renderTags?: (item: T) => ReactNode
  /** 编辑视图（全屏）；save(patch) 用于持久化字段并刷新列表。不提供则提示无独立编辑器 */
  renderEditor?: (item: T, save: (patch: Partial<T>) => Promise<void>) => ReactNode
  /** 预览视图（全屏）；不提供则提示无独立预览 */
  renderPreview?: (item: T) => ReactNode
  /** 卡片自定义操作区（在"进入编辑器/预览/重命名/删除"之前插入） */
  renderActions?: (item: T) => ReactNode
}

type View<T> =
  | { mode: 'list' }
  | { mode: 'edit'; item: T }
  | { mode: 'preview'; item: T }

/**
 * 通用插件管理页 —— 对齐「大屏管理」的列表 + 预览/编辑模式。
 * 卡片网格 + 搜索/排序/新建 + 进入编辑器/预览/重命名/删除；
 * 编辑/预览切换为全屏视图，左上角浮动返回按钮。
 */
export default function PluginManagement<T extends PluginItem>({
  title, subtitle, countLabel, fetcher, saveItem, deleteItem, blankItem,
  renderThumb, renderMeta, renderTags, renderEditor, renderPreview, renderActions
}: Props<T>) {
  const { data, loading, error, reload } = useApi(() => fetcher(), [])
  const [view, setView] = useState<View<T>>({ mode: 'list' })
  const [kw, setKw] = useState('')
  const [desc, setDesc] = useState(true)
  const [renameId, setRenameId] = useState<string | null>(null)
  const [renameText, setRenameText] = useState('')
  const [creating, setCreating] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  const items = useMemo(() => {
    const list = (data?.list ?? []) as T[]
    const q = kw.trim().toLowerCase()
    const filtered = q ? list.filter((it) => it.name.toLowerCase().includes(q)) : list
    return filtered.sort((a, b) => {
      const av = new Date(a.updatedAt ?? 0).getTime()
      const bv = new Date(b.updatedAt ?? 0).getTime()
      return desc ? bv - av : av - bv
    })
  }, [data, kw, desc])

  const doNew = async () => {
    if (creating) return
    setCreating(true)
    try {
      const r = await saveItem(blankItem())
      if (r.code === 0) {
        reload()
        setView({ mode: 'edit', item: r.data })
      }
    } finally {
      setCreating(false)
    }
  }
  const doRename = async (it: T, name: string) => {
    if (name.trim()) await saveItem({ ...(it as object), name: name.trim() } as Partial<T>)
    setRenameId(null)
    reload()
  }
  // 删除确认由 Popconfirm 承载，这里只做删除与刷新
  const doDelete = async (it: T) => {
    setDeletingId(it.id)
    try {
      await deleteItem(it.id)
      reload()
    } finally {
      setDeletingId(null)
    }
  }

  // —— 编辑/预览全屏视图 ——
  if (view.mode === 'edit') {
    const save = async (patch: Partial<T>) => {
      await saveItem({ id: view.item.id, ...patch } as Partial<T>)
      reload()
    }
    return (
      <div className="pm-fullscreen">
        <div className="pm-bar">
          <Button onClick={() => { reload(); setView({ mode: 'list' }) }}>← 返回列表</Button>
          <span className="pm-title">{title} · 编辑 · {view.item.name}</span>
        </div>
        <div className="pm-body">
          {renderEditor ? renderEditor(view.item, save) : <div className="empty-tip">该模块暂无独立编辑器</div>}
        </div>
      </div>
    )
  }
  if (view.mode === 'preview') {
    return (
      <div className="pm-fullscreen">
        <div className="pm-bar">
          <Button onClick={() => setView({ mode: 'list' })}>← 返回列表</Button>
          <span className="pm-title">{title} · 预览 · {view.item.name}</span>
        </div>
        <div className="pm-body">
          {renderPreview ? renderPreview(view.item) : <div className="empty-tip">该模块暂无独立预览</div>}
        </div>
      </div>
    )
  }

  // —— 列表视图 ——
  return (
    <div className="mg">
      <div className="mg-toolbar">
        <div className="mg-title">{title}</div>
        {/* marginLeft:auto 顶替旧 .mg-search 的右推布局 */}
        <Input
          style={{ marginLeft: 'auto', width: 240 }}
          placeholder="按名称搜索…"
          prefix={<SearchOutlined />}
          allowClear
          value={kw}
          onChange={(e) => setKw(e.target.value)}
        />
        <Button title="切换升序/降序" onClick={() => setDesc((v) => !v)}>
          {desc ? '↓ 倒序' : '↑ 升序'}
        </Button>
        <Button type="primary" icon={<PlusOutlined />} loading={creating} onClick={doNew}>新建{countLabel}</Button>
      </div>
      <p className="fp-sub" style={{ padding: '4px 16px 0' }}>{subtitle}</p>
      {loading && <div style={{ textAlign: 'center', padding: '40px 0' }}><Spin /></div>}
      {error && <Alert type="error" showIcon message={error} style={{ margin: '12px 16px 0' }} />}
      {!loading && !error && (
        <div className="mg-grid">
          {items.map((it) => (
            <div className="mg-card" key={it.id} onClick={() => setView({ mode: 'edit', item: it })}>
              <div className="mg-thumb">
                {renderThumb?.(it) ?? <span className="mg-badge">{countLabel}</span>}
              </div>
              <div className="mg-info">
                {renameId === it.id ? (
                  <div onClick={(e) => e.stopPropagation()}>
                    <Input
                      size="small"
                      autoFocus
                      value={renameText}
                      onChange={(e) => setRenameText(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') doRename(it, renameText)
                        if (e.key === 'Escape') setRenameId(null)
                      }}
                      onBlur={() => doRename(it, renameText)}
                    />
                  </div>
                ) : (
                  <div className="mg-name" title={it.name}>{it.name}</div>
                )}
                {(renderMeta?.(it) ?? []).map((m, i) => (
                  <div className="mg-meta" key={i}>{m}</div>
                ))}
                {renderTags?.(it)}
                <div className="mg-open-row">
                  {renderActions?.(it)}
                  <Button
                    size="small"
                    type="link"
                    icon={<EditOutlined />}
                    onClick={(e) => { e.stopPropagation(); setView({ mode: 'edit', item: it }) }}
                  >
                    进入编辑器
                  </Button>
                  <Button
                    size="small"
                    type="link"
                    icon={<EyeOutlined />}
                    onClick={(e) => { e.stopPropagation(); setView({ mode: 'preview', item: it }) }}
                  >
                    预览
                  </Button>
                  <Button
                    size="small"
                    type="link"
                    icon={<FormOutlined />}
                    onClick={(e) => { e.stopPropagation(); setRenameId(it.id); setRenameText(it.name) }}
                  >
                    重命名
                  </Button>
                  <Popconfirm
                    title={`确定删除「${it.name}」？此操作不可恢复。`}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    getPopupContainer={() => document.body}
                    onConfirm={() => doDelete(it)}
                  >
                    <span className="mg-del-wrap" onClick={(e) => e.stopPropagation()}>
                      <Button size="small" type="link" danger icon={<DeleteOutlined />} loading={deletingId === it.id}>删除</Button>
                    </span>
                  </Popconfirm>
                </div>
              </div>
            </div>
          ))}
          {!items.length && <div className="empty-tip">暂无{countLabel}</div>}
        </div>
      )}
    </div>
  )
}
