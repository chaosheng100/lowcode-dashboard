// ============================================================
// 数据代理/BFF 服务：数据集化取数网关
//
// 启动：npm run proxy   （默认端口 5175）
//
// 架构：浏览器 → BFF 代理 → 数据源（MySQL / PostgreSQL / StarRocks / MQTT / HTTP API）
// 鉴权：Authorization: Bearer <token>，由现有后端 AUTH_PROFILE_URL 校验并返回用户信息
//
// 环境变量：
//   PROXY_PORT            代理端口，默认 5175
//   BACKEND_API_URL       现有后端 API 根地址，默认 http://localhost:3000/api
//   AUTH_PROFILE_URL      用户信息校验地址，默认 <BACKEND_API_URL>/auth/profile
//   AUTH_CACHE_TTL_MS     用户信息缓存毫秒，默认 30000
//   AUTH_FETCH_TIMEOUT_MS 后端校验超时毫秒，默认 3000
//   PROXY_AUTH_DISABLED   设为 1 时跳过鉴权（仅本地开发/联调）
//   CORS_ORIGINS          允许来源逗号分隔，默认 http://localhost:5173,http://localhost:4173
//   RATE_MAX              每用户每数据集 10 秒限流次数，默认 30
//   RATE_CONSOLE_MAX      每用户 SQL 控制台 10 秒限流次数，默认 10
//   DEFAULT_ROW_LIMIT     默认行数上限，默认 1000
//   MAX_ROW_LIMIT         最大行数上限，默认 10000
//   QUERY_TIMEOUT_MS      单次查询超时，默认 5000
//   DS_CRED_<REF>_USER    数据源用户（credentialsRef 大写）
//   DS_CRED_<REF>_PASS    数据源密码
//   DS_CRED_<REF>_DB      数据源默认库
//   DS_CRED_<REF>_MQTT_URL MQTT Broker 地址
// ============================================================
import express from 'express'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.PROXY_DATA_DIR || path.join(__dirname, 'data')
const REGISTRY_FILE = path.join(DATA_DIR, 'registry.json')
const AUDIT_FILE = path.join(DATA_DIR, 'audit.log')

const PORT = +(process.env.PROXY_PORT || 5175)
const BACKEND_API_URL = process.env.BACKEND_API_URL || 'http://localhost:3000/api'
const AUTH_PROFILE_URL = process.env.AUTH_PROFILE_URL || `${BACKEND_API_URL}/auth/profile`
const AUTH_CACHE_TTL_MS = +(process.env.AUTH_CACHE_TTL_MS || 30000)
const AUTH_FETCH_TIMEOUT_MS = +(process.env.AUTH_FETCH_TIMEOUT_MS || 3000)
const AUTH_DISABLED = process.env.PROXY_AUTH_DISABLED === '1'
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173,http://localhost:4173')
  .split(',').map((s) => s.trim()).filter(Boolean)
const RATE_MAX = +(process.env.RATE_MAX || 30)
const RATE_CONSOLE_MAX = +(process.env.RATE_CONSOLE_MAX || 10)
const RATE_WINDOW_MS = 10000
const DEFAULT_ROW_LIMIT = +(process.env.DEFAULT_ROW_LIMIT || 1000)
const MAX_ROW_LIMIT = +(process.env.MAX_ROW_LIMIT || 10000)
const QUERY_TIMEOUT_MS = +(process.env.QUERY_TIMEOUT_MS || 5000)

const DEV_USER = {
  id: 'dev-admin',
  email: 'dev@local',
  name: '开发管理员',
  roles: [{ code: 'super_admin', name: '超级管理员' }],
  permissions: ['*'],
}

const SQL_READ_RE = /^\s*(select|show|describe)\b/i
const KIND_ALLOW = new Set(['static', 'api', 'sql', 'websocket', 'mqtt', 'flow', 'crawler'])
const MODE_ALLOW = new Set(['sql', 'api', 'static', 'stream'])
const VENDOR_ALLOW = new Set(['mysql', 'sqlserver', 'postgres', 'postgresql', 'starrocks', 'oracle', 'other'])

class HttpError extends Error {
  constructor(status, message) {
    super(message)
    this.status = status
  }
}

