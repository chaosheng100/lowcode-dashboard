import type { ComponentInstance, RouteConfig } from "../data/types"
import { mergeManagedComponents, type ComponentAssetDefinition } from "../data/registry/componentAssetRegistry"
import type { ReportDTO } from "../mock/types"

export type ReportWidgetKind = "summary" | "table"

export const reportComponentAssets: Array<ComponentAssetDefinition & { kind: ReportWidgetKind }> = [
  { key: "report:summary", name: "报表摘要", category: "报表", description: "报表标题、数据源与调度状态", type: "text", businessType: "general", kind: "summary" },
  { key: "report:table", name: "报表数据表", category: "报表", description: "报表设计明细表格", type: "table", businessType: "general", kind: "table" }
]

export function reportSource(reportId: string, kind: ReportWidgetKind): string {
  return `report:${reportId}:${kind}`
}

function assetFor(kind: ReportWidgetKind) {
  return reportComponentAssets.find((a) => a.kind === kind)!
}

export function createReportComponent(report: ReportDTO, kind: ReportWidgetKind): ComponentInstance {
  const sourceId = reportSource(report.id, kind)
  const asset = assetFor(kind)
  const sourceProps = {
    catalogKey: asset.key,
    catalogName: asset.name,
    catalogSourceId: sourceId,
    businessType: "general" as const,
    dataSourceId: report.sourceId,
    dataSourceName: report.sourceName
  }
  if (kind === "table") {
    const rows = report.design.rows.map((row) => ({
        name: row[0] ?? "",
        value: Number(row[1]) || 0
      }))
    return {
      id: `report_${report.id}_table`,
      type: "table",
      style: { x: 60, y: 320, w: 860, h: 340 },
      props: { ...sourceProps, title: report.design.title || report.name, data: rows }
    }
  }
  return {
    id: `report_${report.id}_summary`,
    type: "text",
    style: { x: 60, y: 180, w: 800, h: 80 },
    props: {
      ...sourceProps,
      content: `${report.name} | ${report.status === "enabled" ? "已启用" : "已暂停"} | ${report.format.join("/")} | ${report.schedule}`,
      fontSize: 22,
      color: report.status === "enabled" ? "#34c759" : "#ff9500",
      bold: true
    }
  }
}

export function syncReportToDashboard(
  route: RouteConfig,
  report: ReportDTO,
  syncedAt: string,
  kinds: ReportWidgetKind[] = reportComponentAssets.map((a) => a.kind)
): Partial<RouteConfig> {
  const managed = kinds.map((k) => createReportComponent(report, k))
  const previousReports = typeof route.state.reportIds === "object" && route.state.reportIds
    ? route.state.reportIds as Record<string, unknown>
    : {}
  return {
    components: mergeManagedComponents(route.components, managed),
    state: { ...route.state, reportIds: { ...previousReports, [report.id]: { reportId: report.id, reportName: report.name, syncedAt } } },
    updatedAt: syncedAt
  }
}

export function unlinkReportFromDashboard(route: RouteConfig, reportId: string): Partial<RouteConfig> {
  const previousReports = typeof route.state.reportIds === "object" && route.state.reportIds
    ? route.state.reportIds as Record<string, unknown>
    : {}
  const reportIds = { ...previousReports }
  delete reportIds[reportId]
  return {
    components: route.components.filter((c) => {
      const sourceId = c.props.catalogSourceId ?? c.props.dataSourceId
      return !sourceId?.startsWith(`report:${reportId}:`)
    }),
    state: { ...route.state, reportIds },
    updatedAt: new Date().toISOString()
  }
}
