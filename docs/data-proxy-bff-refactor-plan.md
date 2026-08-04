# 数据代理/BFF 重构计划书

> 目标：把当前“前端本地代理取数”升级为“数据集化、带鉴权的后端取数网关（BFF）”，
> 兼容现有页面与模拟降级，不改业务功能、不引入额外中间件。

## 1. 背景与目标

### 1.1 现状

- 前端通过 `src/data/live/liveClient.ts` 直连 `localhost:5175` 数据代理，代理再连 MySQL/PostgreSQL/MQTT 等数据源。
- 代理 `server/proxy-server.mjs` 无鉴权、CORS 全开、SQL 由前端任意传、每次查询新建连接、前端硬编码代理地址。
- WebSocket `/stream` 目前是模拟推流，没有真实订阅 MQTT/Broker。
- 数据源配置仍在前端 mock 层（`DataSourceDTO`），没有服务端注册表和凭据管理。

### 1.2 目标

1. 建立“数据集”概念：前端只传 `datasetId + 参数`，不再传裸 SQL。
2. 代理增加鉴权、授权、连接池、超时/行数限制、审计日志、凭据脱敏。
3. 实时数据统一走后端订阅 + WebSocket 鉴权推流。
4. 前端地址可配置（`VITE_PROXY_URL`），部署后不再依赖 `localhost`。
5. 保留离线模拟降级，开发体验不变。

### 1.3 非目标（本次不做）

- 不做 BI/可视化平台（Superset、DataEase 等）。
- 不做完整 RBAC 后台，沿用现有 token/权限体系。
- 不做多租户与密码库级凭据加密，凭据先放环境变量/服务端配置文件。
- 不新增数据库或消息中间件依赖；数据库驱动按需安装，未安装时继续模拟降级。

## 2. 架构设计

目标链路：

```text
浏览器(React) → BFF 数据代理 → 数据源（MySQL / PostgreSQL / StarRocks / MQTT / HTTP API）
      │
      └─ 鉴权：Authorization: Bearer <token>
```

### 2.1 服务端模块（`server/`）

| 模块 | 职责 |
| --- | --- |
| AuthMiddleware | 校验 JWT/共享密钥，注入当前用户，401/403 统一返回 |
| DataSourceRegistry | 数据源注册表：类型、地址、凭据引用、连接池参数；只返回脱敏元数据 |
| DatasetRegistry | 数据集注册表：数据集绑定数据源 + 查询模板 + 参数 Schema |
| QueryGateway | 执行查询：参数化绑定、行数/超时/频率限制、结果规范化 |
| RealtimeHub | 订阅 MQTT/Broker 并鉴权推流；心跳、重连、订阅校验 |
| AuditLogger | 记录 user / action / dataset / 耗时 / 行数 / 结果大小 |
| FallbackSimulator | 代理不可达或驱动缺失时返回确定性模拟数据并标注 |

### 2.2 数据模型

```ts
interface DataSourceConfig {
  id: string
  name: string
  kind: 'static' | 'api' | 'sql' | 'websocket' | 'mqtt' | 'flow' | 'crawler'
  vendor?: 'mysql' | 'sqlserver' | 'postgres' | 'starrocks' | 'oracle' | 'other'
  endpoint: string
  credentialsRef: string   // 指向环境变量/服务端凭据，不存明文
  poolOptions?: { min?: number; max?: number; idleTimeoutMs?: number }
  scope: 'public' | 'private'
  owner?: string
}

interface Dataset {
  id: string
  name: string
  dataSourceId: string
  mode: 'sql' | 'api' | 'static' | 'stream'
  queryTemplate?: string   // SQL/URL 模板，占位符参数化
  paramsSchema?: Record<string, 'string' | 'number' | 'boolean'>
  rowLimit: number         // 默认 1000，最大 10000
  timeoutMs: number        // 默认 5000
  acl?: string[]           // 可见用户/角色
}
```

## 3. 接口契约

统一响应仍沿用 `{ code, data, message }`。

### 3.1 查询

```http
POST /proxy/datasets/:datasetId/query
Authorization: Bearer <token>
Content-Type: application/json

{ "params": { "region": "华东" }, "limit": 500 }
```

响应：

```json
{ "code": 0, "data": { "columns": [], "rows": [], "elapsedMs": 12, "simulated": false } }
```

### 3.2 数据源/数据集管理（管理端）

```http
GET  /proxy/datasets                 # 返回脱敏元数据（凭据一律隐藏）
POST /proxy/data-sources             # 新增/更新数据源（需管理员权限）
POST /proxy/datasets                 # 新增/更新数据集（需管理员权限）
GET  /health                         # 健康检查
```

### 3.3 WebSocket

```text
ws://host/stream?token=<token>
消息协议：{ op: 'sub', sourceId } / { op: 'unsub', sourceId }
```

- 握手校验 token，未通过直接关闭。
- 服务端按 sourceId 校验订阅权限。
- 每 15s 心跳，断开自动清理定时器。

## 4. 安全设计（MECE）

### 4.1 认证

- 所有 `/proxy/*` 接口要求 `Authorization: Bearer <token>`。
- 优先复用现有登录体系（前端 `src/auth/store.ts` 已有 token），代理侧按统一密钥验签。
- 当前若没有真实签发端，先支持“共享密钥签发开发 token”，后端就绪后无缝切换 JWT 验签。

