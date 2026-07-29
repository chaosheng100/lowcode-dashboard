import { useMemo, useState } from "react"
import { Alert, App, Button, Dropdown, Input, Select, Switch, Table, type MenuProps, type TableProps } from "antd"
import { PlusOutlined, SearchOutlined } from "@ant-design/icons"
import { api } from "../mock"
import type { ReportDTO, ReportStatus } from "../mock/types"
import { useApi } from "./useApi"
import ReportDesignPage from "./ReportDesignPage"
import { useDesignerStore } from "../data/store/useDesignerStore"
import { openPreviewWindow } from "../designer/window"
import { syncReportToDashboard, unlinkReportFromDashboard } from "./reportWidgetCatalog"
import { Field, Modal } from "./common"

// 后端通用目录服务返回的记录可能缺字段（例如 r-1 测试数据缺 delivery/format/name），
// 这里做防御性归一化，避免列表/编辑/预览渲染时因 undefined 崩溃。
function normalizeReport(r: ReportDTO): ReportDTO {
  return {
    ...r,
    name: r.name ?? "未命名报表",
    sourceId: r.sourceId ?? "",
    sourceName: r.sourceName ?? "",
    format: Array.isArray(r.format) ? r.format : ["xlsx"],
    schedule: r.schedule ?? "手动",
    status: r.status ?? "paused",
    delivery: Array.isArray(r.delivery) ? r.delivery : [],
    lastRunAt: r.lastRunAt ?? "",
    lastRunStatus: r.lastRunStatus ?? "never",
    dashboardId: r.dashboardId ?? "",
    lastSyncAt: r.lastSyncAt ?? "",
    updatedAt: r.updatedAt ?? "",
    design: r.design ?? {
      title: r.name ?? "未命名报表",
      subtitle: "",
      columns: ["字段", "数值"],
      rows: [["示例", "0"]]
    }
  }
}

type View = { mode: "list" } | { mode: "edit" | "preview"; item: ReportDTO }
type StatusFilter = "all" | ReportStatus | "failed"

