import { useMemo, useState } from "react"
import { Button, Empty, Input, Popconfirm, Select } from "antd"
import { PlusOutlined, SearchOutlined, SortAscendingOutlined, SortDescendingOutlined } from "@ant-design/icons"
import { useDesignerStore } from "../data/store/useDesignerStore"
import { api } from "../mock"
import type { RouteConfig } from "../data/types"
import "./DashboardManagement.css"

interface Props {
  onOpen: (routeId: string) => void
  onOpenPreview?: (routeId: string) => void
}

type SortKey = "createdAt" | "updatedAt"

function fmt(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, "0")
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function linkedTwinCount(route: RouteConfig): number {
  const scenes = route.state.twinScenes
  return scenes && typeof scenes === "object" && !Array.isArray(scenes) ? Object.keys(scenes).length : 0
}

function linkedIoTCount(route: RouteConfig): number {
  return Array.isArray(route.state.iotBindings) ? route.state.iotBindings.length : 0
}

function linkedReportCount(route: RouteConfig): number {
  const reports = route.state.reportIds
  return reports && typeof reports === "object" && !Array.isArray(reports) ? Object.keys(reports).length : 0
}

function linkedCarouselCount(route: RouteConfig): number {
  return Array.isArray(route.state.carouselIds) ? route.state.carouselIds.length : 0
}

function isDeployed(route: RouteConfig): boolean {
  return Boolean(route.state.deployInfo)
}

function MiniChart({ seed }: { seed: string }) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  const bars = Array.from({ length: 7 }, (_, i) => 20 + ((h >> (i * 2)) % 60))
  const max = Math.max(...bars)
  return (
    <svg className="mg-mini" viewBox="0 0 140 60" preserveAspectRatio="none" aria-hidden>
      {bars.map((b, i) => (
        <rect key={i} x={6 + i * 19} y={58 - (b / max) * 48} width={12} height={(b / max) * 48} rx={2} fill="rgba(120,180,255,0.85)" />
      ))}
    </svg>
  )
}

