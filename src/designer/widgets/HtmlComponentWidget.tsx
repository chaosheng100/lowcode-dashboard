import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
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
  columns: __COLUMNS__,
  data: __DATA__,
  filter: __FILTER__,
  live: __LIVE__,
  rows: __ROWS__,
  vars: __VARS__,
  filterField: __VARS__.filterField || 'name',
  interactive: __INTERACTIVE__,
  bound: __BOUND__,
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
  if ('columns' in msg) window.__DASHBOARD__.columns = msg.columns;
  if ('data' in msg) window.__DASHBOARD__.data = msg.data;
  if ('rows' in msg) window.__DASHBOARD__.rows = msg.rows;
  if ('filter' in msg) window.__DASHBOARD__.filter = msg.filter;
  if ('live' in msg) window.__DASHBOARD__.live = msg.live;
  if (typeof msg.reload === 'function') msg.reload();
  window.dispatchEvent(new CustomEvent('dashboard:update', { detail: msg }));
});
window.addEventListener('dashboard:update', function () {
  if (window.__DASHBOARD__.bound) renderTable();
});
function normalizeTableColumns(columns) {
  return (columns || []).map(function (column) {
    if (typeof column === 'string') {
      return { key: column, title: column, dataSetFieldKey: column };
    }
    var key = String(column.key || column.dataSetFieldKey || column.title || '');
    return {
      key: key,
      title: String(column.title || column.name || column.label || key),
      dataSetFieldKey: String(column.dataSetFieldKey || key)
    };
  }).filter(function (column) { return column.key; });
}
function renderTable(options) {
  options = options || {};
  var columns = normalizeTableColumns(options.columns || window.__DASHBOARD__.columns);
  var rows = options.rows || window.__DASHBOARD__.rows || [];
  var host = document.querySelector(options.target || '[data-dashboard-table]') || document.querySelector('table');
  if (!host) return false;
  var table = host.tagName === 'TABLE' ? host : host.querySelector('table');
  if (!table) {
    table = document.createElement('table');
    host.appendChild(table);
  }
  table.innerHTML = '';
  if (columns.length) {
    var thead = document.createElement('thead');
    var headRow = document.createElement('tr');
    columns.forEach(function (column) {
      var th = document.createElement('th');
      th.textContent = column.title;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);
  }
  var tbody = document.createElement('tbody');
  var pickField = options.pickField || window.__DASHBOARD__.filterField || (columns[0] && columns[0].key) || 'name';
  rows.forEach(function (row) {
    var tr = document.createElement('tr');
    columns.forEach(function (column) {
      var td = document.createElement('td');
      td.textContent = row[column.key] == null ? '' : String(row[column.key]);
      tr.appendChild(td);
    });
    if (window.__DASHBOARD__.interactive) {
      tr.addEventListener('click', function () {
        var value = row[pickField] == null ? '' : String(row[pickField]);
        window.__DASHBOARD__.pick({ field: pickField, value: value });
      });
    }
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  return true;
}
window.__DASHBOARD__.renderTable = renderTable;
function autoRenderTable() {
  if (window.__DASHBOARD__.bound) renderTable();
}
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', autoRenderTable);
} else {
  setTimeout(autoRenderTable, 0);
}
window.addEventListener('load', autoRenderTable);
`

/** iframe 内测量自然内容尺寸；沙箱文档不能由宿主直接读取 DOM，所以用 postMessage 回传。 */
const SIZE_BRIDGE = `;(function () {
  var lastSize = '';
  var scheduled = false;
  function queue() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(function () {
      scheduled = false;
      measure();
    });
  }
  function measure() {
    try {
      var root = document.documentElement;
      var body = document.body;
      if (!root || !body) return;
      var width = Math.max(root.scrollWidth || 0, body.scrollWidth || 0);
      var height = Math.max(root.scrollHeight || 0, body.scrollHeight || 0);
      var elements = body.getElementsByTagName('*');
      for (var i = 0; i < elements.length; i++) {
        var element = elements[i];
        var rect = element.getBoundingClientRect();
        width = Math.max(width, rect.right);
        height = Math.max(height, rect.bottom);
        // overflow:hidden/auto 容器里的内容不会体现在 body.scrollWidth/Height，这里单独补齐。
        if (element.scrollWidth) width = Math.max(width, rect.left + element.clientLeft + element.scrollWidth);
        if (element.scrollHeight) height = Math.max(height, rect.top + element.clientTop + element.scrollHeight);
      }
      width = Math.max(1, Math.ceil(width));
      height = Math.max(1, Math.ceil(height));
      var size = width + 'x' + height;
      if (size === lastSize) return;
      lastSize = size;
      window.parent.postMessage({
        type: 'dashboard:html-size',
        docId: __DOC_ID__,
        width: width,
        height: height
      }, '*');
    } catch (error) {}
  }
  window.addEventListener('resize', queue);
  document.addEventListener('DOMContentLoaded', queue);
  window.addEventListener('load', queue);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(queue);
  setTimeout(queue, 0);
  setTimeout(queue, 120);
  setTimeout(queue, 500);
  if (typeof MutationObserver === 'function') {
    new MutationObserver(queue).observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      characterData: true
    });
  }
  if (typeof ResizeObserver === 'function') {
    var observer = new ResizeObserver(queue);
    observer.observe(document.documentElement);
    if (document.body) observer.observe(document.body);
  }
  queue();
})();
`

let nextHtmlDocId = 1

interface HtmlContentSize {
  docId: number
  width: number
  height: number
}

interface HtmlBridgeColumn {
  key: string
  title: string
  dataSetFieldKey: string
}

function stripFences(code: string): string {
  return code
    .trim()
    .replace(/^```[a-zA-Z]*\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
}