export default function ReportManagement() {
  const { data, loading, error, reload } = useApi(() => api.listReports({ pageSize: 100 }), [])
  const { modal } = App.useApp()
  const routes = useDesignerStore((s) => s.routes)
  const updateRoute = useDesignerStore((s) => s.updateRoute)
  const dashboards = useMemo(() => routes.filter((r) => r.kind === "dashboard"), [routes])
  const [view, setView] = useState<View>({ mode: "list" })
  const [keyword, setKeyword] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all")
  const [formatFilter, setFormatFilter] = useState("all")
  const [sort, setSort] = useState("updated-desc")
  const [runningId, setRunningId] = useState("")
  const [notice, setNotice] = useState("")
  const [linking, setLinking] = useState<ReportDTO | null>(null)
  const [linkDashboardId, setLinkDashboardId] = useState("")
  const [busyId, setBusyId] = useState("")

  const reports = (data?.list ?? []).map(normalizeReport)
  const filtered = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    return reports
      .filter((r) => !query || [r.name, r.sourceName, r.schedule].some((v) => v.toLowerCase().includes(query)))
      .filter((r) => statusFilter === "all" || (statusFilter === "failed" ? r.lastRunStatus === "failed" : r.status === statusFilter))
      .filter((r) => formatFilter === "all" || r.format.includes(formatFilter))
      .slice()
      .sort((a, b) => {
        if (sort === "name-asc") return a.name.localeCompare(b.name, "zh-CN")
        if (sort === "name-desc") return b.name.localeCompare(a.name, "zh-CN")
        const delta = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
        return sort === "updated-asc" ? delta : -delta
      })
  }, [formatFilter, keyword, reports, sort, statusFilter])

  const save = async (id: string, patch: Partial<ReportDTO>) => {
    const response = await api.saveReport({ id, ...patch })
    if (response.code !== 0) throw new Error(response.message)
    setView((cur) => cur.mode === "list" ? cur : { ...cur, item: normalizeReport(response.data) })
    reload()
  }

  const createReport = async () => {
    const response = await api.saveReport(newReport())
    if (response.code !== 0) { setNotice(response.message); return }
    reload()
    setView({ mode: "edit", item: normalizeReport(response.data) })
  }

  const duplicateReport = async (report: ReportDTO) => {
    const { id: _id, ...copy } = report
    const response = await api.saveReport({ ...copy, name: `${report.name} 副本`, status: "paused", lastRunAt: "", lastRunStatus: "never" })
    if (response.code === 0) { setNotice(`已复制「${report.name}」`); reload() }
  }

  const toggleStatus = async (report: ReportDTO) => {
    const status = report.status === "enabled" ? "paused" : "enabled"
    const response = await api.saveReport({ id: report.id, status })
    if (response.code === 0) { setNotice(status === "enabled" ? "定时任务已启用" : "定时任务已暂停"); reload() }
  }

  const runReport = async (report: ReportDTO) => {
    setRunningId(report.id); setNotice("")
    const response = await api.runReport(report.id)
    setRunningId("")
    if (response.code === 0) { setNotice(`「${report.name}」生成成功`); reload() }
    else setNotice(response.message)
  }

  // 删除确认由 modal.confirm 承载（操作在下拉菜单里，无法包 Popconfirm）；确认后走原级联解绑逻辑
  const deleteReport = (report: ReportDTO) => {
    modal.confirm({
      title: `确定删除「${report.name}」？此操作不可恢复。`,
      okText: "删除",
      okButtonProps: { danger: true },
      cancelText: "取消",
      onOk: async () => {
        if (report.dashboardId) {
          const route = routes.find((r) => r.id === report.dashboardId)
          if (route) updateRoute(route.id, unlinkReportFromDashboard(route, report.id))
        }
        const response = await api.deleteReport(report.id)
        if (response.code === 0) { setNotice("报表已删除"); reload() }
      },
    })
  }

  const syncReport = async (report: ReportDTO, targetId: string) => {
    if (!targetId) return setNotice("请先选择要联动的大屏")
    const route = routes.find((r) => r.id === targetId && r.kind === "dashboard")
    if (!route) return setNotice("目标大屏不存在，请重新绑定")
    setBusyId(report.id)
    const syncedAt = new Date().toISOString()
    const response = await api.saveReport({ id: report.id, dashboardId: targetId, lastSyncAt: syncedAt })
    if (response.code === 0) {
      updateRoute(route.id, syncReportToDashboard(route, response.data, syncedAt))
      setNotice(`「${report.name}」已同步到「${route.name}」`)
      setLinking(null)
      reload()
    } else setNotice(response.message)
    setBusyId("")
  }

  const unlinkReport = async (report: ReportDTO) => {
    if (!report.dashboardId) return
    setBusyId(report.id)
    const route = routes.find((r) => r.id === report.dashboardId)
    if (route) updateRoute(route.id, unlinkReportFromDashboard(route, report.id))
    await api.saveReport({ id: report.id, dashboardId: "" as any, lastSyncAt: "" })
    setBusyId("")
    setNotice("已解除大屏绑定")
    reload()
  }

  // 「更多」下拉菜单项（随是否绑定大屏动态拼接）
  const moreMenu = (report: ReportDTO): MenuProps["items"] => [
    { key: "duplicate", label: "复制报表" },
    report.dashboardId ? { key: "resync", label: "重新同步" } : { key: "bind", label: "绑定大屏" },
    ...(report.dashboardId
      ? [
          { key: "open", label: "打开大屏" },
          { key: "rebind", label: "更换大屏" },
          { key: "unlink", label: "解除绑定" },
        ]
      : []),
    { key: "delete", label: "删除报表", danger: true },
  ]

  const onMoreClick = (report: ReportDTO, key: string) => {
    if (key === "duplicate") duplicateReport(report)
    if (key === "resync") syncReport(report, report.dashboardId!)
    if (key === "bind") { setLinkDashboardId(dashboards[0]?.id ?? ""); setLinking(report) }
    if (key === "open") openPreviewWindow(report.dashboardId!)
    if (key === "rebind") { setLinkDashboardId(report.dashboardId!); setLinking(report) }
    if (key === "unlink") unlinkReport(report)
    if (key === "delete") deleteReport(report)
  }

  // 表格列：名称/绑定大屏为链接按钮，状态为开关，操作含「更多」下拉
  const columns: TableProps<ReportDTO>["columns"] = [
    {
      title: "报表名称",
      dataIndex: "name",
      key: "name",
      render: (_, report) => (
        <>
          <Button type="link" size="small" style={{ padding: 0, height: "auto" }} onClick={() => setView({ mode: "edit", item: report })}>
            {report.name}
          </Button>
          <small className="muted" style={{ display: "block" }}>
            {report.delivery.length ? `投递至 ${report.delivery.join(" / ")}` : "不自动投递"}
          </small>
        </>
      ),
    },
    {
      title: "数据源",
      dataIndex: "sourceName",
      key: "sourceName",
      render: (v: string) => v || <span className="muted">手动维护</span>,
    },
    { title: "调度", dataIndex: "schedule", key: "schedule" },
    {
      title: "格式",
      dataIndex: "format",
      key: "format",
      render: (formats: string[]) => (
        <div className="report-formats">{formats.map((f) => <span key={f}>{f === "xlsx" ? "Excel" : f.toUpperCase()}</span>)}</div>
      ),
    },
    {
      title: "状态",
      dataIndex: "status",
      key: "status",
      render: (_, report) => (
        <Switch
          size="small"
          checked={report.status === "enabled"}
          checkedChildren="已启用"
          unCheckedChildren="已暂停"
          aria-label={`${report.name} 当前${report.status === "enabled" ? "已启用" : "已暂停"}，点击切换`}
          onChange={() => toggleStatus(report)}
        />
      ),
    },
    { title: "运行", key: "run", render: (_, report) => <RunStatus report={report} /> },
    {
      title: "绑定大屏",
      dataIndex: "dashboardId",
      key: "dashboardId",
      render: (_, report) => {
        const bound = report.dashboardId ? dashboards.find((d) => d.id === report.dashboardId) : null
        return bound ? (
          <Button type="link" size="small" style={{ padding: 0, height: "auto" }} onClick={() => openPreviewWindow(bound.id)}>
            {bound.name}
          </Button>
        ) : (
          <span className="muted">未绑定</span>
        )
      },
    },
    { title: "更新时间", dataIndex: "updatedAt", key: "updatedAt", render: (v: string) => <span className="muted">{v}</span> },
    {
      title: "操作",
      key: "action",
      render: (_, report) => (
        <div className="report-row-actions">
          <Button size="small" onClick={() => setView({ mode: "preview", item: report })}>预览</Button>
          <Button size="small" onClick={() => setView({ mode: "edit", item: report })}>编辑</Button>
          <Button size="small" disabled={runningId === report.id} onClick={() => runReport(report)}>
            {runningId === report.id ? "生成中" : "立即生成"}
          </Button>
          <Dropdown menu={{ items: moreMenu(report), onClick: ({ key }) => onMoreClick(report, key) }} trigger={["click"]}>
            <Button size="small">更多</Button>
          </Dropdown>
        </div>
      ),
    },
  ]

  if (view.mode === "edit") {
    return (
      <div className="report-fullscreen">
        <div className="report-backbar">
          <Button onClick={() => { reload(); setView({ mode: "list" }) }}>返回列表</Button>
          <span>{view.item.name}</span>
          <Button onClick={() => setView({ mode: "preview", item: view.item })}>预览</Button>
        </div>
        <ReportDesignPage item={view.item} save={(patch) => save(view.item.id, patch)} />
      </div>
    )
  }

  if (view.mode === "preview") {
    return (
      <div className="report-fullscreen">
        <div className="report-backbar">
          <Button onClick={() => setView({ mode: "list" })}>返回列表</Button>
          <span>{view.item.name}</span>
          <Button type="primary" onClick={() => setView({ mode: "edit", item: view.item })}>编辑报表</Button>
        </div>
        <ReportPreview item={view.item} />
      </div>
    )
  }

  const enabledCount = reports.filter((r) => r.status === "enabled").length
  const scheduledCount = reports.filter((r) => r.schedule !== "手动").length
  const failedCount = reports.filter((r) => r.lastRunStatus === "failed").length
  const linkedCount = reports.filter((r) => !!r.dashboardId).length

  return (
    <div className="report-page">
      <header className="report-head">
        <div>
          <h1 className="fp-title">报表管理</h1>
          <p className="fp-sub">配置与调度报表，绑定大屏实现报表组件嵌入</p>
        </div>
        <div className="report-head-actions">
          <Button type="primary" icon={<PlusOutlined />} onClick={createReport}>新建报表</Button>
        </div>
      </header>

      <section className="report-summary" aria-label="报表概览">
        <div><strong>{reports.length}</strong><span>全部报表</span></div>
        <div><strong>{enabledCount}</strong><span>已启用</span></div>
        <div><strong>{scheduledCount}</strong><span>定时调度</span></div>
        <div><strong>{failedCount}</strong><span>执行失败</span></div>
        <div><strong>{linkedCount}</strong><span>已绑定大屏</span></div>
      </section>

      {notice && <Alert style={{ margin: "12px 12px 0" }} showIcon closable message={notice} onClose={() => setNotice("")} />}

      <div className="report-toolbar">
        <Input
          style={{ width: "min(320px, 100%)" }}
          placeholder="按名称 / 数据源 / 调度搜索…"
          prefix={<SearchOutlined />}
          allowClear
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
        />
        <Select<StatusFilter>
          style={{ minWidth: 120 }}
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: "all", label: "全部状态" },
            { value: "enabled", label: "已启用" },
            { value: "paused", label: "已暂停" },
            { value: "failed", label: "执行失败" },
          ]}
        />
        <Select
          style={{ minWidth: 110 }}
          value={formatFilter}
          onChange={setFormatFilter}
          options={[
            { value: "all", label: "全部格式" },
            { value: "xlsx", label: "Excel" },
            { value: "pdf", label: "PDF" },
            { value: "csv", label: "CSV" },
            { value: "html", label: "HTML" },
          ]}
        />
        <Select
          style={{ minWidth: 120 }}
          value={sort}
          onChange={setSort}
          options={[
            { value: "updated-desc", label: "最近更新" },
            { value: "updated-asc", label: "最早更新" },
            { value: "name-asc", label: "名称 A-Z" },
            { value: "name-desc", label: "名称 Z-A" },
          ]}
        />
      </div>

      <section className="report-table-wrap">
        {error && <Alert type="error" showIcon message={`加载失败：${error}`} style={{ margin: 12 }} />}
        {!error && (
          <div className="report-table-scroll">
            <Table<ReportDTO>
              columns={columns}
              dataSource={filtered}
              rowKey="id"
              size="small"
              loading={loading}
              pagination={false}
              locale={{
                emptyText: (
                  <div className="report-empty">
                    <strong>没有匹配的报表</strong>
                    <span>调整筛选条件，或新建一张报表。</span>
                    <Button onClick={() => { setKeyword(""); setStatusFilter("all"); setFormatFilter("all") }}>清除筛选</Button>
                  </div>
                ),
              }}
            />
          </div>
        )}
      </section>

      {/* 联动大屏弹窗：Esc/遮罩关闭由 antd Modal 托管（同步中禁止关闭） */}
      {linking && (
        <Modal title="联动可视化大屏" onClose={() => { if (!busyId) setLinking(null) }}>
          <p style={{ marginTop: 0, color: "var(--sub)" }}>{linking.name}</p>
          <Field label="目标大屏">
            <Select
              style={{ width: "100%" }}
              value={linkDashboardId || undefined}
              placeholder={dashboards.length ? "请选择大屏" : "暂无可用大屏"}
              onChange={setLinkDashboardId}
              options={dashboards.map((d) => ({ value: d.id, label: d.name }))}
            />
          </Field>
          <p style={{ color: "var(--sub)", fontSize: 12, lineHeight: 1.6 }}>
            同步后，大屏将获得报表摘要与数据表格组件。再次同步会更新原组件，不会重复创建。
          </p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
            <Button disabled={Boolean(busyId)} onClick={() => setLinking(null)}>取消</Button>
            <Button type="primary" loading={Boolean(busyId)} disabled={!linkDashboardId} onClick={() => syncReport(linking, linkDashboardId)}>
              {busyId ? "同步中…" : "绑定并同步"}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}

function RunStatus({ report }: { report: ReportDTO }) {
  if (report.lastRunStatus === "never") return <span className="report-run never">尚未运行</span>
  return <span className={`report-run ${report.lastRunStatus}`}><i />{report.lastRunStatus === "success" ? "成功" : "失败"}<small>{formatTime(report.lastRunAt)}</small></span>
}

function ReportPreview({ item }: { item: ReportDTO }) {
  const summary = item.design.columns.map((_, ci) => {
    const values = item.design.rows.map((r) => r[ci]).filter((v) => v && Number.isFinite(Number(v))).map(Number)
    return values.length ? String(values.reduce((s, v) => s + v, 0)) : ""
  })
  return (
    <div className="report-preview-shell">
      <article className="report-paper">
        <header><h1>{item.design.title || item.name}</h1><p>{item.design.subtitle}</p></header>
        <div className="report-preview-meta"><span>数据集：{item.sourceName || "手动数据"}</span><span>更新日期：{item.updatedAt}</span></div>
        <div className="report-preview-table"><table><thead><tr>{item.design.columns.map((c) => <th key={c}>{c}</th>)}</tr></thead><tbody>{item.design.rows.map((row, ri) => <tr key={ri}>{row.map((cell, ci) => <td key={ci} className={Number.isFinite(Number(cell)) && cell !== "" ? "numeric" : ""}>{cell || "-"}</td>)}</tr>)}</tbody>{summary.some(Boolean) && <tfoot><tr>{summary.map((v, i) => <td key={i}>{i === 0 ? "合计" : v}</td>)}</tr></tfoot>}</table></div>
        <footer>由低代码数据平台生成</footer>
      </article>
    </div>
  )
}

function newReport(): Partial<ReportDTO> {
  return {
    name: "未命名报表", sourceId: "", sourceName: "", format: ["xlsx"], schedule: "手动", status: "paused", delivery: [], lastRunAt: "", lastRunStatus: "never",
    design: { title: "未命名报表", subtitle: new Date().toLocaleDateString("zh-CN"), columns: ["字段", "数值"], rows: [["示例", "0"]] }
  }
}

function formatTime(value: string) {
  if (!value) return ""
  return new Intl.DateTimeFormat("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value))
}
