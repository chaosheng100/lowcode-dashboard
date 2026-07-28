// ============================================================
// Mock 客户端 —— 模拟 REST 接口
// - 路径参数匹配（:id）
// - 人工延迟（模拟网络）
// - 分页 / 关键字过滤
// - 错误注入（query 带 __code 触发对应错误码，便于演示异常处理）
// 返回统一信封 ApiResp<T>。
// ============================================================
import type { ApiResp, PageQuery, PageResult, DatasetRow, UserStatus } from './types'
import {
  dashboards,
  dataSources,
  datasets,
  users,
  roles,
  extensions,
  widgets,
  reports,
  analytics,
  assets,
  themes,
  messageChannels,
  mapResources,
  globalVars,
  codeSnippets,
  categories,
  aiModels,
  aiBots,
  twinModels,
  twinScenes,
  iotDevices,
  iotAlarms,
  dataEntries,
  workflows,
  carousels,
  plugins
} from './seed'

const DEFAULT_DELAY = 320

interface Ctx {
  params: Record<string, string>
  query: Record<string, any>
  body?: any
}

type Handler = (ctx: Ctx) => unknown

// —— 分页/过滤工具 ——
function paginate<T>(arr: T[], query: Record<string, any>, matcher?: (item: T, kw: string) => boolean): PageResult<T> {
  let list = arr
  const kw = (query.keyword as string) || ''
  if (kw && matcher) list = list.filter((it) => matcher(it, kw))
  const total = list.length
  const page = Math.max(1, Number(query.page) || 1)
  const pageSize = Math.max(1, Number(query.pageSize) || 10)
  const start = (page - 1) * pageSize
  return { list: list.slice(start, start + pageSize), total, page, pageSize }
}

// —— 路径参数匹配 ——
function matchPath(tpl: string, path: string): Record<string, string> | null {
  const tp = tpl.split('/')
  const pp = path.split('/')
  if (tp.length !== pp.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < tp.length; i++) {
    if (tp[i].startsWith(':')) params[tp[i].slice(1)] = decodeURIComponent(pp[i])
    else if (tp[i] !== pp[i]) return null
  }
  return params
}

// —— 通用 CRUD 工厂（支撑扩展域全量增删改查）——
function crud(resource: string, store: any[]): Record<string, Handler> {
  const base = `/api/${resource}`
  return {
    [`GET ${base}`]: ({ query }) =>
      paginate(store, query, (it, kw) => JSON.stringify(it).toLowerCase().includes(kw.toLowerCase())),
    [`GET ${base}/:id`]: ({ params }) => store.find((x) => x.id === params.id) ?? null,
    [`POST ${base}`]: ({ body }) => {
      const item = { id: `${resource}_${Date.now().toString(36)}`, ...(body || {}) }
      store.push(item)
      return item
    },
    [`PATCH ${base}/:id`]: ({ params, body }) => {
      const it = store.find((x) => x.id === params.id)
      if (!it) return null
      Object.assign(it, body || {})
      return it
    },
    [`DELETE ${base}/:id`]: ({ params }) => {
      const i = store.findIndex((x) => x.id === params.id)
      if (i >= 0) store.splice(i, 1)
      return { ok: true }
    }
  }
}