function buildDocument(
  sourceCode: string,
  rows: Array<Record<string, unknown>>,
  filter: Filter | null,
  live: LivePoint[],
  columns: HtmlBridgeColumn[],
  vars: Record<string, unknown>,
  bound: boolean,
  interactive: boolean,
  docId: number
): string {
  let clean = stripFences(sourceCode)
  clean = resolveTemplate(clean, vars)
  const isFull = /^\s*<(?:!doctype|html)/i.test(clean)
  const json = (v: unknown) =>
    JSON.stringify(v ?? null).replace(/</g, '\\u003c')
  const filteredRows = applyRowFilter(rows, filter)
  const bridge = [
    CORE_BRIDGE
      .replace('__COLUMNS__', json(columns))
      .replace('__DATA__', json(filteredRows))
      .replace('__FILTER__', json(filter))
      .replace('__LIVE__', json(live))
      .replace('__ROWS__', json(filteredRows))
      .split('__VARS__').join(json(vars))
      .replace('__INTERACTIVE__', json(interactive))
      .replace('__BOUND__', json(bound)),
    SIZE_BRIDGE.replace('__DOC_ID__', String(docId)),
  ].join('\n')
  const safeInline = (code: string) => code.replace(/<\/script/gi, '<\\/script')
  const head = `<meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; script-src 'unsafe-inline' https:; style-src 'unsafe-inline' https:; img-src data: https:; font-src data: https:; connect-src https: data:;"><style>html,body{width:100%;margin:0;overflow:hidden;background:transparent;font-family:-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',sans-serif}</style>`
  if (isFull) {
    const withHead = clean.includes('<head') ? clean.replace(/<head[^>]*>/i, (m) => m + head) : clean.replace(/<html[^>]*>/i, (m) => m + `<head>${head}</head>`)
    const withBodyClose = withHead.replace(/<\/body>/i, () => `<script>${safeInline(bridge)}<\/script></body>`)
    return withBodyClose.includes('</body>') ? withBodyClose : withBodyClose + `<script>${safeInline(bridge)}<\/script></body></html>`
  }
  return `<!doctype html><html><head>${head}</head><body style="background:transparent"><script>${safeInline(bridge)}<\/script>${clean}</body></html>`
}

/** AI 助手预览必须与设计器运行态使用同一份数据桥契约。 */
export function buildHtmlPreviewDocument(sourceCode: string): string {
  return buildDocument(
    sourceCode,
    [],
    null,
    [],
    [],
    {},
    false,
    true,
    nextHtmlDocId++,
  )
}

