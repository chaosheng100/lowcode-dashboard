import runtimeSrc from './standaloneRuntime.js?raw'
import type { RouteConfig } from '../data/types'

/** 独立产物运行态所需的数据包（由部署模块注入） */
export interface StandalonePayload {
  title: string
  /** 纳入部署的大屏路由列表（已裁剪为仅所选屏幕） */
  screens: RouteConfig[]
  /** 全局变量表 name -> value（模块间数据互通） */
  globalVars: Record<string, string>
  /** 数据源环境级绑定 id -> { kind, endpoint }（部署时覆盖默认 endpoint） */
  dataSources: Record<string, { kind: string; endpoint: string }>
  /** 目标部署环境 */
  env: { name: string; baseUrl: string }
}

/**
 * 生成「真正可运行」的独立静态 HTML：
 * 内联全部大屏数据 + 全局变量 + 数据源绑定 + 原生运行态脚本，
 * 浏览器直接打开即为真实可交互的数据大屏（与数据大屏同源联动）。
 */
export function buildStandaloneHtml(payload: StandalonePayload): string {
  const dataJson = JSON.stringify(payload).replace(/</g, '\\u003c')
  const title = payload.title || '数据大屏 · 独立部署'
  return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${title}</title>
<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { height: 100%; }
  body {
    background: #070c18;
    background-image: radial-gradient(ellipse at 20% 0%, rgba(0,100,200,.06) 0%, transparent 50%), radial-gradient(ellipse at 80% 100%, rgba(0,200,180,.04) 0%, transparent 50%);
    color: #e6edf3; font-family: system-ui, "PingFang SC", "Microsoft YaHei", sans-serif;
    overflow: hidden;
  }
  #app { display: flex; flex-direction: column; height: 100%; }
  header { display: flex; align-items: center; gap: 16px; height: 52px; padding: 0 18px; background: rgba(12,19,36,.72); backdrop-filter: blur(16px); border-bottom: 1px solid rgba(42,66,108,.35); flex: none; }
  #title { font-weight: 700; font-size: 15px; background: linear-gradient(135deg,#00d4ff,#4f8cff); -webkit-background-clip: text; -webkit-text-fill-color: transparent; letter-spacing: 1px; }
  #env { font-size: 12px; padding: 2px 10px; border-radius: 999px; background: rgba(45,212,191,.12); color: #2dd4bf; border: 1px solid rgba(45,212,191,.3); }
  #nav { display: flex; gap: 8px; margin-left: auto; }
  .tab { background: transparent; border: 1px solid rgba(42,66,108,.5); color: #9aa7b4; padding: 5px 14px; border-radius: 8px; cursor: pointer; font-size: 13px; transition: all .15s; }
  .tab:hover { color: #e6edf3; border-color: #00d4ff; }
  .tab.active { background: linear-gradient(135deg, rgba(0,212,255,.15), rgba(79,140,255,.15)); color: #e6edf3; border-color: #00d4ff; }
  #stage { position: relative; flex: 1; min-height: 0; overflow: hidden; }
  #banner { position: fixed; top: 60px; left: 50%; transform: translateX(-50%); display: none; align-items: center; background: linear-gradient(135deg,#00d4ff,#4f8cff); color: #fff; padding: 6px 14px; border-radius: 20px; font-size: 13px; z-index: 100; box-shadow: 0 0 24px rgba(0,212,255,.18); }
  .comp { transition: opacity .2s, box-shadow .2s; }
</style>
</head>
<body>
<div id="app">
  <header>
    <span id="title">数据大屏</span>
    <span id="env"></span>
    <nav id="nav"></nav>
  </header>
  <div id="stage"></div>
</div>
<div id="banner"></div>
<script>
  window.__DATA__ = ${dataJson};
  document.getElementById('env').textContent = (window.__DATA__.env && window.__DATA__.env.name ? window.__DATA__.env.name : '默认环境');
${runtimeSrc}
</script>
</body>
</html>`
}
