// ============================================================
// AI 组件预览共享工具：HTML / React / ECharts 产物的安全预览
// AI 助手页与组件库页（AI 调整）共用。
// ============================================================

/** 去掉 markdown 围栏，取干净代码 */
export function stripCodeFence(code: string): string {
  return code
    .trim()
    .replace(/^```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
}

const MOCK_DASHBOARD_DATA = [
  { name: '华东', value: 320 },
  { name: '华北', value: 210 },
]

const CSP_HTML =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' https:; style-src \'unsafe-inline\' https:; img-src data: https:; font-src data: https:; connect-src https: data:">'
const CSP_CHART =
  '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\' https:; style-src \'unsafe-inline\'; img-src data: https:; font-src data: https:; connect-src https: data:">'

function safeInline(code: string): string {
  return code.replace(/<\/script/gi, '<\\/script')
}

const DASHBOARD_BRIDGE = `<script>window.__DASHBOARD__ = { data: ${JSON.stringify(MOCK_DASHBOARD_DATA)}, filter: null, pick: function (payload) { window.parent.postMessage({ type: 'dashboard:pick', payload: payload || {} }, '*') } };<\/script>`

/** HTML 组件预览：独立 HTML 文档 + 大屏数据桥 */
export function buildHtmlPreviewSrcDoc(code: string): string {
  const clean = stripCodeFence(code)
  if (/^\s*<(?:!doctype|html)/i.test(clean)) {
    const withHead = clean.replace(/<head[^>]*>/i, (m) => m + CSP_HTML)
    return withHead.replace(/<\/body>/i, () => `${DASHBOARD_BRIDGE}</body>`)
  }
  return `<!doctype html><html><head><meta charset="utf-8">${CSP_HTML}${DASHBOARD_BRIDGE}</head><body>${clean}</body></html>`
}

/** ECharts 组件预览：注入 ECharts CDN，自动执行 option 渲染（兼容纯 JSON option 与 JS 代码） */
export function buildEchartsPreviewSrcDoc(code: string): string {
  const clean = stripCodeFence(code)
  if (/^\s*</.test(clean)) {
    if (/^\s*<(?:!doctype|html)/i.test(clean)) return clean
    return `<!doctype html><html><head><meta charset="utf-8">${CSP_CHART}<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script></head><body>${clean}</body></html>`
  }
  // 纯 JSON option：先解析成变量再渲染（裸对象直接插进 try 块会触发语法错误）
  let exec = safeInline(clean)
  const trimmed = clean.trim()
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const parsed = JSON.parse(trimmed)
      exec = `var option = ${JSON.stringify(parsed)};`
    } catch {
      /* 非严格 JSON（含函数/变量），按原样执行 */
    }
  }
  return `<!doctype html><html><head><meta charset="utf-8">${CSP_CHART}<script src="https://cdn.jsdelivr.net/npm/echarts@5/dist/echarts.min.js"></script></head><body style="margin:0;background:#ffffff"><div id="chart" style="width:100vw;height:100vh"></div><script>\ntry {\n${exec}\nif (typeof echarts === 'undefined') throw new Error('ECharts CDN 未加载');\nif (!document.querySelector('#chart canvas')) {\nvar __chart = echarts.init(document.getElementById('chart'));\n__chart.setOption((typeof option !== 'undefined' ? option : window.option) || {});\n}\n} catch (e) { document.body.innerHTML = '<pre style="color:#ff3b30;padding:12px">' + (e && e.message ? e.message : String(e)) + '</pre>' }\n<\/script></body></html>`
}

/** React 产物只读快照预览：不支持执行任意 JSX/import，仅展示代码 */
export function buildReactPreviewSrcDoc(code: string): string {
  const safe = stripCodeFence(code)
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/&lt;\/script/gi, '&lt;\\/script')
  return `<!doctype html><html><head><meta charset="utf-8"><style>html,body{height:100%;margin:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}pre{height:100%;box-sizing:border-box;margin:0;padding:16px;overflow:auto;font-size:12px;line-height:1.7;color:#1d1d1f;white-space:pre-wrap;word-break:break-all}</style></head><body><pre>${safe}</pre></body></html>`
}

/** 从 AI 生成的代码里提取 ECharts option JSON（支持 HTML/JS/围栏代码块） */
export function extractEchartsOption(code: string): string | null {
  const clean = stripCodeFence(code)
  const script = clean.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
  const js = (script ? script[1] : clean).trim()

  const tryObject = (raw: string): string | null => {
    try {
      const value = new Function(`"use strict"; return (${raw})`)()
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return JSON.stringify(value)
      }
    } catch {
      /* try next candidate */
    }
    return null
  }

  const extractBalanced = (source: string, re: RegExp): string | null => {
    const match = re.exec(source)
    if (!match) return null
    const start = source.indexOf('{', match.index + match[0].length)
    if (start === -1) return null
    let depth = 0
    let inStr = false
    let quote = ''
    for (let i = start; i < source.length; i++) {
      const ch = source[i]
      if (inStr) {
        if (ch === quote && source[i - 1] !== '\\') inStr = false
        continue
      }
      if (ch === '"' || ch === "'" || ch === '`') {
        inStr = true
        quote = ch
        continue
      }
      if (ch === '{') depth++
      else if (ch === '}') {
        depth--
        if (depth === 0) return source.slice(start, i + 1)
      }
    }
    return null
  }

  // 整段就是 option 对象
  if (/^\s*\{[\s\S]*\}\s*$/.test(js)) {
    const whole = tryObject(js)
    if (whole) return whole
  }

  // option = {...} 或 chart.setOption({...})
  for (const re of [/option\s*=\s*/, /setOption\s*\(\s*/]) {
    const raw = extractBalanced(js, re)
    if (raw) {
      const out = tryObject(raw)
      if (out) return out
    }
  }

  // option = JSON.parse('...')
  const jsonParse = js.match(/option\s*=\s*JSON\.parse\(\s*(['"])([\s\S]*?)\1\s*\)/)
  if (jsonParse) {
    try {
      const value = JSON.parse(jsonParse[2])
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return JSON.stringify(value)
      }
    } catch {
      /* ignore */
    }
  }
  return null
}

/** 预览 iframe 已渲染出 ECharts 时，直接从 chart 实例取完整 option */
export function extractOptionFromFrame(frame: HTMLIFrameElement | null): string | null {
  try {
    const win = frame?.contentWindow
    if (!win) return null
    const anyWin = win as unknown as Record<string, unknown>
    const echarts = anyWin.echarts as
      | { getInstanceByDom?: (el: HTMLElement | null) => { getOption?: () => unknown } | undefined }
      | undefined
    const el = win.document.getElementById('chart')
    const inst =
      typeof echarts?.getInstanceByDom === 'function' ? echarts.getInstanceByDom(el) : undefined
    const option =
      anyWin.option ??
      inst?.getOption?.() ??
      (anyWin.chart as { getOption?: () => unknown } | undefined)?.getOption?.()
    if (option && typeof option === 'object' && !Array.isArray(option)) {
      return JSON.stringify(option)
    }
  } catch {
    /* ignore */
  }
  return null
}
