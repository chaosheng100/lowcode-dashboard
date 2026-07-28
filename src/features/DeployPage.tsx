import { useState } from 'react'
import { useDesignerStore } from '../data/store/useDesignerStore'
import { useApi } from './useApi'
import { api } from '../mock'
import { Stat } from './common'
import { openPreviewWindow } from '../designer/window'

function download(filename: string, content: string, type = 'application/json') {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function buildStandaloneHtml(projectJson: string, dashboardCount: number): string {
  const style = 'body{margin:0;background:#0a0e1a;color:#e6edf3;font-family:system-ui,sans-serif}'
    + '.header{padding:16px 24px;background:#0d1420;border-bottom:1px solid #1a2433}'
    + '.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:16px;padding:24px}'
    + '.card{background:#0d1420;border:1px solid #1a2433;border-radius:10px;padding:16px}'
    + '.muted{color:#9fb0c3;font-size:13px}'
  const script = "var P=__PROJECT__;document.getElementById('app').innerHTML="
    + "P.routes.filter(function(r){return r.kind==='dashboard'}).map(function(r){"
    + "return '<div class=\"card\"><b>'+r.name+'</b><div class=\"muted\">组件数：'+r.components.length+'</div></div>'}).join('');"
  return '<!DOCTYPE html>\n<html lang="zh-CN"><head><meta charset="UTF-8"/>\n<title>数据大屏 · 独立部署</title>\n'
    + '<style>' + style + '</style></head>\n<body><div class="header"><h2>数据大屏平台 · 独立部署导出</h2>\n'
    + '<p class="muted">共 ' + dashboardCount + ' 个大屏 · 本文件由「独立部署」一键导出</p></div>\n'
    + '<div class="grid" id="app"></div>\n'
    + '<script>var __PROJECT__=' + projectJson + ';\n' + script + '\n</script>\n</body></html>'
}

/** 独立部署：大屏列表 + 部署导出 + 预览（关系与大屏管理一致） */
export default function DeployPage() {
  const routes = useDesignerStore((s) => s.routes)
  const exportProject = useDesignerStore((s) => s.exportProject)
  const { data: ds } = useApi(() => api.listDataSources({ pageSize: 50 }), [])
  const [log, setLog] = useState<string[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)

  const push = (m: string) => setLog((l) => [...l, `✓ ${m}`])

  const dashboards = routes.filter((r) => r.kind === 'dashboard')

  const exportJson = () => { download('dashboard-project.json', JSON.stringify(exportProject(), null, 2)); push('已导出项目 JSON') }
  const exportHtml = () => {
    const p = exportProject()
    download('dashboard-standalone.html', buildStandaloneHtml(JSON.stringify(p), p.routes.filter((r) => r.kind === 'dashboard').length), 'text/html')
    push('已导出独立静态页面')
  }
  const exportDs = () => { download('datasource-config.json', JSON.stringify(ds?.list ?? [], null, 2)); push('已导出数据源配置') }
  const buildCli = () => {
    const screens = exportProject().routes.filter((r) => r.kind === 'dashboard').map((r) => r.path)
    const script = ['#!/bin/bash', '# 大屏批量构建脚本（由「独立部署」页一键生成）', 'set -e', '', 'npm run build', '',
      ...screens.map((s) => `# npm run build -- --screen=${s}`), '', 'echo "✓ 构建完成，产物位于 dist/"'].join('\n')
    download('build-screens.sh', script, 'text/x-shellscript')
    push(`已生成构建脚本 build-screens.sh（含 ${screens.length} 个大屏）`)
  }

  return (
    <div className="mg">
      <div className="mg-toolbar">
        <div className="mg-title">独立部署</div>
        <span className="fp-sub" style={{ margin: 0 }}>选择大屏进行预览，或一键导出部署包</span>
      </div>
      <div className="flex" style={{ padding: '12px 16px', gap: 12 }}>
        <Stat label="可部署大屏" value={dashboards.length} accent="#4f8cff" />
        <Stat label="数据源" value={ds?.list.length ?? 0} accent="#22d3ee" />
        <Stat label="构建产物" value="dist/" accent="#4ade80" />
      </div>
      <div className="mg-grid">
        {dashboards.map((d) => (
          <div className="mg-card" key={d.id}>
            <div className="mg-thumb" style={{ background: d.thumbnail?.startsWith('data:') ? undefined : (d.thumbnail || '#10243b'), backgroundImage: d.thumbnail?.startsWith('data:') ? `url("${d.thumbnail}")` : undefined, backgroundSize: 'cover', backgroundPosition: 'center' }}>
              <span className="mg-badge">大屏</span>
            </div>
            <div className="mg-info">
              <div className="mg-name" title={d.name}>{d.name}</div>
              <div className="mg-meta">组件数：{d.components.length}</div>
              <div className="mg-open-row">
                <span className="mg-open" onClick={() => setActiveId(d.id)}>部署 →</span>
                <span className="mg-preview" onClick={() => openPreviewWindow(d.id)}>预览</span>
              </div>
            </div>
          </div>
        ))}
        {!dashboards.length && <div className="empty-tip">暂无可部署的大屏</div>}
      </div>

      <div className="grid2" style={{ padding: 16 }}>
        <div className="card">
          <b style={{ color: '#e6edf3' }}>导出 / 构建{activeId ? ` · ${routes.find((r) => r.id === activeId)?.name ?? ''}` : ''}</b>
          <div className="fp-toolbar" style={{ flexDirection: 'column', alignItems: 'stretch', marginTop: 10 }}>
            <button className="btn" onClick={exportJson}>⬇ 导出项目 JSON</button>
            <button className="btn" onClick={exportHtml}>⬇ 导出独立 HTML 页面</button>
            <button className="btn" onClick={exportDs}>⬇ 导出数据源配置</button>
            <button className="btn" onClick={buildCli}>🛠 生成命令行批量构建</button>
          </div>
        </div>
        <div className="card">
          <b style={{ color: '#e6edf3' }}>执行日志</b>
          <pre style={{ background: '#0b111b', padding: 12, borderRadius: 8, fontSize: 12.5, color: '#4ade80', overflow: 'auto', maxHeight: 220, margin: '10px 0 0' }}>
{`# 命令行批量构建示例
npm run build -- --screen=all
${log.join('\n') || '（点击左侧按钮触发导出 / 构建）'}`}</pre>
        </div>
      </div>
    </div>
  )
}