// —— 业务 handlers ——
const handlers: Record<string, Handler> = {
  ...crud('dataSources', dataSources),
  ...crud('messageChannels', messageChannels),
  ...crud('mapResources', mapResources),
  ...crud('globalVars', globalVars),
  ...crud('codeSnippets', codeSnippets),
  ...crud('categories', categories),
  ...crud('aiModels', aiModels),
  ...crud('aiBots', aiBots),
  ...crud('twinModels', twinModels),
  ...crud('twinScenes', twinScenes),
  ...crud('iotDevices', iotDevices),
  ...crud('iotAlarms', iotAlarms),
  ...crud('dataEntries', dataEntries),
  ...crud('workflows', workflows),
  ...crud('carousels', carousels),
  ...crud('plugins', plugins),
  ...crud('reports', reports),

  'GET /api/dashboards': ({ query }) =>
    paginate(dashboards, query, (d, kw) => d.name.includes(kw) || d.ownerName.includes(kw)),
  'GET /api/dashboards/:id': ({ params }) => dashboards.find((d) => d.id === params.id) ?? null,

  'GET /api/datasources': ({ query }) =>
    paginate(dataSources, query, (d, kw) => d.name.includes(kw) || (d.kind ?? '').includes(kw)),
  'POST /api/datasources/:id/test': ({ params }) => {
    const ds = dataSources.find((d) => d.id === params.id)
    return { id: params.id, ok: !!ds && ds.status === 'connected', latencyMs: 40 + Math.floor(Math.random() * 120) }
  },

  'GET /api/datasets': ({ query }) =>
    paginate(datasets, query, (d, kw) => d.name.includes(kw) || d.sourceName.includes(kw)),
  'POST /api/datasets/:id/query': ({ params, query }) => {
    const ds = datasets.find((d) => d.id === params.id)
    if (!ds) return { list: [], total: 0 }
    const pageSize = Math.max(1, Number((query as PageQuery).pageSize) || 20)
    const seed = ds.id.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
    const rows: DatasetRow[] = Array.from({ length: pageSize }).map((_, i) => {
      const r = (seed * 7 + i * 13) % 97
      return {
        dim_date: `2026-0${(i % 9) + 1}-${String((i % 28) + 1).padStart(2, '0')}`,
        region: ['华东', '华北', '华南', '西部'][i % 4],
        metric: ds.name,
        value: (r / 97) * 1000,
        is_abnormal: r % 11 === 0
      }
    })
    return { list: rows, total: ds.rowCount }
  },

  'GET /api/users': ({ query }) => paginate(users, query, (u, kw) => u.name.includes(kw) || u.email.includes(kw)),
  'PATCH /api/users/:id/status': ({ params, body }) => {
    const u = users.find((x) => x.id === params.id)
    if (!u) return null
    const next = (body && (body as { status?: UserStatus }).status) || (u.status === 'active' ? 'disabled' : 'active')
    u.status = next
    return { ...u }
  },
  'GET /api/roles': () => roles,

  'GET /api/extensions/status': () => extensions,

  'GET /api/widgets': ({ query }) => paginate(widgets, query, (w, kw) => w.name.includes(kw) || w.category.includes(kw)),

  'GET /api/reports': ({ query }) => paginate(reports, query, (r, kw) => r.name.includes(kw)),

  'GET /api/analytics/summary': () => analytics,

  'GET /api/assets': ({ query }) =>
    paginate(assets, query, (a, kw) => a.name.includes(kw) || a.type.includes(kw)),
  'GET /api/themes': () => themes,

  // —— AI 对话 / 代码生成（离线模拟）——
  'POST /api/ai/chat': ({ body }) => {
    const msg = String((body as { message?: string })?.message || '').trim() || '示例需求'
    const picks = ['折线图', '指标卡', '表格', '柱状图', '饼图']
    const pick = picks[msg.length % picks.length]
    return {
      reply: `已理解「${msg}」。建议：使用 ${pick} 呈现，并绑定对应数据集；需要我直接生成组件代码吗？`,
      suggestion: pick
    }
  },
  'POST /api/ai/generate': ({ body }) => {
    const b = (body || {}) as { prompt?: string; lang?: string }
    const p = b.prompt || '示例'
    const lang = b.lang || 'vue'
    let code = ''
    if (lang === 'vue') {
      code = `<template>\n  <div class="card">\n    <h3>{{ title }}</h3>\n    <div class="value">{{ value }}</div>\n  </div>\n</template>\n\n<script setup>\nconst props = defineProps({\n  title: { type: String, default: '${p}' },\n  value: { type: [Number, String], default: 0 }\n})\n</script>`
    } else if (lang === 'echart') {
      code = `// EChart 组件：基于 ${p}\noption = {\n  xAxis: { type: 'category', data: ['一月','二月','三月'] },\n  yAxis: { type: 'value' },\n  series: [{ type: 'bar', data: [120, 200, 150], itemStyle: { color: '#4f8cff' } }]\n}`
    } else {
      code = `<!-- HTML 组件：${p} -->\n<div class="widget" style="padding:12px">\n  <strong>${p}</strong>\n  <p>由 AI 生成的静态片段</p>\n</div>`
    }
    return { code }
  }
}

// —— 对外请求函数 ——
export interface RequestOptions {
  query?: Record<string, any>
  body?: unknown
  delay?: number
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, ms))
}

export async function mockFetch<T>(method: string, path: string, opts: RequestOptions = {}): Promise<ApiResp<T>> {
  const delay = opts.delay ?? DEFAULT_DELAY
  await sleep(delay)

  // 错误注入：?__code=500&__msg=xxx
  const q = opts.query ?? {}
  if (q.__code != null) {
    const code = Number(q.__code)
    return {
      code,
      message: typeof q.__msg === 'string' ? q.__msg : `Mock 模拟错误（code=${code}）`,
      data: null as unknown as T
    }
  }

  // 路由匹配（先精确，后带参数）
  let matched: { handler: Handler; params: Record<string, string> } | null = null
  for (const key of Object.keys(handlers)) {
    const [m, p] = key.split(' ')
    if (m !== method) continue
    const params = matchPath(p, path)
    if (params) {
      matched = { handler: handlers[key], params }
      break
    }
  }

  if (!matched) {
    return { code: 404, message: `Mock 未注册接口：${method} ${path}`, data: null as unknown as T }
  }

  try {
    const data = matched.handler({ params: matched.params, query: q }) as T
    return { code: 0, message: 'ok', data }
  } catch (e) {
    return { code: 500, message: `Mock 处理异常：${(e as Error).message}`, data: null as unknown as T }
  }
}
