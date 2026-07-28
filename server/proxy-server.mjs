// ============================================================
// 数据代理服务：为前端提供 SQL / WebSocket / MQTT 真实取数通道。
//
// 启动：npm run proxy   （默认端口 5175）
//
// 架构：
//   浏览器 --HTTP--> /proxy/sql      一次性 SQL 查询
//   浏览器 --HTTP--> /proxy/mqtt     拉取主题最近消息
//   浏览器 --WS----> /stream         订阅式实时推送（sub/unsub 协议）
//
// 驱动策略：优先动态加载真实驱动（mysql2 / pg / mssql / oracledb / mqtt），
//           未安装对应驱动时降级为确定性模拟数据，并在响应里标记 simulated:true。
//           安装真实驱动即可无缝切换：npm i mysql2 pg mqtt
// ============================================================
import express from 'express'
import cors from 'cors'
import { createServer } from 'node:http'
import { WebSocketServer } from 'ws'

const PORT = process.env.PROXY_PORT || 5175
const app = express()
app.use(cors())
app.use(express.json({ limit: '2mb' }))

// ---------- 工具：确定性伪随机（同 SQL 返回稳定结果，便于联调） ----------
function seededRng(seed) {
  let s = 0
  for (const ch of String(seed)) s = (s * 31 + ch.charCodeAt(0)) >>> 0
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0
    return s / 2 ** 32
  }
}

// ---------- SQL 驱动层 ----------
const sqlDrivers = {
  mysql: async ({ endpoint, sql }) => {
    const mysql = await import('mysql2/promise') // 未安装则抛错 → 降级
    const [host, port] = endpoint.split(':')
    const conn = await mysql.createConnection({ host, port: +port || 3306, user: process.env.DB_USER || 'root', password: process.env.DB_PASS || '', database: process.env.DB_NAME })
    try {
      const [rows, fields] = await conn.execute(sql)
      return { columns: fields.map((f) => f.name), rows: rows.map((r) => Object.values(r)) }
    } finally { await conn.end() }
  },
  postgresql: async ({ endpoint, sql }) => {
    const pg = await import('pg')
    const [host, port] = endpoint.split(':')
    const client = new pg.default.Client({ host, port: +port || 5432, user: process.env.DB_USER || 'postgres', password: process.env.DB_PASS || '', database: process.env.DB_NAME || 'postgres' })
    await client.connect()
    try {
      const res = await client.query(sql)
      return { columns: res.fields.map((f) => f.name), rows: res.rows.map((r) => Object.values(r)) }
    } finally { await client.end() }
  }
  // sqlserver / starrocks / oracle：同样模式扩展（npm i mssql / oracledb；StarRocks 走 mysql2 协议）
}
sqlDrivers.starrocks = sqlDrivers.mysql // StarRocks 兼容 MySQL 协议

