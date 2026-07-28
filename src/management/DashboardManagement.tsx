import { useMemo, useState } from 'react'
import { useDesignerStore } from '../data/store/useDesignerStore'
import type { RouteConfig } from '../data/types'
import './DashboardManagement.css'

interface Props {
  /** 点击列表项在新页签打开对应大屏编辑器 */
  onOpen: (routeId: string) => void
  /** 在新页签打开对应大屏预览 */
  onOpenPreview?: (routeId: string) => void
}

type SortKey = 'createdAt' | 'updatedAt'

function fmt(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

// 基于 seed 生成确定性的迷你柱状图，作为缩略图上的「数据感」装饰
function MiniChart({ seed }: { seed: string }) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const bars = Array.from({ length: 7 }, (_, i) => 20 + ((h >> (i * 2)) % 60))
  const max = Math.max(...bars)
  return (
    <svg className="mg-mini" viewBox="0 0 140 60" preserveAspectRatio="none" aria-hidden>
      {bars.map((b, i) => (
        <rect
          key={i}
          x={6 + i * 19}
          y={58 - (b / max) * 48}
          width={12}
          height={(b / max) * 48}
          rx={2}
          fill="rgba(120,180,255,0.85)"
        />
      ))}
    </svg>
  )
}

export default function DashboardManagement({ onOpen, onOpenPreview }: Props) {
  const routes = useDesignerStore((s) => s.routes)
  const createDashboard = useDesignerStore((s) => s.createDashboard)
  const deleteDashboard = useDesignerStore((s) => s.deleteDashboard)
  const renameDashboard = useDesignerStore((s) => s.renameDashboard)

  const [kw, setKw] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('updatedAt')
  const [desc, setDesc] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  const startRename = (d: RouteConfig) => {
    setEditId(d.id)
    setEditName(d.name)
  }
  const commitRename = () => {
    if (editId && editName.trim()) renameDashboard(editId, editName.trim())
    setEditId(null)
  }

  const dashboards = useMemo<RouteConfig[]>(() => {
    const list = routes.filter((r) => r.kind === 'dashboard')
    const q = kw.trim().toLowerCase()
    const filtered = q ? list.filter((r) => r.name.toLowerCase().includes(q)) : list
    return filtered.sort((a, b) => {
      const av = new Date(a[sortKey]).getTime()
      const bv = new Date(b[sortKey]).getTime()
      return desc ? bv - av : av - bv
    })
  }, [routes, kw, sortKey, desc])

  return (
    <div className="mg">
      <div className="mg-toolbar">
        <div className="mg-title">大屏管理</div>
        <input
          className="mg-search"
          placeholder="按名称搜索…"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
        />
        <label className="mg-sort-label">排序</label>
        <select
          className="mg-select"
          value={sortKey}
          onChange={(e) => setSortKey(e.target.value as SortKey)}
        >
          <option value="createdAt">创建时间</option>
          <option value="updatedAt">更新时间</option>
        </select>
        <button className="btn mg-order" title="切换升序/降序" onClick={() => setDesc((v) => !v)}>
          {desc ? '↓ 倒序' : '↑ 升序'}
        </button>
        <button
          className="btn mg-new"
          onClick={() => {
            const id = createDashboard()
            onOpen(id)
          }}
        >
          ＋ 新建大屏
        </button>
      </div>

      <div className="mg-grid">
        {dashboards.map((d) => (
          <div className="mg-card" key={d.id} onClick={() => onOpen(d.id)}>
            <div
              className="mg-thumb"
              style={
                d.thumbnail?.startsWith('data:')
                  ? { backgroundImage: `url("${d.thumbnail}")`, backgroundSize: 'cover', backgroundPosition: 'center' }
                  : { background: d.thumbnail || '#10243b' }
              }
            >
              <MiniChart seed={d.id} />
              <span className="mg-badge">大屏</span>
            </div>
            <div className="mg-info">
              {editId === d.id ? (
                <input
                  className="mg-rename-inp"
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') commitRename()
                    if (e.key === 'Escape') setEditId(null)
                  }}
                  onBlur={commitRename}
                />
              ) : (
                <div className="mg-name" title={d.name}>
                  {d.name}
                </div>
              )}
              <div className="mg-meta">创建：{fmt(d.createdAt)}</div>
              <div className="mg-meta">更新：{fmt(d.updatedAt)}</div>
              <div className="mg-open-row">
                <span className="mg-open" onClick={(e) => { e.stopPropagation(); onOpen(d.id) }}>
                  进入编辑器 →
                </span>
                {onOpenPreview && (
                  <span
                    className="mg-preview"
                    onClick={(e) => { e.stopPropagation(); onOpenPreview(d.id) }}
                  >
                    在新页签预览
                  </span>
                )}
                <span
                  className="mg-rename"
                  title="重命名"
                  onClick={(e) => { e.stopPropagation(); startRename(d) }}
                >
                  重命名
                </span>
                <span
                  className="mg-del"
                  title="删除大屏"
                  onClick={(e) => {
                    e.stopPropagation()
                    if (window.confirm(`确定删除大屏「${d.name}」？此操作不可恢复。`)) deleteDashboard(d.id)
                  }}
                >
                  删除
                </span>
              </div>
            </div>
          </div>
        ))}
        {!dashboards.length && <div className="empty-tip">没有匹配的大屏</div>}
      </div>
    </div>
  )
}
