import { useEffect, useMemo, useRef, useState } from 'react'
import type { Filter, WidgetViewProps } from '../../data/types'
import { subscribeLive, type LivePoint } from '../../data/live/liveClient'
import { applyRowFilter, resolveTemplate } from './filterUtils'
import { asArray } from '../../data/utils/typeGuards'

/**
 * HtmlComponentWidget：把 AI 生成的 HTML 片段/文档放进沙箱 iframe。
 * - 通过 window.__DASHBOARD__ 注入 data / filter / live / pick / navigate
 * - 组件内部调用 __DASHBOARD__.pick({ field, value }) 或 postMessage 即可联动大屏
 * - sandbox 默认不含 allow-same-origin，避免 AI 代码访问宿主页面
 */

const CORE_BRIDGE = `window.__DASHBOARD__ = {
  data: __DATA__,
  filter: __FILTER__,
  live: __LIVE__,
  rows: __ROWS__,
  vars: __VARS__,
  pick: function (payload) {
    try { window.parent.postMessage({ type: 'dashboard:pick', payload: payload || {} }, '*') } catch (e) {}
  },
  navigate: function (path) {
    try { window.parent.postMessage({ type: 'dashboard:navigate', path: String(path || '') }, '*') } catch (e) {}
  }
};
window.addEventListener('message', function (event) {
  var msg = event.data;
  if (!msg || typeof msg !== 'object' || msg.type !== 'dashboard:update') return;
  if ('data' in msg) window.__DASHBOARD__.data = msg.data;
  if ('filter' in msg) window.__DASHBOARD__.filter = msg.filter;
  if ('live' in msg) window.__DASHBOARD__.live = msg.live;
  if (typeof msg.reload === 'function') msg.reload();
  window.dispatchEvent(new CustomEvent('dashboard:update', { detail: msg }));
});
`

function stripFences(code: string): string {
  return code
    .trim()
    .replace(/^```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
}

function buildDocument(
  sourceCode: string,
  data: unknown,
  filter: Filter | null,
  live: LivePoint[],
  rows: Array<Record<string, unknown>>,
  vars: Record<string, unknown>
): string {
  let clean = stripFences(sourceCode)
  clean = resolveTemplate(clean, vars)
  const isFull = /^\s*<(?:!doctype|html)/i.test(clean)
  const json = (v: unknown) =>
    JSON.stringify(v ?? null).replace(/</g, '\\u003c')
  const filteredRows = applyRowFilter(rows, filter)
  const bridge = CORE_BRIDGE
    .replace('__DATA__', json(data))
    .replace('__FILTER__', json(filter))
    .replace('__LIVE__', json(live))
    .replace('__ROWS__', json(filteredRows))
    .replace('__VARS__', json(vars))
  const safeInline = (code: string) => code.replace(/<\/script/gi, '<\\/script')
  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; img-src data: https:; font-src data: https:; connect-src https: data:;"><style>html,body{width:100%;height:100%;margin:0;overflow:hidden;background:transparent;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}</style>`
  if (isFull) {
    const withHead = clean.includes('<head') ? clean.replace(/<head[^>]*>/i, (m) => m + head) : clean.replace(/<html[^>]*>/i, (m) => m + `<head>${head}</head>`)
    const withBodyClose = withHead.replace(/<\/body>/i, () => `<script>${safeInline(bridge)}<\/script></body>`)
    return withBodyClose.includes('</body>') ? withBodyClose : withBodyClose + `<script>${safeInline(bridge)}<\/script></body></html>`
  }
  return `<!doctype html><html><head>${head}</head><body style="background:transparent"><script>${safeInline(bridge)}<\/script>${clean}</body></html>`
}

export default function HtmlComponentWidget({ component, filter, onPick }: WidgetViewProps) {
  const p = component.props
  const frameRef = useRef<HTMLIFrameElement>(null)
  const cbRef = useRef({ onPick, filterField: p.filterField || 'name', interactive: p.interactive !== false })
  cbRef.current = { onPick, filterField: p.filterField || 'name', interactive: p.interactive !== false }
  const [live, setLive] = useState<LivePoint[]>([])

  useEffect(() => {
    if (!p.liveSourceId) {
      setLive([])
      return
    }
    return subscribeLive(
      p.liveSourceId,
      (data) => setLive(data),
      p.liveIntervalMs ?? 2000
    )
  }, [p.liveSourceId, p.liveIntervalMs])

  const rows = useMemo<Array<Record<string, unknown>>>(
    () => asArray<Record<string, unknown>>(p.data),
    [p.data]
  )
  const vars = useMemo<Record<string, unknown>>(
    () => ({
      filterField: p.filterField || 'name',
      dataSourceId: p.dataSourceId,
      liveSourceId: p.liveSourceId,
      catalogName: p.catalogName,
    }),
    [p.filterField, p.dataSourceId, p.liveSourceId, p.catalogName]
  )
  const doc = useMemo(
    () => buildDocument(p.sourceCode ?? '', p.data ?? [], filter ?? null, live, rows, vars),
    [p.sourceCode, p.data, filter, live, rows, vars]
  )

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const onMessage = (event: MessageEvent) => {
      const msg = event.data as { type?: string; payload?: { field?: string; value?: unknown } }
      if (event.source !== frame.contentWindow || !msg || msg.type !== 'dashboard:pick') return
      const cb = cbRef.current
      if (!cb.interactive || !cb.onPick) return
      const payload = msg.payload || {}
      cb.onPick({
        field: String(payload.field ?? cb.filterField),
        value: String(payload.value ?? '')
      })
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  if (p.sandboxMode === 'trusted') {
    // 信任模式仍放在 iframe 中，但允许同源，便于内网自研组件使用 localStorage/接口
    return (
      <iframe
        title={p.title || 'AI HTML 组件'}
        srcDoc={doc}
        sandbox="allow-scripts allow-same-origin allow-forms"
        style={{ width: '100%', height: '100%', border: 0, background: 'transparent' }}
      />
    )
  }

  return (
    <iframe
      ref={frameRef}
      title={p.title || 'AI HTML 组件'}
      srcDoc={doc}
      sandbox="allow-scripts"
      style={{ width: '100%', height: '100%', border: 0, background: 'transparent', pointerEvents: 'auto' }}
    />
  )
}
