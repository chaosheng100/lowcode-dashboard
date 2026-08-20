import { useEffect, useMemo, useState } from 'react'
import { createElement, type CSSProperties, type ReactNode } from 'react'
import type { WidgetViewProps } from '../../data/types'
import { subscribeLive, type LivePoint } from '../../data/live/liveClient'
import { applyRowFilter, resolveTemplate } from './filterUtils'

/**
 * ReactComponentWidget：AI 生成的 TSX 组件经过白名单安全转换后渲染。
 * 不直接执行任意源码；不支持的标签 / import / 表达式一律回退到只读错误态。
 * 可用运行时变量：data、filter、live、pick、navigate。
 */

const ALLOWED_TAGS = new Set([
  'div', 'span', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'main', 'header',
  'footer', 'ul', 'ol', 'li', 'button', 'input', 'img', 'svg', 'g', 'path', 'circle',
  'rect', 'line', 'polyline', 'polygon', 'text', 'tspan', 'table', 'thead', 'tbody',
  'tr', 'th', 'td', 'label', 'strong', 'em', 'small', 'code', 'pre', 'br'
])

const FORBIDDEN_PATTERNS: RegExp[] = [
  /\b(import|require)\s*\(/,
  /\b(new\s+Function|eval|document\.|window\.|localStorage|sessionStorage|fetch|XMLHttpRequest|WebSocket|iframe|object|embed)\b/i,
  /\b(useState|useEffect|useRef|useMemo|useCallback|useContext)\b/,
  /\b(dangerouslySetInnerHTML|__proto__|constructor|prototype)\b/,
  /<\s*(script|style|link|meta|iframe|object|embed)\b/i,
]

const ALLOWED_ATTRS = new Set([
  'className', 'style', 'onClick', 'src', 'alt', 'title', 'id', 'disabled',
  'type', 'placeholder', 'value', 'viewBox', 'width', 'height', 'fill',
  'stroke', 'strokeWidth', 'strokeLinecap', 'd',
])

function stripFences(code: string): string {
  return code
    .trim()
    .replace(/^```(?:tsx|jsx|typescript|ts|js)?\s*\n?/, '')
    .replace(/\n?```\s*$/, '')
}

interface SafeVars {
  data: unknown[]
  rows: Array<Record<string, unknown>>
  filter: Record<string, unknown> | null
  live: unknown[]
  vars: Record<string, unknown>
  pick: (payload: { field?: string; value?: unknown }) => void
  navigate: (path: string) => void
}

type AttrValue = { kind: 'string' | 'expr'; raw: string }

function skipWs(source: string, i: number): number {
  while (i < source.length && /\s/.test(source[i])) i++
  return i
}

function readName(source: string, i: number): { name: string; next: number } {
  let name = ''
  while (i < source.length && /[A-Za-z0-9_\-]/.test(source[i])) {
    name += source[i]
    i++
  }
  return { name: name.toLowerCase(), next: i }
}

function readBalanced(source: string, start: number, open = '{', close = '}'): { content: string; next: number } {
  let depth = 0
  let i = start
  let quote = ''
  while (i < source.length) {
    const ch = source[i]
    if (quote) {
      if (ch === quote && source[i - 1] !== '\\') quote = ''
      i++
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') {
      quote = ch
      i++
      continue
    }
    if (ch === open) depth++
    else if (ch === close) {
      depth--
      if (depth === 0) return { content: source.slice(start + 1, i), next: i + 1 }
    }
    i++
  }
  throw new Error('JSX 表达式括号不匹配')
}

function parseAttrs(source: string, start: number): { attrs: Record<string, AttrValue>; next: number; selfClose: boolean } {
  let i = start
  const attrs: Record<string, AttrValue> = {}
  while (true) {
    i = skipWs(source, i)
    if (source[i] === '>') return { attrs, next: i + 1, selfClose: false }
    if (source[i] === '/' && source[i + 1] === '>') return { attrs, next: i + 2, selfClose: true }
    const keyStart = i
    let key = ''
    while (i < source.length && /[A-Za-z0-9_:\-]/.test(source[i])) {
      key += source[i]
      i++
    }
    if (!key) {
      i = keyStart + 1
      continue
    }
    i = skipWs(source, i)
    if (source[i] === '=') {
      i = skipWs(source, i + 1)
      if (source[i] === '"' || source[i] === "'") {
        const quote = source[i]
        i++
        let raw = ''
        while (i < source.length && source[i] !== quote) {
          raw += source[i]
          i++
        }
        i++
        attrs[key] = { kind: 'string', raw }
      } else if (source[i] === '{') {
        const b = readBalanced(source, i)
        attrs[key] = { kind: 'expr', raw: b.content }
        i = b.next
      } else {
        let raw = ''
        while (i < source.length && !/\s|>/.test(source[i])) {
          raw += source[i]
          i++
        }
        attrs[key] = { kind: 'string', raw }
      }
    } else {
      attrs[key] = { kind: 'string', raw: 'true' }
    }
  }
}

function evalPath(expr: string, vars: Record<string, unknown>): unknown {
  const normalized = expr.replace(/\?\./g, '.').trim()
  if (!normalized) return undefined
  if (/^-?\d+(\.\d+)?$/.test(normalized)) return Number(normalized)
  if (/^['"`].*['"`]$/s.test(normalized)) {
    try {
      return new Function(`"use strict"; return (${normalized})`)()
    } catch {
      return undefined
    }
  }
  const head = normalized.match(/^[A-Za-z_$][\w$]*/)
  if (!head || !(head[0] in vars)) return undefined
  let value: unknown = vars[head[0]]
  let rest = normalized.slice(head[0].length)
  while (rest) {
    const dot = rest.match(/^\.[A-Za-z_$][\w$]*/)
    if (dot) {
      value = (value as Record<string, unknown>)?.[dot[0].slice(1)]
      rest = rest.slice(dot[0].length)
      continue
    }
    const index = rest.match(/^\[\s*(?:\d+|'[^']*'|"[^"]*")\s*\]/)
    if (index) {
      const raw = index[0].slice(1, -1).trim()
      const key = raw.startsWith("'") || raw.startsWith('"') ? raw.slice(1, -1) : Number(raw)
      value = Array.isArray(value) || typeof value === 'object'
        ? (value as Record<string, unknown>)[key as unknown as string]
        : undefined
      rest = rest.slice(index[0].length)
      continue
    }
    return undefined
  }
  return value
}

function readTextWithExpr(source: string, start: number, vars: Record<string, unknown>): { text: string; next: number } {
  let out = ''
  let i = start
  while (i < source.length && source[i] !== '<') {
    if (source[i] === '{') {
      const b = readBalanced(source, i)
      const value = b.content.includes('data.length')
        ? (vars.data as unknown[] | undefined)?.length ?? 0
        : evalPath(b.content, vars)
      out += value === undefined ? `{${b.content}}` : String(value)
      i = b.next
    } else {
      out += source[i]
      i++
    }
  }
  return { text: out, next: i }
}

function evalStyle(expr: string): CSSProperties | undefined {
  try {
    const value = new Function(`"use strict"; return (${expr})`)()
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as CSSProperties)
      : undefined
  } catch {
    return undefined
  }
}

function runHandler(expr: string, vars: SafeVars): void {
  try {
    const fn = new Function(
      'pick', 'filter', 'data', 'rows', 'live', 'vars',
      `"use strict"; return (${expr})`
    )
    fn(vars.pick, vars.filter, vars.data, vars.rows, vars.live, vars.vars)
  } catch {
    /* 事件表达式失败时静默忽略 */
  }
}

function toReactProps(
  attrs: Record<string, AttrValue>,
  vars: SafeVars,
  key: string
): Record<string, unknown> {
  const props: Record<string, unknown> = { key }
  for (const [name, attr] of Object.entries(attrs)) {
    if (!ALLOWED_ATTRS.has(name)) continue
    if (name === 'style') {
      if (attr.kind === 'expr') {
        const style = evalStyle(attr.raw)
        if (style) props.style = style
      }
    } else if (name === 'onClick') {
      if (attr.kind === 'expr') {
        props.onClick = () => runHandler(attr.raw, vars)
      }
    } else {
      props[name === 'className' ? 'className' : name] = attr.raw
    }
  }
  return props
}

function parseElement(source: string, start: number, vars: SafeVars, keyPrefix = 'ai'): { node: ReactNode; next: number } {
  const i0 = skipWs(source, start)
  if (source[i0] !== '<') {
    const text = readTextWithExpr(source, i0, vars as unknown as Record<string, unknown>)
    return { node: text.text || null, next: text.next }
  }
  if (source[i0 + 1] === '/') {
    const close = source.indexOf('>', i0)
    return { node: null, next: close === -1 ? source.length : close + 1 }
  }
  const afterLt = i0 + 1
  const tag = readName(source, afterLt)
  if (!tag.name || !ALLOWED_TAGS.has(tag.name)) {
    throw new Error(`不允许的标签 <${tag.name || '?'}>`)
  }
  const parsed = parseAttrs(source, tag.next)
  const key = `${keyPrefix}-${tag.name}-${start}`
  if (parsed.selfClose) {
    return { node: createElement(tag.name, toReactProps(parsed.attrs, vars, key)), next: parsed.next }
  }
  const children: ReactNode[] = []
  let next = parsed.next
  let guard = 0
  while (next < source.length && guard++ < 2000) {
    const peek = skipWs(source, next)
    if (source[peek] === '<' && source[peek + 1] === '/') {
      const close = source.indexOf('>', peek)
      next = close === -1 ? source.length : close + 1
      break
    }
    const child = parseElement(source, next, vars, `${keyPrefix}-${guard}`)
    if (child.node !== null && child.node !== undefined && child.node !== false) {
      children.push(child.node)
    }
    if (child.next <= next) break
    next = child.next
  }
  return {
    node: createElement(tag.name, toReactProps(parsed.attrs, vars, key), children.length ? children : undefined),
    next,
  }
}

function renderJSX(source: string, vars: SafeVars): ReactNode {
  const clean = stripFences(source)
  const fn = clean.match(/export\s+default\s+(?:function\s+)?(?:[A-Za-z_$][\w$]*\s*)?\([^)]*\)\s*\{/)
  if (!fn || fn.index === undefined) {
    throw new Error('未找到 export default 组件')
  }
  const body = clean.slice(fn.index + fn[0].length)
  const returnMatch = body.match(/return\s*(?:\(\s*)?/)
  if (!returnMatch || returnMatch.index === undefined) {
    throw new Error('未找到 return JSX')
  }
  const prelude = body.slice(0, returnMatch.index)
  const locals = new Map<string, unknown>()
  for (const m of prelude.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*([^;\n]+)/g)) {
    try {
      const value = new Function(
        'data', 'filter', 'rows', 'live', 'pick', 'navigate', 'vars',
        `"use strict"; return (${m[2]})`
      )(vars.data, vars.filter, vars.rows, vars.live, vars.pick, vars.navigate, vars.vars)
      locals.set(m[1], value)
    } catch {
      /* 局部表达式失败时跳过 */
    }
  }
  const ret = body.match(/return\s*(?:\(\s*)?/)
  if (!ret || ret.index === undefined) {
    throw new Error('未找到 return JSX')
  }
  const start = fn.index + fn[0].length + ret.index + ret[0].length
  const parsed = parseElement(clean, start, { ...vars, ...Object.fromEntries(locals) })
  return parsed.node
}

export default function ReactComponentWidget({ component, filter, onPick }: WidgetViewProps) {
  const p = component.props
  const [live, setLive] = useState<LivePoint[]>([])
  const [error, setError] = useState('')

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

  const source = resolveTemplate(stripFences(p.sourceCode ?? ''), {
    filterField: p.filterField || 'name',
    dataSourceId: p.dataSourceId,
    liveSourceId: p.liveSourceId,
    catalogName: p.catalogName,
  })
  const forbidden = useMemo(
    () => FORBIDDEN_PATTERNS.find((re) => re.test(source)),
    [source]
  )
  const vars = useMemo(
    () => ({
      data: p.data ?? [],
      rows: applyRowFilter(
        (Array.isArray(p.data) ? p.data : []) as unknown as Array<Record<string, unknown>>,
        filter ?? null
      ),
      filter: (filter ?? null) as Record<string, unknown> | null,
      live,
      vars: {
        filterField: p.filterField || 'name',
        dataSourceId: p.dataSourceId,
        liveSourceId: p.liveSourceId,
        catalogName: p.catalogName,
      },
      pick: (payload: { field?: string; value?: unknown }) => {
        if (p.interactive !== false && onPick) {
          onPick({
            field: String(payload.field ?? p.filterField ?? 'name'),
            value: String(payload.value ?? '')
          })
        }
      },
      navigate: (path: string) => {
        window.location.hash = `#/?path=${encodeURIComponent(path)}`
      },
    }),
    [p.data, p.interactive, p.filterField, p.dataSourceId, p.liveSourceId, p.catalogName, live, onPick, filter]
  )

  const node = useMemo(() => {
    setError('')
    if (!source.trim()) return null
    if (forbidden) {
      setError(`源码包含未开放能力：${forbidden.source}`)
      return null
    }
    try {
      return renderJSX(source, vars)
    } catch (e) {
      setError((e as Error).message || 'TSX 解析失败')
      return null
    }
  }, [source, forbidden, vars])

  if (error) {
    return (
      <div
        style={{
          width: '100%', height: '100%', boxSizing: 'border-box', padding: 12, overflow: 'auto',
          background: 'rgba(255,59,48,0.06)', border: '1px solid rgba(255,59,48,0.24)',
          borderRadius: 8, color: '#ff3b30', fontSize: 12, lineHeight: 1.6, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace'
        }}
      >
        <div style={{ fontWeight: 600, marginBottom: 6 }}>组件源码未通过安全检查</div>
        <div>{error}</div>
      </div>
    )
  }

  if (!node) {
    return (
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#86868b', fontSize: 13, background: '#f5f5f7' }}>
        无组件源码
      </div>
    )
  }

  return (
    <div style={{ width: '100%', height: '100%', overflow: 'hidden', background: 'transparent' }}>
      {node}
    </div>
  )
}