// ============================================================
// 注册表（数据源 + 数据集）
// ============================================================
function defaultRegistry() {
  return {
    dataSources: [
      { id: 'ds-static', name: '静态示例数据', kind: 'static', scope: 'public', endpoint: '内置数据集', credentialsRef: '', status: 'connected' },
      { id: 'ds-api-user', name: '用户中心 API', kind: 'api', scope: 'public', endpoint: 'https://api.example.com/v1', credentialsRef: '', parseMode: 'json', status: 'connected' },
      { id: 'ds-mysql', name: '生产业务库 MySQL', kind: 'sql', vendor: 'mysql', scope: 'public', endpoint: '10.20.1.10:3306', credentialsRef: 'mysql_demo', status: 'connected' },
      { id: 'ds-pg', name: '数仓 ODS PostgreSQL', kind: 'sql', vendor: 'postgres', scope: 'public', endpoint: '10.20.1.11:5432', credentialsRef: 'pg_demo', status: 'connected' },
      { id: 'ds-sqlserver', name: '报表库 SQLServer', kind: 'sql', vendor: 'sqlserver', scope: 'private', endpoint: '10.20.2.20:1433', credentialsRef: '', status: 'error' },
      { id: 'ds-starrocks', name: '实时分析 StarRocks', kind: 'sql', vendor: 'starrocks', scope: 'public', endpoint: '10.20.2.21:9030', credentialsRef: '', status: 'connected' },
      { id: 'ds-oracle', name: '财务库 Oracle', kind: 'sql', vendor: 'oracle', scope: 'private', endpoint: '10.20.3.30:1521', credentialsRef: '', status: 'error' },
      { id: 'ds-ws', name: 'IoT 实时流 WebSocket', kind: 'websocket', scope: 'public', endpoint: 'wss://stream.example.com/device', credentialsRef: '', status: 'connected' },
      { id: 'ds-mqtt', name: '设备消息 MQTT', kind: 'mqtt', scope: 'public', endpoint: 'mqtt://broker.example.com:1883', credentialsRef: 'mqtt_demo', status: 'connected' },
      { id: 'ds-flow', name: '订单 Flow 流程', kind: 'flow', scope: 'public', endpoint: 'flow://engine/order', credentialsRef: '', status: 'connected' },
      { id: 'ds-crawler', name: '舆情爬虫源', kind: 'crawler', scope: 'private', endpoint: 'https://news.example.com', credentialsRef: '', parseMode: 'html', status: 'connected' },
    ],
    datasets: [
      {
        id: 'ds-static-demo', name: '静态演示数据', dataSourceId: 'ds-static', mode: 'static',
        rowLimit: 1000, timeoutMs: 5000, acl: ['public'],
        staticRows: {
          columns: ['name', 'value'],
          rows: [['华东', 128], ['华北', 96], ['华南', 112], ['西部', 64], ['东北', 48]],
        },
      },
      {
        id: 'ds-user-center', name: '用户中心数据', dataSourceId: 'ds-api-user', mode: 'api',
        queryTemplate: 'https://api.example.com/v1/users?page=:page&size=:size',
        paramsSchema: { page: 'number', size: 'number' },
        rowLimit: 500, timeoutMs: 5000, acl: ['public'],
      },
      {
        id: 'ds-sales-region', name: '区域销售', dataSourceId: 'ds-mysql', mode: 'sql',
        queryTemplate: 'SELECT region AS name, amount AS value FROM orders WHERE region = :region LIMIT 20',
        paramsSchema: { region: 'string' },
        rowLimit: 1000, timeoutMs: 5000, acl: ['public'],
      },
      {
        id: 'ds-orders-live', name: '订单实时流', dataSourceId: 'ds-ws', mode: 'stream',
        queryTemplate: 'sql:orders', rowLimit: 100, timeoutMs: 5000, acl: ['public'],
      },
      {
        id: 'ds-sensors', name: '设备传感器', dataSourceId: 'ds-mqtt', mode: 'stream',
        queryTemplate: 'sensors/#', rowLimit: 100, timeoutMs: 5000, acl: ['public'],
      },
    ],
  }
}

let registry = defaultRegistry()

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true })
}

async function loadRegistry() {
  await ensureDataDir()
  try {
    const raw = await fs.readFile(REGISTRY_FILE, 'utf8')
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed.dataSources) && Array.isArray(parsed.datasets)) {
      registry = parsed
      return
    }
  } catch {
    /* 首次启动或文件损坏时使用默认注册表 */
  }
  registry = defaultRegistry()
  await saveRegistry()
}

async function saveRegistry() {
  await ensureDataDir()
  const tmp = `${REGISTRY_FILE}.tmp`
  await fs.writeFile(tmp, JSON.stringify(registry, null, 2), 'utf8')
  await fs.rename(tmp, REGISTRY_FILE)
}

// ============================================================
// 审计与限流
// ============================================================
async function audit(entry) {
  const line = JSON.stringify({ ts: new Date().toISOString(), ...entry })
  await fs.appendFile(AUDIT_FILE, line + '\n').catch(() => {})
}

const rateBuckets = new Map()
function takeRate(key, max) {
  const now = Date.now()
  const list = (rateBuckets.get(key) || []).filter((t) => t > now - RATE_WINDOW_MS)
  if (list.length >= max) {
    rateBuckets.set(key, list)
    return false
  }
  list.push(now)
  rateBuckets.set(key, list)
  return true
}