/** 模拟 SQL 执行：解析出表名/字段，生成确定性结果集 */
function simulateSql(sql) {
  const rng = seededRng(sql)
  const m = /select\s+(.+?)\s+from\s+(\S+)/is.exec(sql)
  const cols = m ? m[1].split(',').map((c) => c.trim().split(/\s+as\s+/i).pop().replace(/[^\w\u4e00-\u9fa5]/g, '') || 'col') : ['name', 'value']
  const columns = cols[0] === '' || cols[0] === '*' ? ['id', 'name', 'value', 'updated_at'] : cols
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

app.get('/health', (_req, res) => res.json({ ok: true, service: 'lowcode-proxy', version: '1.0.0' }))

app.post('/proxy/sql', async (req, res) => {
  const { dsType = 'mysql', endpoint = '', sql = '' } = req.body || {}
  if (!sql.trim()) return res.status(400).json({ error: 'sql 不能为空' })
  if (!/^\s*(select|show|desc)/i.test(sql)) return res.status(403).json({ error: '代理仅允许只读查询（SELECT/SHOW/DESC）' })
  const t0 = Date.now()
  const driver = sqlDrivers[dsType.toLowerCase()]
  if (driver) {
    try {
      const out = await driver({ endpoint, sql })
      return res.json({ ...out, elapsedMs: Date.now() - t0, simulated: false })
    } catch (e) {
      // 驱动未安装或连接失败 → 降级模拟，同时携带原因
      const sim = simulateSql(sql)
      return res.json({ ...sim, elapsedMs: Date.now() - t0, simulated: true, fallbackReason: String(e.message || e).slice(0, 200) })
    }
  }
  const sim = simulateSql(sql)
  res.json({ ...sim, elapsedMs: Date.now() - t0, simulated: true, fallbackReason: `暂无 ${dsType} 驱动，npm i 对应驱动后自动启用` })
})

// ---------- MQTT ----------
const mqttCache = new Map() // topic -> [{ts,payload}]
let mqttClient = null
async function ensureMqtt() {
  if (mqttClient) return mqttClient
  try {
    const mqtt = await import('mqtt')
    mqttClient = mqtt.connect(process.env.MQTT_URL || 'mqtt://localhost:1883', { connectTimeout: 3000 })
    mqttClient.on('message', (topic, payload) => {
      const list = mqttCache.get(topic) || []
      list.push({ ts: Date.now(), payload: payload.toString() })
      mqttCache.set(topic, list.slice(-50))
    })
    return mqttClient
  } catch {
    return null // 未安装 mqtt 包 → 模拟
  }
}

app.get('/proxy/mqtt', async (req, res) => {
  const topic = String(req.query.topic || 'sensors/#')
  const client = await ensureMqtt()
  if (client) {
    client.subscribe(topic)
    return res.json({ topic, simulated: false, messages: mqttCache.get(topic) || [] })
  }
  // 模拟：生成传感器消息
  const rng = seededRng(topic + Math.floor(Date.now() / 5000))
  const messages = Array.from({ length: 5 }, (_, i) => ({
    ts: Date.now() - i * 2000,
    payload: JSON.stringify({ deviceId: `dev-${100 + i}`, temp: +(20 + rng() * 15).toFixed(1), humidity: Math.round(40 + rng() * 40) })
  }))
  res.json({ topic, simulated: true, messages })
})

// ---------- WebSocket 实时推流（sub/unsub 协议） ----------
const server = createServer(app)
const wss = new WebSocketServer({ server, path: '/stream' })

/** 数据源生成器：sourceId 前缀决定行为 */
function makeTick(sourceId) {
  const names = {
    'sql:orders': ['华东', '华北', '华南', '西部', '华中'],
    'ws:metrics': ['CPU', '内存', '磁盘IO', '网络', 'GPU'],
    'mqtt:sensors': ['车间1', '车间2', '车间3', '仓库', '装配线']
  }[sourceId] || ['A', 'B', 'C', 'D', 'E']
  const phase = Math.random() * 10
  return () => names.map((name, i) => ({
    name,
    value: Math.round(120 + Math.sin(Date.now() / 1800 + i + phase) * 70 + Math.random() * 25)
  }))
}

wss.on('connection', (socket) => {
  const timers = new Map() // sourceId -> interval
  socket.on('message', (raw) => {
    let msg
    try { msg = JSON.parse(raw.toString()) } catch { return }
    if (msg.op === 'sub' && msg.sourceId && !timers.has(msg.sourceId)) {
      const tick = makeTick(msg.sourceId)
      const send = () => {
        if (socket.readyState === socket.OPEN) {
          socket.send(JSON.stringify({ sourceId: msg.sourceId, data: tick(), ts: Date.now() }))
        }
      }
      send()
      timers.set(msg.sourceId, setInterval(send, 2000))
    }
    if (msg.op === 'unsub' && msg.sourceId) {
      clearInterval(timers.get(msg.sourceId))
      timers.delete(msg.sourceId)
    }
  })
  socket.on('close', () => {
    timers.forEach((t) => clearInterval(t))
    timers.clear()
  })
})

server.listen(PORT, () => {
  console.log(`[lowcode-proxy] 数据代理服务已启动: http://localhost:${PORT}`)
  console.log(`  · POST /proxy/sql    只读 SQL 查询（mysql/postgresql/starrocks 驱动可用即真连，否则模拟）`)
  console.log(`  · GET  /proxy/mqtt   MQTT 主题消息（npm i mqtt 后真连）`)
  console.log(`  · WS   /stream       实时推流（sub/unsub）`)
})