export default function HtmlComponentWidget({ component, filter, onPick, preview }: WidgetViewProps) {
  const p = component.props
  const style = component.style
  const frameRef = useRef<HTMLIFrameElement>(null)
  const cbRef = useRef({ onPick, filterField: p.filterField || 'name', interactive: p.interactive !== false })
  cbRef.current = { onPick, filterField: p.filterField || 'name', interactive: p.interactive !== false }
  const [live, setLive] = useState<LivePoint[]>([])
  const [contentSize, setContentSize] = useState<HtmlContentSize | null>(null)
  const [showSizeFallback, setShowSizeFallback] = useState(false)

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
  const columns = useMemo<HtmlBridgeColumn[]>(
    () => asArray<string | Record<string, unknown>>(p.columns).map((column) => {
      if (typeof column === 'string') {
        return { key: column, title: column, dataSetFieldKey: column }
      }
      const key = String(column.key || column.dataSetFieldKey || column.title || '')
      return {
        key,
        title: String(column.title || column.name || column.label || key),
        dataSetFieldKey: String(column.dataSetFieldKey || key),
      }
    }).filter((column) => column.key),
    [p.columns]
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

  const filteredRows = useMemo(
    () => applyRowFilter(rows, filter ?? null),
    [rows, filter]
  )
  const dashboardPayload = useMemo(
    () => ({
      columns,
      data: filteredRows,
      rows: filteredRows,
      filter: filter ?? null,
      live,
    }),
    [columns, filteredRows, filter, live]
  )
  const dashboardPayloadKey = JSON.stringify([
    dashboardPayload.columns,
    dashboardPayload.rows,
    dashboardPayload.filter,
    dashboardPayload.live,
  ])
  const varsKey = JSON.stringify(vars)

  const docInfo = useMemo(
    () => {
      const id = nextHtmlDocId++
      return {
        id,
        html: buildDocument(
          p.sourceCode ?? '',
          rows,
          filter ?? null,
          live,
          columns,
          vars,
          Boolean(p.dataSourceId || component.dataSource?.datasetId),
          p.interactive !== false,
          id,
        ),
      }
    },
    // 行/列/筛选/实时数据走 dashboard:update 增量桥，避免运行态轮询反复重载 iframe。
    [p.sourceCode, varsKey, p.dataSourceId, component.dataSource?.datasetId, p.interactive]
  )
  const doc = docInfo.html
  const docId = docInfo.id
  const latestPayloadRef = useRef(dashboardPayload)
  latestPayloadRef.current = dashboardPayload

  const pushDashboardUpdate = useCallback(() => {
    const frameWindow = frameRef.current?.contentWindow
    if (!frameWindow) return
    frameWindow.postMessage(
      { type: 'dashboard:update', ...latestPayloadRef.current },
      '*'
    )
  }, [])

  const handleFrameLoad = useCallback(() => {
    pushDashboardUpdate()
  }, [pushDashboardUpdate])

  useEffect(() => {
    setContentSize(null)
    const frame = frameRef.current
    if (!frame) return
    const onMessage = (event: MessageEvent) => {
      const msg = event.data as {
        type?: string
        docId?: number | string
        width?: number | string
        height?: number | string
        payload?: { field?: string; value?: unknown }
      }
      if (event.source !== frame.contentWindow || !msg) return

      if (msg.type === 'dashboard:html-size') {
        if (Number(msg.docId) !== docId) return
        const width = Math.round(Number(msg.width))
        const height = Math.round(Number(msg.height))
        if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) return
        setContentSize((current) => {
          if (current?.docId !== docId) return { docId, width, height }
          const nextWidth = Math.max(current.width, width)
          const nextHeight = Math.max(current.height, height)
          return current.width === nextWidth && current.height === nextHeight
            ? current
            : { docId, width: nextWidth, height: nextHeight }
        })
        return
      }

      if (msg.type !== 'dashboard:pick') return
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
  }, [doc, docId])

  useEffect(() => {
    pushDashboardUpdate()
  }, [dashboardPayloadKey, pushDashboardUpdate])

  useEffect(() => {
    setShowSizeFallback(false)
    const timer = setTimeout(() => setShowSizeFallback(true), 350)
    return () => clearTimeout(timer)
  }, [docId])

  const frameWidth = Math.max(style.w, contentSize?.width ?? style.w)
  const frameHeight = Math.max(style.h, contentSize?.height ?? style.h)
  const scale = Math.min(style.w / frameWidth, style.h / frameHeight)
  // 首帧测量前隐藏；等最终缩放比例确定后再显示，消除加载期的一次视觉跳动。
  const isSizeReady = contentSize?.docId === docId || showSizeFallback

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', overflow: 'hidden' }}>
      <iframe
        ref={frameRef}
        title={p.title || 'AI HTML 组件'}
        srcDoc={doc}
        onLoad={handleFrameLoad}
        sandbox={p.sandboxMode === 'trusted'
          ? 'allow-scripts allow-same-origin allow-forms'
          : 'allow-scripts'}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: `${frameWidth}px`,
          height: `${frameHeight}px`,
          border: 0,
          background: 'transparent',
          transform: `translate(-50%, -50%) scale(${scale})`,
          opacity: isSizeReady ? 1 : 0,
          transition: 'opacity 160ms cubic-bezier(0.25, 1, 0.3, 1)',
          pointerEvents: preview ? 'auto' : 'none',
        }}
      />
    </div>
  )
}