// ============================================================
// 鉴权：对接现有后端 AUTH_PROFILE_URL
// ============================================================
const authCache = new Map() // tokenHash -> { user, exp }

async function resolveUser(token) {
  if (AUTH_DISABLED) return DEV_USER
  if (!token) throw new HttpError(401, '未登录')
  const key = crypto.createHash('sha256').update(token).digest('hex')
  const hit = authCache.get(key)
  if (hit && hit.exp > Date.now()) return hit.user

  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), AUTH_FETCH_TIMEOUT_MS)
  let res
  try {
    res = await fetch(AUTH_PROFILE_URL, {
      headers: { Authorization: `Bearer ${token}` },
      signal: ctrl.signal,
    })
  } catch {
    throw new HttpError(401, '登录态校验失败')
  } finally {
    clearTimeout(timer)
  }
  if (!res.ok) {
    const detail = await res.json().catch(() => null)
    throw new HttpError(401, detail?.message || '登录态无效')
  }

  const json = await res.json().catch(() => null)
  const raw = json?.data ?? json ?? {}
  const user = {
    id: String(raw.id || raw.email || 'anonymous'),
    email: raw.email || '',
    name: raw.name || raw.email || '',
    roles: Array.isArray(raw.roles) ? raw.roles : [],
    permissions: Array.isArray(raw.permissions) ? raw.permissions : [],
  }
  authCache.set(key, { user, exp: Date.now() + AUTH_CACHE_TTL_MS })
  return user
}

async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : ''
    req.user = await resolveUser(token)
    next()
  } catch (e) {
    res.status(e.status || 401).json({ code: e.status || 401, message: e.message || '未登录', data: null })
  }
}

function isSuperAdmin(user) {
  return user.permissions?.includes('*') || user.roles?.some((r) => r.code === 'super_admin')
}

function requireAdmin(req, res, next) {
  const u = req.user
  const ok = isSuperAdmin(u) || u.permissions?.includes('data:source:*')
  if (ok) return next()
  res.status(403).json({ code: 403, message: '无数据源管理权限', data: null })
}

function canAccessDataset(user, dataset) {
  if (isSuperAdmin(user)) return true
  if (dataset.acl?.includes('public')) return true
  if (dataset.acl?.includes(user.id)) return true
  const roleCodes = user.roles?.map((r) => r.code) || []
  return dataset.acl?.some((code) => roleCodes.includes(code)) || false
}

// ============================================================
// 凭据与环境变量
// ============================================================
function credentialsOf(dataSource) {
  const ref = String(dataSource.credentialsRef || '').toUpperCase()
  return {
    user: process.env[`DS_CRED_${ref}_USER`] || '',
    pass: process.env[`DS_CRED_${ref}_PASS`] || '',
    db: process.env[`DS_CRED_${ref}_DB`] || '',
    mqttUrl: process.env[`DS_CRED_${ref}_MQTT_URL`] || process.env.MQTT_URL || 'mqtt://localhost:1883',
  }
}

function maskEndpoint(endpoint) {
  return String(endpoint || '').replace(/\/\/[^:@/]+:[^@/]+@/, (m) => m.replace(/:[^@/]+@/, ':***@'))
}

function toPublicDataSource(ds) {
  const { credentialsRef, ...rest } = ds
  return { ...rest, endpointMasked: maskEndpoint(ds.endpoint), hasCredentials: Boolean(credentialsRef) }
}

// ============================================================
// SQL：受限模板 + 参数化绑定
// ============================================================
function bindTemplate(template, params, driver) {
  const tokens = []
  const withHoles = template.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_m, name) => {
    tokens.push(name)
    return '?'
  })
  for (const name of tokens) {
    if (!(name in params)) throw new HttpError(400, `缺少参数 ${name}`)
  }
  for (const name of Object.keys(params)) {
    if (!tokens.includes(name)) throw new HttpError(400, `未知参数 ${name}`)
  }
  const values = tokens.map((name) => params[name])
  if (driver === 'postgres') {
    let i = 0
    return { sql: withHoles.replace(/\?/g, () => `$${++i}`), values }
  }
  return { sql: withHoles, values }
}

function validateParams(params, schema) {
  const out = { ...(params || {}) }
  for (const [name, type] of Object.entries(schema || {})) {
    if (out[name] === undefined || out[name] === null || out[name] === '') continue
    if (type === 'number' && Number.isNaN(Number(out[name]))) {
      throw new HttpError(400, `参数 ${name} 需要数字`)
    }
    if (type === 'boolean' && !['true', 'false', true, false].includes(out[name])) {
      throw new HttpError(400, `参数 ${name} 需要布尔值`)
    }
  }
  return out
}