### 4.2 授权

- 数据集 ACL：查询前校验当前用户是否在可见列表（public 对所有登录用户可见，private 仅 owner/角色可见）。
- 数据源管理接口要求管理员权限，沿用现有权限码 `data:source:*`。

### 4.3 注入与滥用防护

- SQL 只读白名单：仅允许 `SELECT / SHOW / DESCRIBE`，且必须走查询模板参数化绑定。
- 行数上限：默认 1000，最大 10000；超限截断并返回 `truncated: true`。
- 超时：单查询 5s，超时返回 504 并记录审计。
- 频率限制：按用户+数据集限流（如 10 次/秒）。
- 参数 Schema 校验：类型不符直接 400，不进入 SQL 拼接。

### 4.4 凭据与脱敏

- 数据源地址对外只返回脱敏形式：`mysql://user:***@host:3306/db`。
- 密码只存在于服务端环境变量/配置文件，接口响应和日志中均不输出。

### 4.5 审计

- 审计日志至少包含：userId、action、datasetId、耗时、行数、结果字节数、IP、时间。
- 查询失败也记录错误码和原因（不含 SQL 明文以外的敏感信息）。

### 4.6 CORS 与来源控制

- 不再 `cors()` 全开，改为按 `VITE_APP_ORIGIN` 白名单放行。
- 生产环境仅允许前端同源域名或网关域名。

## 5. 实时通道

- 浏览器不直连 MQTT Broker；BFF 订阅 `MQTT_URL` 主题，缓存最近消息，再通过 `/stream` 推给已鉴权用户。
- WebSocket 连接建立时校验 token；`sub/unsub` 校验 sourceId 权限。
- MQTT 在线时推真实数据并标注 `transport: 'proxy'`；离线时保持本地模拟并标注 `transport: 'mock'`。

## 6. 前端改造

- `liveClient.ts`：代理地址改为 `import.meta.env.VITE_PROXY_URL`，默认 `http://localhost:5175`。
- 画布数据绑定改为 `datasetId`，调用 `POST /proxy/datasets/:id/query`。
- `DataSourcePage` 改为展示服务端脱敏元数据；测试连接走后端代理。
- 保留现有 mock 降级与“数据代理离线”提示，保证开发期可用。

## 7. 实施步骤与验收

### M1 模型与服务端注册表

- 服务端实现 DataSourceConfig/Dataset 注册表（文件或内存 + 环境变量凭据）。
- 验收：`GET /proxy/datasets` 返回脱敏元数据；凭据不出现在响应中。

### M2 鉴权与查询网关

- 实现 AuthMiddleware、参数校验、行数/超时/限流、审计。
- 验收：无 token 返回 401；越权数据集返回 403；非 SELECT 返回 403；参数类型错误返回 400；限流生效；审计有记录。

### M3 连接池与多源适配

- MySQL/PostgreSQL/StarRocks 使用连接池；Oracle/SQLServer 保留模拟降级。
- 验收：并发查询复用连接；`simulated: true` 时携带原因；API/static 数据集可查。

### M4 实时通道

- WebSocket 鉴权、心跳、订阅校验；MQTT 真实订阅与离线降级。
- 验收：无 token 无法连接；有权限 sourceId 可收到推流；离线时自动 mock。

### M5 前端迁移与全链路测试

- 前端改用 `VITE_PROXY_URL` + datasetId；页面在线/离线状态正确。
- 验收：`npm run typecheck`、`npm run build` 通过；浏览器全链路：登录 → 数据源页 → 画布绑定 → 查询 → 实时推流；代理停掉后降级正常。

## 8. 测试与验证

- 单元：鉴权中间件、SQL 白名单、参数绑定、行数/超时/限流。
- 接口：curl 覆盖无 token、越权、非 SELECT、超长结果、并发。
- 浏览器：上述 M5 全链路场景，含代理离线降级。

## 9. 风险与权衡

- 没有真实认证签发端：先共享密钥/开发 token，后端就绪后换 JWT 验签，不影响前端契约。
- 凭据存储：先环境变量/配置文件，不上生产密码库；若后续上多租户再引入加密存储。
- Oracle/SQLServer 驱动体积与许可：保留模拟降级，不阻塞主线。
- mock 与真实接口并存期：保留兼容开关，避免一次迁移全部破坏。

## 10. 已确认决策

1. 鉴权契约：对接现有后端 `AUTH_PROFILE_URL`（默认 `BACKEND_API_URL + /auth/profile`）校验 token；
   本地开发可用 `PROXY_AUTH_DISABLED=1` 跳过。
2. 数据集查询：允许管理员保存“受限 SQL”（仅 `SELECT/SHOW/DESCRIBE`，`queryTemplate` 必须使用 `:param` 占位符，执行时参数化绑定）。
3. 凭据存储：环境变量 `DS_CRED_<REF>_USER/PASS/DB/MQTT_URL`，注册表只保存 `credentialsRef`，接口返回脱敏地址。
4. 代理部署形态：随前端一起 `npm run proxy` 启动，默认端口 5175。
