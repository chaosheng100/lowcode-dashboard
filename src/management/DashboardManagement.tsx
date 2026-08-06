import { useMemo, useState } from "react"
import { App, Button, Empty, Input, Modal, Popconfirm, Select } from "antd"
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
  const { message } = App.useApp()
  const routes = useDesignerStore((s) => s.routes)
  const createDashboard = useDesignerStore((s) => s.createDashboard)
  const deleteDashboard = useDesignerStore((s) => s.deleteDashboard)
  const renameDashboard = useDesignerStore((s) => s.renameDashboard)

  const [kw, setKw] = useState("")
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt")
  const [desc, setDesc] = useState(true)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  // 新增 / 重命名共用一个命名弹窗，统一走二次确认
  const [modalOpen, setModalOpen] = useState(false)
  const [modalName, setModalName] = useState("")
  const [renameTargetId, setRenameTargetId] = useState<string | null>(null)

  const openCreateModal = () => {
    setRenameTargetId(null)
    setModalName(`新大屏 ${routes.filter((r) => r.kind === "dashboard").length + 1}`)
    setModalOpen(true)
  }
  const openRenameModal = (d: RouteConfig) => {
    setRenameTargetId(d.id)
    setModalName(d.name)
    setModalOpen(true)
  }
  const confirmModal = () => {
    const name = modalName.trim()
    if (!name) {
      message.warning("请输入大屏名称")
      return
    }
    if (renameTargetId) {
      renameDashboard(renameTargetId, name)
      message.success("已重命名")
    } else {
      const id = createDashboard(name)
      onOpen(id)
      message.success("已新建大屏")
    }
    setModalOpen(false)
  }

  // Cascade cleanup: when deleting a dashboard, clean up carousels/twin-scenes/reports that reference it
  // （删除确认由 Popconfirm 接管，onConfirm 后才进这里）
  const handleDelete = async (d: RouteConfig) => {
    setDeletingId(d.id)
    try {
      // 级联清理：把引用了该大屏的轮播/孪生场景/报表的关联置空（best-effort）
      const clResp = await api.listCarousels({ pageSize: 100 })
      if (clResp.code === 0) {
        for (const cl of clResp.data.list) {
          if (cl.slides.includes(d.id)) {
            await api.saveCarousel({ id: cl.id, slides: cl.slides.filter((s) => s !== d.id) })
          }
        }
      }
      const tsResp = await api.listTwinScenes({ pageSize: 100 })
      if (tsResp.code === 0) {
        for (const ts of tsResp.data.list) {
          if (ts.dashboardId === d.id) await api.saveTwinScene({ id: ts.id, dashboardId: "" })
        }
      }
      const rpResp = await api.listReports({ pageSize: 100 })
      if (rpResp.code === 0) {
        for (const rp of rpResp.data.list) {
          if (rp.dashboardId === d.id) await api.saveReport({ id: rp.id, dashboardId: "" })
        }
      }
      deleteDashboard(d.id)
      message.success("已删除大屏")
    } catch {
      message.error("删除失败，请重试")
    } finally {
      setDeletingId(null)
    }
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
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreateModal}>新建大屏</Button>
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
              <div className="mg-name" title={d.name}>{d.name}</div>
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
                <Button size="small" type="link" title="重命名" onClick={(e) => { e.stopPropagation(); openRenameModal(d) }}>重命名</Button>
                <span className="mg-del-wrap" onClick={(e) => e.stopPropagation()}>
                  <Popconfirm
                    title="删除大屏"
                    description={`确定删除大屏「${d.name}」？此操作不可恢复。`}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                    getPopupContainer={() => document.body}
                    onConfirm={() => handleDelete(d)}
                  >
                    <Button size="small" type="link" danger title="删除大屏" style={{ marginLeft: "auto" }}
                      loading={deletingId === d.id}
                      onClick={(e) => e.stopPropagation()}>删除</Button>
                  </Popconfirm>
                </span>
              </div>
            </div>
          </div>
        ))}
        {!dashboards.length && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配的大屏" style={{ gridColumn: "1 / -1" }} />
        )}
      </div>

      <Modal
        title={renameTargetId ? "重命名大屏" : "新建大屏"}
        open={modalOpen}
        onOk={confirmModal}
        onCancel={() => setModalOpen(false)}
        okText="确定"
        cancelText="取消"
        destroyOnHidden
      >
        <Input
          value={modalName}
          onChange={(e) => setModalName(e.target.value)}
          onPressEnter={confirmModal}
          autoFocus
          placeholder="请输入大屏名称"
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  )
}