function seededRng(seed) {
  let s = 0
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

function simulateSql(seed, sql) {
  const rng = seededRng(`${seed}:${sql}`)
  const m = /select\s+(.+?)\s+from\s+(\S+)/is.exec(sql || '')
  const cols = m ? m[1].split(',').map((c) => c.trim().split(/\s+as\s+/i).pop().replace(/[^\w\u4e00-\u9fa5]/g, '') || 'col') : ['name', 'value']
  const columns = !cols[0] || cols[0] === '*' ? ['id', 'name', 'value', 'updated_at'] : cols
  const rows = Array.from({ length: 8 }, (_, i) =>
    columns.map((c) => {
      if (/id/i.test(c)) return i + 1
      if (/time|date|at$/i.test(c)) return new Date(Date.now() - i * 3600e3).toISOString()
      if (/name|region|label|title/i.test(c)) return ['华东', '华北', '华南', '西部', '东北', '华中', '西南', '西北'][i]
      return Math.round(rng() * 500 + 50)
    })
  )
  return { columns, rows }
}

// ============================================================
// 连接池（MySQL / PostgreSQL / StarRocks）
// ============================================================
const pools = new Map() // key -> { driver, pool }

function poolKey(id) {
  return id
}

function safeDecode(value) {
  try {
    return decodeURIComponent(String(value))
  } catch {
    return String(value)
  }
}

function parseDbEndpoint(endpoint, vendor) {
  const raw = String(endpoint || '').trim()
  const defaultPort = vendor === 'postgres' || vendor === 'postgresql' ? 5432 : 3306
  const out = { host: '', port: defaultPort, user: '', pass: '', db: '' }
  if (!raw) return out

  const schemeMatch = raw.replace(/^jdbc:/i, '').match(/^([a-z][a-z0-9+.-]*):\/\//i)
  if (!schemeMatch) {
    const plain = raw.split(/[/?#]/)[0]
    const sep = plain.indexOf(':')
    if (sep >= 0) {
      out.host = plain.slice(0, sep)
      out.port = +(plain.slice(sep + 1)) || defaultPort
    } else {
      out.host = plain
    }
    const slash = raw.indexOf('/')
    if (slash >= 0) out.db = raw.slice(slash + 1).split(/[?#]/)[0]
    return out
  }

  let rest = raw.replace(/^jdbc:/i, '').slice(schemeMatch[0].length)
  let db = ''
  const slash = rest.indexOf('/')
  if (slash >= 0) {
    db = rest.slice(slash + 1).split(/[?#]/)[0]
    rest = rest.slice(0, slash)
  }

  // 兼容密码里包含未转义 @ 的连接串：从右端定位 host:port，再向左取 userinfo
  const hostMatch = rest.match(/(\d{1,3}(?:\.\d{1,3}){3}|\[[^\]]+\]|[^:@\s]+)(?::(\d+))?$/)
  if (hostMatch) {
    const host = hostMatch[1].replace(/^\[|\]$/g, '')
    const port = +(hostMatch[2] || '')
    const prefix = rest.slice(0, hostMatch.index)
    const userinfo = prefix.replace(/[:@]+$/, '')
    let user = ''
    let pass = ''
    if (userinfo) {
      const colon = userinfo.indexOf(':')
      if (colon >= 0) {
        user = userinfo.slice(0, colon)
        pass = userinfo.slice(colon + 1)
      } else {
        user = userinfo
      }
    }
    out.host = host
    out.port = port || defaultPort
    out.user = safeDecode(user)
    out.pass = safeDecode(pass)
    out.db = db
  }
  return out
}

async function getPool(id, vendor, endpoint, cred) {
  const key = poolKey(id)
  if (pools.has(key)) return pools.get(key)
  const { host, port, user, pass, db } = parseDbEndpoint(endpoint, vendor)

  if (vendor === 'postgres' || vendor === 'postgresql') {
    const pg = await import('pg')
    const pool = new pg.default.Pool({
      host,
      port,
      user: user || cred.user || 'postgres',
      password: pass || cred.pass || '',
      database: db || cred.db || 'postgres',
      max: 5,
      idleTimeoutMillis: 30000,
    })
    pools.set(key, { driver: 'postgres', pool })
    return pools.get(key)
  }

  const mysql = await import('mysql2/promise')
  const pool = mysql.createPool({
    host,
    port,
    user: user || cred.user || 'root',
    password: pass || cred.pass || '',
    database: db || cred.db || undefined,
    waitForConnections: true,
    connectionLimit: 5,
    idleTimeout: 30000,
  })
  pools.set(key, { driver: 'mysql', pool })
  return pools.get(key)
}

function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} 超时`)), ms)),
  ])
}

async function runSql(id, vendor, endpoint, cred, sql, values) {
  const { driver, pool } = await getPool(id, vendor, endpoint, cred)
  const out = await withTimeout(pool.query(sql, values), QUERY_TIMEOUT_MS, '查询')
  let columns = []
  let rows = []
  if (Array.isArray(out)) {
    rows = out[0] || []
    columns = (out[1] || []).map((f) => f.name)
  } else if (out && Array.isArray(out.rows)) {
    rows = out.rows
    columns = (out.fields || []).map((f) => f.name)
  }
  return { columns, rows }
}

// ============================================================
// API / 静态 / 流式数据查询
// ============================================================
function bindUrlTemplate(template, params) {
  return template.replace(/:([A-Za-z_][A-Za-z0-9_]*)/g, (_m, name) => {
    if (!(name in params)) throw new HttpError(400, `缺少参数 ${name}`)
    return encodeURIComponent(String(params[name]))
  })
}

function parseApiPayload(text, parseMode) {
  if (parseMode === 'html') return { columns: ['html'], rows: [[text]] }
  if (parseMode === 'xml') return { columns: ['xml'], rows: [[text]] }
  try {
    const json = JSON.parse(text)
    const arr = Array.isArray(json) ? json : json?.data
    if (Array.isArray(arr)) {
      const keys = [...new Set(arr.flatMap((o) => (o && typeof o === 'object' ? Object.keys(o) : [])))]
      return { columns: keys, rows: arr.map((o) => keys.map((k) => (o || {})[k])) }
    }
    return { columns: ['value'], rows: [[json]] }
  } catch {
    return { columns: ['text'], rows: [[text]] }
  }
}

async function queryApi(dataset, dataSource, params) {
  const url = bindUrlTemplate(dataset.queryTemplate, params)
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), dataset.timeoutMs || QUERY_TIMEOUT_MS)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    return parseApiPayload(text, dataSource.parseMode)
  } finally {
    clearTimeout(timer)
  }
}

function queryStatic(dataset) {
  const rows = dataset.staticRows || { columns: ['value'], rows: [[0]] }
  return { columns: rows.columns, rows: rows.rows }
}

// ============================================================
// MQTT 与实时推流
// ============================================================
const mqttCache = new Map() // topic -> [{ ts, payload }]
const streamSubscribers = new Map() // sourceId -> Set<socket>
let mqttClient = null

async function ensureMqtt(mqttUrl) {
  if (mqttClient) return mqttClient
  try {
    const mqtt = await import('mqtt')
    mqttClient = mqtt.connect(mqttUrl || 'mqtt://localhost:1883', { connectTimeout: 3000 })
    mqttClient.on('message', (topic, payload) => {
      const list = mqttCache.get(topic) || []
      list.push({ ts: Date.now(), payload: payload.toString() })
      mqttCache.set(topic, list.slice(-50))
      const sockets = streamSubscribers.get(topic)
      if (sockets) {
        const msg = JSON.stringify({ sourceId: topic, data: [{ name: 'payload', value: payload.toString() }], ts: Date.now(), transport: 'proxy' })
        sockets.forEach((s) => { if (s.readyState === s.OPEN) s.send(msg) })
      }
    })
    return mqttClient
  } catch {
    return null
  }
}

function makeTick(sourceId) {
  const names = {
    'sql:orders': ['华东', '华北', '华南', '西部', '华中'],
    'ws:metrics': ['CPU', '内存', '磁盘IO', '网络', 'GPU'],
    'mqtt:sensors': ['车间1', '车间2', '车间3', '仓库', '装配线'],
  }[sourceId] || ['A', 'B', 'C', 'D', 'E']
  const phase = Math.random() * 10
  return () => names.map((name, i) => ({
    name,
    value: Math.round(120 + Math.sin(Date.now() / 1800 + i + phase) * 70 + Math.random() * 25),
  }))
}

function canSubscribe(user, sourceId) {
  if (isSuperAdmin(user)) return true
  const dataset = registry.datasets.find((d) => d.id === sourceId && d.mode === 'stream')
  if (dataset) return canAccessDataset(user, dataset)
  // 兼容历史 sourceId（sql:orders / ws:metrics / mqtt:sensors）
  return /^(sql|ws|mqtt):/.test(sourceId)
}

// ============================================================
// HTTP 服务
// ============================================================
const app = express()
app.disable('x-powered-by')
app.use(express.json({ limit: '2mb' }))

app.use((req, res, next) => {
  const origin = req.headers.origin
  if (!origin || CORS_ORIGINS.includes('*') || CORS_ORIGINS.includes(origin)) {
    if (origin) res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
    if (req.method === 'OPTIONS') return res.sendStatus(204)
    return next()
  }
  res.status(403).json({ code: 403, message: '来源不被允许', data: null })
})

app.get('/health', (_req, res) => res.json({ ok: true, service: 'lowcode-proxy', version: '2.0.0', auth: AUTH_DISABLED ? 'disabled' : 'backend' }))

app.get('/proxy/datasets', requireAuth, (req, res) => {
  const list = registry.datasets
    .filter((d) => canAccessDataset(req.user, d))
    .map((d) => {
      const ds = registry.dataSources.find((s) => s.id === d.dataSourceId)
      return { ...d, dataSource: ds ? toPublicDataSource(ds) : null }
    })
  res.json({ code: 0, data: { list }, message: 'ok' })
})

app.post('/proxy/datasets/:id/query', requireAuth, async (req, res) => {
  const dataset = registry.datasets.find((d) => d.id === req.params.id)
  if (!dataset) return res.status(404).json({ code: 404, message: '数据集不存在', data: null })
  if (!canAccessDataset(req.user, dataset)) return res.status(403).json({ code: 403, message: '无权访问该数据集', data: null })

  const limit = Math.min(Math.max(+(req.body?.limit || dataset.rowLimit || DEFAULT_ROW_LIMIT), 1), MAX_ROW_LIMIT)
  if (!takeRate(`${req.user.id}:dataset:${dataset.id}`, RATE_MAX)) {
    return res.status(429).json({ code: 429, message: '请求过于频繁', data: null })
  }

  const t0 = Date.now()
  let result
  let simulated = false
  let fallbackReason = ''
  try {
    const dataSource = registry.dataSources.find((s) => s.id === dataset.dataSourceId)
    if (!dataSource) throw new HttpError(500, '数据集未绑定数据源')
    const params = validateParams(req.body?.params, dataset.paramsSchema)

    if (dataset.mode === 'static' || dataSource.kind === 'static') {
      result = queryStatic(dataset)
    } else if (dataset.mode === 'api' || dataSource.kind === 'api' || dataSource.kind === 'crawler') {
      result = await queryApi(dataset, dataSource, params)
    } else if (dataset.mode === 'stream') {
      const cached = mqttCache.get(dataset.queryTemplate || dataSource.endpoint)
      const rows = cached ? cached.map((m) => [m.ts, m.payload]) : []
      result = { columns: ['ts', 'payload'], rows }
      simulated = rows.length === 0
      if (simulated) fallbackReason = '暂无实时消息，返回空结果'
    } else if (dataset.mode === 'sql') {
      if (!SQL_READ_RE.test(dataset.queryTemplate || '')) throw new HttpError(403, '数据集仅允许只读 SQL（SELECT/SHOW/DESCRIBE）')
      const cred = credentialsOf(dataSource)
      const { sql, values } = bindTemplate(dataset.queryTemplate, params, dataSource.vendor)
      try {
        result = await runSql(dataset.dataSourceId, dataSource.vendor, dataSource.endpoint, cred, sql, values)
      } catch (e) {
        simulated = true
        fallbackReason = String(e.message || e).slice(0, 200)
        result = simulateSql(`${dataset.id}:${JSON.stringify(params)}`, dataset.queryTemplate)
      }
    } else {
      throw new HttpError(400, '不支持的数据集模式')
    }
  } catch (e) {
    if (e instanceof HttpError) {
      return res.status(e.status).json({ code: e.status, message: e.message, data: null })
    }
    return res.status(500).json({ code: 500, message: e.message || '查询失败', data: null })
  }

  const rows = (result.rows || []).slice(0, limit)
  const truncated = (result.rows || []).length > limit
  const elapsedMs = Date.now() - t0
  audit({
    userId: req.user.id,
    action: 'dataset.query',
    datasetId: dataset.id,
    elapsedMs,
    rows: rows.length,
    simulated,
    ip: req.ip,
  })
  res.json({
    code: 0,
    data: { columns: result.columns || [], rows, elapsedMs, simulated, truncated, source: dataset.name },
    message: 'ok',
  })
})

const sqlConsoleHandler = async (req, res) => {
  const { dsType = 'mysql', endpoint = '', sql = '' } = req.body || {}
  if (!sql.trim()) return res.status(400).json({ code: 400, message: 'SQL 不能为空', data: null })
  if (!SQL_READ_RE.test(sql)) return res.status(403).json({ code: 403, message: '控制台仅允许只读查询（SELECT/SHOW/DESCRIBE）', data: null })
  if (!takeRate(`${req.user.id}:sql-console`, RATE_CONSOLE_MAX)) {
    return res.status(429).json({ code: 429, message: '请求过于频繁', data: null })
  }

  const t0 = Date.now()
  const id = `console:${dsType}:${endpoint}`
  const cred = { user: process.env.DB_USER || '', pass: process.env.DB_PASS || '', db: process.env.DB_NAME || '' }
  let out
  let simulated = false
  let fallbackReason = ''
  try {
    out = await runSql(id, dsType, endpoint, cred, sql, [])
  } catch (e) {
    if (req.body?.simulate !== true) {
      return res.status(502).json({ code: 502, message: `真实查询失败：${String(e.message || e)}`, data: null })
    }
    simulated = true
    fallbackReason = String(e.message || e).slice(0, 200)
    out = simulateSql(`console:${dsType}:${endpoint}`, sql)
  }
  const elapsedMs = Date.now() - t0
  const tableRows = out.rows.map((row) => (Array.isArray(row) ? row : out.columns.map((col) => row[col])))
  audit({ userId: req.user.id, action: 'sql.console', elapsedMs, rows: out.rows.length, simulated, ip: req.ip })
  res.json({ code: 0, data: { ...out, rows: tableRows, elapsedMs, simulated, fallbackReason }, message: 'ok' })
}
app.post('/proxy/sql-console', requireAuth, sqlConsoleHandler)
app.post('/proxy/sql', requireAuth, sqlConsoleHandler)

app.get('/proxy/mqtt', requireAuth, async (req, res) => {
  const topic = String(req.query.topic || 'sensors/#')
  const client = await ensureMqtt()
  if (client) {
    client.subscribe(topic)
    return res.json({ code: 0, data: { topic, simulated: false, messages: mqttCache.get(topic) || [] }, message: 'ok' })
  }
  const rng = seededRng(topic + Math.floor(Date.now() / 5000))
  const messages = Array.from({ length: 5 }, (_, i) => ({
    ts: Date.now() - i * 2000,
    payload: JSON.stringify({ deviceId: `dev-${100 + i}`, temp: +(20 + rng() * 15).toFixed(1), humidity: Math.round(40 + rng() * 40) }),
  }))
  res.json({ code: 0, data: { topic, simulated: true, messages }, message: 'ok' })
})

app.post('/proxy/data-sources', requireAuth, requireAdmin, async (req, res) => {
  const body = req.body || {}
  if (!body.id || !body.name || !KIND_ALLOW.has(body.kind)) {
    return res.status(400).json({ code: 400, message: '数据源缺少 id/name/kind 或类型非法', data: null })
  }
  if (body.kind === 'sql' && !VENDOR_ALLOW.has(body.vendor || 'mysql')) {
    return res.status(400).json({ code: 400, message: 'SQL 厂商非法', data: null })
  }
  const idx = registry.dataSources.findIndex((s) => s.id === body.id)
  const next = {
    id: body.id,
    name: body.name,
    kind: body.kind,
    vendor: body.kind === 'sql' ? body.vendor || 'mysql' : undefined,
    scope: body.scope || 'public',
    endpoint: body.endpoint,
    credentialsRef: body.credentialsRef || '',
    parseMode: body.parseMode,
    status: body.status || 'connected',
  }
  if (idx >= 0) registry.dataSources[idx] = next
  else registry.dataSources.push(next)
  await saveRegistry()
  audit({ userId: req.user.id, action: 'data-source.save', dataSourceId: next.id })
  res.json({ code: 0, data: toPublicDataSource(next), message: 'ok' })
})

app.post('/proxy/datasets', requireAuth, requireAdmin, async (req, res) => {
  const body = req.body || {}
  if (!body.id || !body.name || !body.dataSourceId || !MODE_ALLOW.has(body.mode)) {
    return res.status(400).json({ code: 400, message: '数据集缺少 id/name/dataSourceId/mode 或 mode 非法', data: null })
  }
  if (!registry.dataSources.some((s) => s.id === body.dataSourceId)) {
    return res.status(400).json({ code: 400, message: '绑定的数据源不存在', data: null })
  }
  if (body.mode === 'sql') {
    if (!SQL_READ_RE.test(body.queryTemplate || '')) {
      return res.status(400).json({ code: 400, message: 'SQL 数据集仅允许只读语句（SELECT/SHOW/DESCRIBE）', data: null })
    }
    if (!/:[A-Za-z_]/.test(body.queryTemplate || '')) {
      return res.status(400).json({ code: 400, message: 'SQL 数据集必须使用 :param 参数占位符', data: null })
    }
  }
  const next = {
    id: body.id,
    name: body.name,
    dataSourceId: body.dataSourceId,
    mode: body.mode,
    queryTemplate: body.queryTemplate || '',
    paramsSchema: body.paramsSchema || {},
    rowLimit: Math.min(Math.max(+(body.rowLimit || DEFAULT_ROW_LIMIT), 1), MAX_ROW_LIMIT),
    timeoutMs: +(body.timeoutMs || QUERY_TIMEOUT_MS),
    acl: body.acl || ['public'],
    staticRows: body.staticRows,
  }
  const idx = registry.datasets.findIndex((d) => d.id === body.id)
  if (idx >= 0) registry.datasets[idx] = next
  else registry.datasets.push(next)
  await saveRegistry()
  audit({ userId: req.user.id, action: 'dataset.save', datasetId: next.id })
  res.json({ code: 0, data: next, message: 'ok' })
})

app.delete('/proxy/datasets/:id', requireAuth, requireAdmin, async (req, res) => {
  const idx = registry.datasets.findIndex((d) => d.id === req.params.id)
  if (idx < 0) return res.status(404).json({ code: 404, message: '数据集不存在', data: null })
  registry.datasets.splice(idx, 1)
  await saveRegistry()
  audit({ userId: req.user.id, action: 'dataset.delete', datasetId: req.params.id })
  res.json({ code: 0, data: { ok: true }, message: 'ok' })
})

// ============================================================
// WebSocket 实时推流
// ============================================================
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/stream' })

wss.on('connection', async (socket, req) => {
  let user
  try {
    const url = new URL(req.url, 'http://localhost')
    const token = url.searchParams.get('token') || ''
    user = await resolveUser(token)
  } catch {
    socket.close(4001, 'unauthorized')
    return
  }
  if (!user) {
    socket.close(4001, 'unauthorized')
    return
  }

  socket.isAlive = true
  const timers = new Map()
  const sourceIds = new Set()

  socket.on('pong', () => { socket.isAlive = true })

  socket.on('message', async (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }

    if (msg.op === 'sub' && msg.sourceId && !timers.has(msg.sourceId)) {
      if (!canSubscribe(user, msg.sourceId)) {
        socket.send(JSON.stringify({ error: 'forbidden', sourceId: msg.sourceId }))
        return
      }
      sourceIds.add(msg.sourceId)
      const sockets = streamSubscribers.get(msg.sourceId) || new Set()
      sockets.add(socket)
      streamSubscribers.set(msg.sourceId, sockets)

      const ds = registry.dataSources.find((s) => s.id === msg.sourceId)
      const client = await ensureMqtt(credentialsOf(ds || {}).mqttUrl)
      if (client && ds?.kind === 'mqtt') {
        client.subscribe(msg.sourceId)
      } else {
        const tick = makeTick(msg.sourceId)
        const send = () => {
          if (socket.readyState === socket.OPEN) {
            socket.send(JSON.stringify({ sourceId: msg.sourceId, data: tick(), ts: Date.now(), transport: 'proxy' }))
          }
        }
        send()
        timers.set(msg.sourceId, setInterval(send, 2000))
      }
    }

    if (msg.op === 'unsub' && msg.sourceId) {
      clearInterval(timers.get(msg.sourceId))
      timers.delete(msg.sourceId)
      const sockets = streamSubscribers.get(msg.sourceId)
      if (sockets) {
        sockets.delete(socket)
        if (sockets.size === 0) streamSubscribers.delete(msg.sourceId)
      }
    }
  })

  socket.on('close', () => {
    timers.forEach((t) => clearInterval(t))
    timers.clear()
    sourceIds.forEach((sourceId) => {
      const sockets = streamSubscribers.get(sourceId)
      if (sockets) {
        sockets.delete(socket)
        if (sockets.size === 0) streamSubscribers.delete(sourceId)
      }
    })
  })
})

const heartbeat = setInterval(() => {
  wss.clients.forEach((socket) => {
    if (!socket.isAlive) {
      socket.terminate()
      return
    }
    socket.isAlive = false
    socket.ping()
  })
}, 15000)
wss.on('close', () => clearInterval(heartbeat))

// ============================================================
// 启动与关闭
// ============================================================
async function closeAll() {
  clearInterval(heartbeat)
  wss.close()
  await Promise.allSettled([...pools.values()].map(({ pool }) => {
    try { return pool.end?.() } catch { return undefined }
  }))
  if (mqttClient?.end) mqttClient.end(true)
}

async function main() {
  await loadRegistry()
  server.listen(PORT, () => {
    console.log(`[lowcode-proxy] 数据代理服务已启动: http://localhost:${PORT}`)
    console.log(`  · 鉴权: ${AUTH_DISABLED ? '本地开发（跳过）' : `对接 ${AUTH_PROFILE_URL}`}`)
    console.log(`  · GET  /proxy/datasets            数据集脱敏元数据`)
    console.log(`  · POST /proxy/datasets/:id/query  数据集查询（参数化）`)
    console.log(`  · POST /proxy/sql-console         受限只读 SQL 控制台`)
    console.log(`  · GET  /proxy/mqtt                MQTT 主题消息`)
    console.log(`  · WS   /stream                    实时推流（sub/unsub）`)
    console.log(`  · 注册表: ${REGISTRY_FILE}`)
  })
}

process.on('SIGINT', async () => { await closeAll(); process.exit(0) })
process.on('SIGTERM', async () => { await closeAll(); process.exit(0) })

main().catch((e) => {
  console.error('[lowcode-proxy] 启动失败:', e)
  process.exit(1)
})
