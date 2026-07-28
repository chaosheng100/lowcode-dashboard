import { useState } from "react"
import { Button } from "antd"
import { useDesignerStore } from "../data/store/useDesignerStore"
import { useApi } from "./useApi"
import { api } from "../mock"
import { Stat } from "./common"
import { openPreviewWindow } from "../designer/window"

function download(filename: string, content: string, type = "application/json") {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function buildStandaloneHtml(projectJson: string, dashboardCount: number): string {
  const style = "body{margin:0;background:#0a0e1a;color:#e6edf3;font-family:system-ui,sans-serif}"
    + ".header{padding:16px 24px;background:#0d1420;border-bottom:1px solid #1a2433}"
    + ".grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(320px,1fr));gap:16px;padding:24px}"
    + ".card{background:#0d1420;border:1px solid #1a2433;border-radius:10px;padding:16px}"
    + ".muted{color:#9fb0c3;font-size:13px}"
    + ".badge{display:inline-block;padding:2px 8px;border-radius:4px;background:#1e3a5f;color:#7dd3fc;font-size:11px;margin-bottom:6px}"
    + ".comp-list{margin-top:8px;display:flex;flex-wrap:wrap;gap:4px}"
    + ".comp-tag{padding:2px 6px;border-radius:3px;background:#132033;font-size:10px;color:#9fb0c3}"
  const script = "var P=__PROJECT__;var typeNames={text:'文本',metric:'指标卡',barChart:'柱状图',lineChart:'折线图',pieChart:'饼图',table:'表格',container:'容器',image:'图片',echartLine:'ECharts折线',echartBar:'ECharts柱状',echartPie:'ECharts饼图',echartGauge:'ECharts仪表盘',echartRadar:'ECharts雷达',echartCustom:'ECharts自定义'};document.getElementById('app').innerHTML=P.routes.filter(function(r){return r.kind==='dashboard'}).map(function(r){var comps=r.components.map(function(c){return '<span class=\"comp-tag\">'+(typeNames[c.type]||c.type)+'</span>'}).join('');return '<div class=\"card\"><span class=\"badge\">大屏</span><b>'+r.name+'</b><div class=\"muted\">'+r.components.length+' 个组件 · 更新 '+r.updatedAt+'</div><div class=\"comp-list\">'+comps+'</div></div>'}).join('');"
  return '<!DOCTYPE html>\n<html lang="zh-CN"><head><meta charset="UTF-8"/>\n<title>数据大屏 · 独立部署</title>\n'
    + "<style>" + style + "</style></head>\n<body><div class=\"header\"><h2>数据大屏平台 · 独立部署导出</h2>\n"
    + '<p class="muted">共 ' + dashboardCount + ' 个大屏 · 本文件由「独立部署」一键导出</p></div>\n'
    + '<div class="grid" id="app"></div>\n'
    + "<script>var __PROJECT__=" + projectJson + ";\n" + script + "\n</script>\n</body></html>"
}

export default function DeployPage() {
  const routes = useDesignerStore((s) => s.routes)
  const updateRoute = useDesignerStore((s) => s.updateRoute)
  const exportProject = useDesignerStore((s) => s.exportProject)
  const { data: ds } = useApi(() => api.listDataSources({ pageSize: 50 }), [])
  const [log, setLog] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [deploying, setDeploying] = useState(false)

  const push = (m: string) => setLog((l) => [...l, `[${new Date().toLocaleTimeString("zh-CN")}] ${m}`])

  const dashboards = routes.filter((r) => r.kind === "dashboard")

  const deployDashboard = async (id: string) => {
    const route = dashboards.find((r) => r.id === id)
    if (!route) return
    setDeploying(true)
    setActiveId(id)
    const now = new Date().toISOString()
    updateRoute(id, { state: { ...route.state, deployInfo: { deployedAt: now, deployedBy: "当前用户" } } })
    push(`已部署大屏「${route.name}」(${route.components.length} 组件)`)
    setDeploying(false)
  }

  const exportJson = () => { download("dashboard-project.json", JSON.stringify(exportProject(), null, 2)); push("已导出项目 JSON") }
  const exportHtml = () => {
    const p = exportProject()
    download("dashboard-standalone.html", buildStandaloneHtml(JSON.stringify(p), p.routes.filter((r) => r.kind === "dashboard").length), "text/html")
    push("已导出独立静态页面")
  }
  const exportDs = () => { download("datasource-config.json", JSON.stringify(ds?.list ?? [], null, 2)); push("已导出数据源配置") }
  const buildCli = () => {
    const screens = exportProject().routes.filter((r) => r.kind === "dashboard").map((r) => r.path)
    const script = ["#!/bin/bash", "# 大屏批量构建脚本（由「独立部署」页一键生成）", "set -e", "", "npm run build", "",
      ...screens.map((s) => `# npm run build -- --screen=${s}`), "", 'echo "✅ 构建完成，产物位于 dist/"'].join("\n")
    download("build-screens.sh", script, "text/x-shellscript")
    push(`已生成构建脚本 build-screens.sh（含 ${screens.length} 个大屏）`)
  }

  return (
    <div className="mg">
      <div className="mg-toolbar">
        <div className="mg-title">独立部署</div>
        <span className="fp-sub" style={{ margin: 0 }}>选择大屏进行部署，或一键导出部署包</span>
      </div>
      <div className="flex" style={{ padding: "12px 16px", gap: 12 }}>
        <Stat label="可部署大屏" value={dashboards.length} accent="#4f8cff" />
        <Stat label="已部署" value={dashboards.filter((d) => d.state.deployInfo).length} accent="#4ade80" />
        <Stat label="数据源" value={ds?.list.length ?? 0} accent="#22d3ee" />
      </div>
      <div className="mg-grid">
        {dashboards.map((d) => {
          const deployed = Boolean(d.state.deployInfo)
          const info = d.state.deployInfo as { deployedAt?: string; deployedBy?: string } | undefined
          return (
            <div className="mg-card" key={d.id} onClick={() => setActiveId(d.id)}>
              <div className="mg-thumb" style={d.thumbnail?.startsWith("data:")
                ? { backgroundImage: `url("${d.thumbnail}")`, backgroundSize: "cover", backgroundPosition: "center" }
                : { background: d.thumbnail || "#10243b" }}>
                <span className="mg-badge" style={deployed ? { background: "#16a34a", color: "#fff" } : undefined}>
                  {deployed ? "已部署" : "大屏"}
                </span>
              </div>
              <div className="mg-info">
                <div className="mg-name" title={d.name}>{d.name}</div>
                <div className="mg-meta">组件数：{d.components.length}</div>
                {deployed && <div className="mg-meta" style={{ color: "#4ade80" }}>部署时间：{info?.deployedAt?.slice(0, 16).replace("T", " ")}</div>}
                <div className="mg-open-row">
                  <Button type={deployed ? "default" : "primary"} size="small" loading={deploying && activeId === d.id}
                    onClick={(e) => { e.stopPropagation(); deployDashboard(d.id) }}>
                    {deployed ? "重新部署" : "部署 →"}
                  </Button>
                  <Button size="small" onClick={(e) => { e.stopPropagation(); openPreviewWindow(d.id) }}>预览</Button>
                </div>
              </div>
            </div>
          )
        })}
        {!dashboards.length && <div className="empty-tip">暂无可部署的大屏</div>}
      </div>

      <div className="grid2" style={{ padding: 16 }}>
        <div className="card">
          <b style={{ color: "#e6edf3" }}>导出 / 构建{activeId ? ` · ${routes.find((r) => r.id === activeId)?.name ?? ""}` : ""}</b>
          <div className="fp-toolbar" style={{ flexDirection: "column", alignItems: "stretch", marginTop: 10 }}>
            <Button onClick={exportJson}>导出项目 JSON</Button>
            <Button onClick={exportHtml}>导出独立 HTML 页面</Button>
            <Button onClick={exportDs}>导出数据源配置</Button>
            <Button onClick={buildCli}>生成命令行批量构建</Button>
          </div>
        </div>
        <div className="card">
          <b style={{ color: "#e6edf3" }}>执行日志</b>
          <pre style={{ background: "#0b111b", padding: 12, borderRadius: 8, fontSize: 12.5, color: "#4ade80", overflow: "auto", maxHeight: 220, margin: "10px 0 0" }}>
{`# 命令行批量构建示例\nnpm run build -- --screen=all\n${log.join("\n") || "（点击左侧按钮触发导出 / 构建）"}`}</pre>
        </div>
      </div>
    </div>
  )
}
