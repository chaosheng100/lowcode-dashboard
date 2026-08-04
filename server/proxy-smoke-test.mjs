// 数据代理冒烟测试：拉起代理实例，验证鉴权 / 数据集 / 受限 SQL / 管理端 / WebSocket。
// 运行：node server/proxy-smoke-test.mjs
import { spawn } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import WebSocket from 'ws'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.join(__dirname, '..')
const smokeDataDir = path.join(os.tmpdir(), 'lowcode-proxy-smoke')

function startProxy(overrides = {}) {
  return spawn(process.execPath, [path.join(__dirname, 'proxy-server.mjs')], {
    cwd: root,
    env: {
      ...process.env,
      PROXY_PORT: '5175',
      PROXY_AUTH_DISABLED: '1',
      PROXY_DATA_DIR: smokeDataDir,
      ...overrides,
    },
    stdio: 'ignore',
  })
}

async function waitHealth(base, timeoutMs = 6000) {
  const t0 = Date.now()
  while (Date.now() - t0 < timeoutMs) {
    try {
      const res = await fetch(`${base}/health`)
      if (res.ok) return true
    } catch {
      /* 未就绪，继续等 */
    }
    await new Promise((r) => setTimeout(r, 200))
  }
  return false
}

function postJson(url, body, headers = {}) {
  return fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  })
}

function wsOnce(url, { onOpen, onMessage, timeoutMs = 4000 } = {}) {
  return new Promise((resolve) => {
    const ws = new WebSocket(url)
    const timer = setTimeout(() => { ws.terminate(); resolve(false) }, timeoutMs)
    const done = (ok) => {
      clearTimeout(timer)
      try { ws.close() } catch { /* 已断开 */ }
      resolve(ok)
    }
    ws.on('open', () => onOpen?.(ws, done))
    ws.on('message', (data) => onMessage?.(ws, done, data))
    ws.on('error', () => done(false))
    ws.on('close', (code) => {
      if (code === 4001) done(true)
    })
  })
}

async function main() {
  const failures = []
  const check = (name, ok, extra = '') => {
    console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${extra ? ` - ${extra}` : ''}`)
    if (!ok) failures.push(name)
  }

  const child = startProxy()
  try {
    check('health', await waitHealth('http://localhost:5175'))

    const dsRes = await fetch('http://localhost:5175/proxy/datasets')
    const dsJson = await dsRes.json()
    check('datasets list', dsRes.status === 200 && Array.isArray(dsJson.data?.list) && dsJson.data.list.length > 0)
    check('datasets masked endpoint', dsJson.data?.list?.[0]?.dataSource?.endpointMasked !== undefined)

    const stRes = await postJson('http://localhost:5175/proxy/datasets/ds-static-demo/query', { params: {} })
    const stJson = await stRes.json()
    check('static query', stRes.status === 200 && stJson.data?.rows?.length === 5)

    const sqlRes = await postJson('http://localhost:5175/proxy/datasets/ds-sales-region/query', { params: { region: '华东' } })
    const sqlJson = await sqlRes.json()
    check('sql simulated query', sqlRes.status === 200 && sqlJson.data?.simulated === true && sqlJson.data?.columns?.length > 0)

    const badRes = await postJson('http://localhost:5175/proxy/datasets/ds-sales-region/query', { params: {} })
    check('sql missing param 400', badRes.status === 400)

    const nsRes = await postJson('http://localhost:5175/proxy/sql-console', { sql: 'UPDATE orders SET amount = 1' })
    check('console non-select 403', nsRes.status === 403)

    const csRes = await postJson('http://localhost:5175/proxy/sql-console', { sql: 'SELECT region AS name, amount AS value FROM orders LIMIT 5', simulate: true })
    const csJson = await csRes.json()
    check('console select simulated', csRes.status === 200 && csJson.data?.simulated === true)

    const mqRes = await fetch('http://localhost:5175/proxy/mqtt?topic=sensors/%23')
    const mqJson = await mqRes.json()
    check('mqtt pull simulated', mqRes.status === 200 && mqJson.data?.simulated === true)

    const createRes = await postJson('http://localhost:5175/proxy/datasets', {
      id: 'smoke-ds',
      name: '冒烟数据集',
      dataSourceId: 'ds-mysql',
      mode: 'sql',
      queryTemplate: 'SELECT region AS name FROM orders WHERE region = :region LIMIT 3',
      paramsSchema: { region: 'string' },
      acl: ['public'],
    })
    check('admin create dataset', createRes.status === 200)

    const q2Res = await postJson('http://localhost:5175/proxy/datasets/smoke-ds/query', { params: { region: '华东' } })
    check('created dataset query', q2Res.status === 200)

    const delRes = await fetch('http://localhost:5175/proxy/datasets/smoke-ds', { method: 'DELETE' })
    check('delete dataset', delRes.status === 200)

    const wsOk = await wsOnce('ws://localhost:5175/stream?token=dev', {
      onOpen: (ws, done) => ws.send(JSON.stringify({ op: 'sub', sourceId: 'sql:orders' })),
      onMessage: (ws, done, data) => {
        try {
          const msg = JSON.parse(data.toString())
          if (msg.sourceId === 'sql:orders') done(true)
        } catch {
          /* 忽略坏包 */
        }
      },
    })
    check('ws stream auth+sub', wsOk)
  } finally {
    child.kill()
  }

  const authChild = startProxy({ PROXY_PORT: '5176', PROXY_AUTH_DISABLED: '' })
  try {
    check('auth instance health', await waitHealth('http://localhost:5176'))
    const noAuth = await fetch('http://localhost:5176/proxy/datasets')
    check('no token -> 401', noAuth.status === 401)

    const wsDenied = await wsOnce('ws://localhost:5176/stream?token=bad', { timeoutMs: 3000 })
    check('ws bad token closed 4001', wsDenied)
  } finally {
    authChild.kill()
  }

  if (failures.length) {
    console.error(`FAILED: ${failures.join(', ')}`)
    process.exit(1)
  }
  console.log('ALL PASS')
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