export default function DashboardManagement({ onOpen, onOpenPreview }: Props) {
  const routes = useDesignerStore((s) => s.routes)
  const createDashboard = useDesignerStore((s) => s.createDashboard)
  const deleteDashboard = useDesignerStore((s) => s.deleteDashboard)
  const renameDashboard = useDesignerStore((s) => s.renameDashboard)

  const [kw, setKw] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt")
  const [desc, setDesc] = useState(true)
  const [editId, setEditId] = useState<string | null>(null)
  const [editName, setEditName] = useState("")

  const startRename = (d: RouteConfig) => {
    setEditId(d.id)
    setEditName(d.name)
  }
  const commitRename = () => {
    if (editId && editName.trim()) renameDashboard(editId, editName.trim())
    setEditId(null)
  }

  // Cascade cleanup: when deleting a dashboard, clean up carousels/twin-scenes/reports that reference it
  // （删除确认由 Popconfirm 接管，onConfirm 后才进这里）
  const handleDelete = async (d: RouteConfig) => {
    // Clean up carousels
    try {
      const clResp = await api.listCarousels({ pageSize: 100 })
      if (clResp.code === 0) {
        for (const cl of clResp.data.list) {
          if (cl.slides.includes(d.id)) {
            await api.saveCarousel({ id: cl.id, slides: cl.slides.filter((s) => s !== d.id) })
          }
        }
      }
    } catch { /* best-effort */ }
    // Clean up twin scenes
    try {
      const tsResp = await api.listTwinScenes({ pageSize: 100 })
      if (tsResp.code === 0) {
        for (const ts of tsResp.data.list) {
          if (ts.dashboardId === d.id) await api.saveTwinScene({ id: ts.id, dashboardId: "" as any, lastSyncAt: "" })
        }
      }
    } catch { /* best-effort */ }
    // Clean up reports
    try {
      const rpResp = await api.listReports({ pageSize: 100 })
      if (rpResp.code === 0) {
        for (const rp of rpResp.data.list) {
          if (rp.dashboardId === d.id) await api.saveReport({ id: rp.id, dashboardId: "" as any, lastSyncAt: "" })
        }
      }
    } catch { /* best-effort */ }
    deleteDashboard(d.id)
  }

  const dashboards = useMemo<RouteConfig[]>(() => {
    const list = routes.filter((r) => r.kind === "dashboard")
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
        <Input
          style={{ marginLeft: "auto", width: 240 }}
          prefix={<SearchOutlined />}
          allowClear
          placeholder="按名称搜索…"
          value={kw}
          onChange={(e) => setKw(e.target.value)}
        />
        <label className="mg-sort-label">排序</label>
        <Select
          style={{ width: 120 }}
          value={sortKey}
          options={[
            { value: "createdAt", label: "创建时间" },
            { value: "updatedAt", label: "更新时间" },
          ]}
          onChange={(v) => setSortKey(v as SortKey)}
        />
        <Button
          icon={desc ? <SortDescendingOutlined /> : <SortAscendingOutlined />}
          title="切换升序/降序"
          onClick={() => setDesc((v) => !v)}
        >
          {desc ? "倒序" : "升序"}
        </Button>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => { const id = createDashboard(); onOpen(id) }}>新建大屏</Button>
      </div>

      <div className="mg-grid">
        {dashboards.map((d) => (
          <div className="mg-card" key={d.id} onClick={() => onOpen(d.id)}>
            <div className="mg-thumb" style={d.thumbnail?.startsWith("data:")
              ? { backgroundImage: `url("${d.thumbnail}")`, backgroundSize: "cover", backgroundPosition: "center" }
              : { background: d.thumbnail || "#10243b" }}>
              <MiniChart seed={d.id} />
              <span className="mg-badge" style={isDeployed(d) ? { background: "#16a34a", color: "#fff" } : undefined}>
                {isDeployed(d) ? "已部署" : "大屏"}
              </span>
            </div>
            <div className="mg-info">
              {editId === d.id ? (
                <Input size="small" autoFocus value={editName} onChange={(e) => setEditName(e.target.value)}
                  onClick={(e) => e.stopPropagation()} onKeyDown={(e) => {
                    if (e.key === "Enter") commitRename()
                    if (e.key === "Escape") setEditId(null)
                  }} onBlur={commitRename} />
              ) : (
                <div className="mg-name" title={d.name}>{d.name}</div>
              )}
              <div className="mg-meta">创建：{fmt(d.createdAt)}</div>
              <div className="mg-meta">更新：{fmt(d.updatedAt)}</div>
              <div className="mg-link-stats" aria-label={`${d.name}联动统计`}>
                <span><strong>{d.components.length}</strong> 总组件</span>
                <span><strong>{d.components.filter((c) => c.props.catalogKey).length}</strong> 资产</span>
                <span><strong>{linkedTwinCount(d)}</strong> 孪生</span>
                <span><strong>{linkedIoTCount(d)}</strong> 物联</span>
                <span><strong>{linkedReportCount(d)}</strong> 报表</span>
                <span><strong>{linkedCarouselCount(d)}</strong> 轮播</span>
              </div>
              <div className="mg-open-row">
                <Button size="small" type="link" onClick={(e) => { e.stopPropagation(); onOpen(d.id) }}>进入编辑器</Button>
                {onOpenPreview && (
                  <Button size="small" type="link" onClick={(e) => { e.stopPropagation(); onOpenPreview(d.id) }}>预览</Button>
                )}
                <Button size="small" type="link" title="重命名" onClick={(e) => { e.stopPropagation(); startRename(d) }}>重命名</Button>
                <Popconfirm
                  title="删除大屏"
                  description={`确定删除大屏「${d.name}」？此操作不可恢复。`}
                  okText="删除"
                  cancelText="取消"
                  okButtonProps={{ danger: true }}
                  onConfirm={() => handleDelete(d)}
                >
                  <Button size="small" type="link" danger title="删除大屏" style={{ marginLeft: "auto" }}
                    onClick={(e) => e.stopPropagation()}>删除</Button>
                </Popconfirm>
              </div>
            </div>
          </div>
        ))}
        {!dashboards.length && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的大屏" style={{ gridColumn: "1 / -1" }} />
        )}
      </div>
    </div>
  )
}
