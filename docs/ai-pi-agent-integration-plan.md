# AI 模块对接 pi-agent 实施计划

> 目标：把前端「AI 模块」（AI 助手 / 模型管理 / 机器人）对接到后端刚引入的 `pi-agent`，让对话、代码生成、模型/机器人 CRUD 跑通真实 LLM。
> 生成日期：2026-07-30

---

## 0. 关键结论（先说重点）

| 事实 | 影响 |
|---|---|
| 前端 AI 模块「请求层」已基本就绪：统一 `api` 门面（`src/mock/api.ts`）直接发往真实后端，期望 `{code:0,data,...}` 信封 | 前端改动极小 |
| 后端 `apps/api/src/agent/agent.controller.ts` 是**空壳**：无方法、无 `AgentService`、未注册进 `AppModule` → 运行时 `/api/agent` 不存在 | **后端要补 AgentModule 并注册** |
| 后端现有 `AiController`（`/api/ai/predict|recommend|analyze`）是**规则引擎**，不是 LLM/agent，且前端未调用 | 与本次对接基本无关 |
| 前端 AI 助手实际依赖的端点 `/api/ai/chat`、`/api/ai/generate`、`/api/aiModels`、`/api/aiBots` —— **后端一个都没实现** | **主要工作量在后端** |

**一句话**：前端 90% 就绪，后端几乎要从零把接口接上。下面给出分步计划，后端为阻塞项，前端为收尾项。

---

## 1. 两端契约对齐（已探明）

| 前端 `api.*` 方法 | HTTP | 解析后端点 | 期望 `data` 结构 | 后端现状 |
|---|---|---|---|---|
| `aiChat(message)` | POST | `/api/ai/chat` | `{ reply: string; suggestion: string }` | ❌ 未实现 |
| `aiGenerate(prompt, lang)` | POST | `/api/ai/generate` | `{ code: string }`（代码字符串） | ❌ 未实现 |
| `listAIModels / saveAIModel / deleteAIModel` | GET/POST/PATCH/DELETE | `/api/aiModels[/:id]` | `PageResult<AIModelDTO>` / `AIModelDTO` | ❌ 未实现 |
| `listAIBots / saveAIBot / deleteAIBot` | GET/POST/PATCH/DELETE | `/api/aiBots[/:id]` | `PageResult<AIBotDTO>` / `AIBotDTO` | ❌ 未实现 |
| `aiPredict / aiRecommend / aiAnalyze`（前端已声明未调用） | POST | `/api/ai/predict|recommend|analyze` | 任意 | ✅ 后端已有（规则引擎，可复用） |
| `codegen`（前端已声明未调用） | POST | `/api/dev/codegen` | 任意 | ❌ 未实现 |

前端传输层：`BASE_URL = VITE_API_BASE_URL || http://localhost:3000/api`（`src/api/client.ts`，**无条件转发真实后端**，无 mock 兜底）。前端自动去掉 `/api` 前缀避免拼成 `/api/api/...`。

---

## 2. 后端实施（核心，分 3 步）

### 2.1 补齐 AgentModule（最小可用 = 非流式）

新建 `apps/api/src/agent/agent.module.ts` + `agent.service.ts` + DTO，并**注册进 `AppModule`**（当前漏了这一步，是空壳不生效的根因）。

`AgentService` 用 `@earendil-works/pi-agent-core` 的 `Agent`：

```ts
// agent.service.ts（示意）
import { Agent } from '@earendil-works/pi-agent-core'

async function runAgent(message: string, model?: string): Promise<{ reply: string; suggestion: string }> {
  const agent = new Agent({
    model: model || process.env.AGENT_MODEL || 'openai/gpt-4o-mini',
    systemPrompt: '你是低代码大屏平台的 AI 助手…',
    // tools: [...]  // 后续可接大屏生成/组件检索工具
  })
  let reply = ''
  const done = new Promise<void>((resolve) => {
    agent.subscribe((event) => {
      if (event.type === 'message_update') reply += event.textDelta || ''
      if (event.type === 'agent_end') resolve()
    })
  })
  await agent.prompt(message)
  await done
  return { reply, suggestion: '' }   // suggestion 可留空或让 agent 生成下一步建议
}
```

端点（放进 `AgentController`，前缀 `/api`，套 `TransformInterceptor` 的信封）：

- `POST /api/ai/chat` — body `{ message: string; sessionId?: string; model?: string }` → `{ reply, suggestion }`
- `POST /api/ai/generate` — body `{ prompt: string; lang: string }` → 让 agent 产出代码，返回 `{ code: string }`

> 注意：前端 `aiGenerate` 的 `data.code` 字段名与外层信封 `code` 不同，别混淆。

### 2.2 AI 模型 / 机器人 CRUD

- `GET/POST/PATCH/DELETE /api/aiModels` 与 `/api/aiBots`
- **存储建议**：复用 Prisma `Resource` 表（`kind = 'aiModel' | 'aiBot'`，`data` 存 JSON 字符串），**零新增迁移**，与之前七模块做法一致。
  - 若追求干净，可新增 `AiModel`/`AiBot` 表，但需 `prisma migrate`（第 1 次要补 migration，参考上次 `Resource` 修复经验）。
- 返回结构对齐前端 `AIModelDTO` / `AIBotDTO`（含 `id/name/provider/type/baseUrl/status` 等）。

### 2.3 流式增强（可选，体验项）

- `POST /api/ai/chat/stream` 用 SSE，把 `agent.subscribe` 的 `message_update`（含 `text_delta`/`thinking_delta`）逐条转成 `text/event-stream` 事件。
- `POST /api/agent/abort` → `agent.abort()`。
- 需要前端同步加 `aiChatStream()`（见 3.2）。

---

## 3. 前端实施（很小）

### 3.1 默认零改动跑通
只要后端返回 `{ code: 0, data: { reply, suggestion } }` 信封，**前端 AI 助手 / 模型管理页面无需改一行**即可工作。

### 3.2 唯一接缝（结构不一致时）
若后端返回形状不同，**只改 `src/mock/api.ts` 里 `aiChat` / `aiGenerate` 的字段映射**，调用方 `AIAssistantPage` 不受影响——这是对接层唯一切口。

### 3.3 流式（可选）
- `src/mock/api.ts` 新增 `aiChatStream(message, onDelta)`：`fetch` + `response.body.getReader()` 消费 SSE/流。
- 改造 `AIAssistantPage.send()` 为增量追加 `text`（当前是 `await` 全量，全仓无流式代码）。

### 3.4 顺手捡漏（低成本）
前端已声明但未调用的 `api.aiPredict / aiRecommend / aiAnalyze / codegen` 对应后端**已存在**的 `/api/ai/predict|recommend|analyze`。可在 AI 助手页 / 平台页接入入口，复用现有端点，无需后端新工作。

---

## 4. 配置与跨域

- **后端 `.env` 补 provider key**：`OPENAI_API_KEY`（或 `DEEPSEEK_API_KEY` / `ANTHROPIC_API_KEY` 等，取决于所选 provider）。自定义 baseUrl（如本地 Ollama `http://localhost:11434/v1`）通过 `createProvider({ baseUrl })` 注册。
- **遥测（可选）**：`@raindrop-ai/pi-agent` 需 `RAINDROP_WRITE_KEY`，不设则禁用仅打 warning，不影响功能。
- **跨域**：后端 `app.enableCors()` 当前允许所有源；前端设 `VITE_API_BASE_URL=http://localhost:3000/api` 即可。若前端跑在别的域，确认 CORS 放行。
- **鉴权**：当前无任何 guard。若后续要登录态，需前后端约定 `Authorization` 头（前端在 `src/api/client.ts` 加 header）。

---

## 5. 联调验证

1. 起后端：`cd apps/api && node dist/main.js`（先 `prisma generate` + `prisma db push` 确保 `Resource` 表存在）。
2. 起前端：`vite`，构建环境变量 `VITE_API_BASE_URL=http://localhost:3000/api`。
3. 用例：
   - AI 助手发消息 → 应返回 `data.reply` 并渲染。
   - 「生成组件」→ 应返回 `data.code` 代码串。
   - 模型管理：新增/编辑/删除 → CRUD 成功。
   - 机器人：增删改查成功。
4. 验证统一信封 `{ code: 0, data, message: 'ok' }`。

---

## 6. 风险与待确认（决策点）

- **A. 先非流式还是直接上 SSE？** 建议先非流式打通（2.1），再上流式（2.3）——降低联调复杂度。
- **B. models/bots 存 `Resource` 表还是新建 Prisma 表？** 建议 `Resource`（零迁移）；若要强类型再建表。
- **C. 会话历史是否持久化？** `pi-agent` 的 `state` 在内存，跨请求不保留。若要历史会话，后端需加 `AiSession`/`AiMessage` 或复用 `Resource`。
- **风险**：`pi-agent-core` 是第三方包，事件结构以 `node_modules/.../dist/*.d.ts` 为准；**provider key 必须经后端代理，绝不能放前端**（浏览器读不到 `process.env` 且泄露风险高）。

---

## 7. 推荐执行顺序

1. 后端：创建 `AgentModule`（service + controller + DTO），实现 `POST /api/ai/chat` 与 `/api/ai/generate`，注册进 `AppModule`。
2. 后端：`.env` 补 provider key，本地起服验证 `/api/ai/chat` 返回信封正确。
3. 前端：设 `VITE_API_BASE_URL` 联调，确认 AI 助手/生成组件跑通（零改动）。
4. 后端：`/api/aiModels`、`/api/aiBots` CRUD（Resource 表）。
5. 前端：模型管理 / 机器人页面联调。
6.（可选）后端 SSE + 前端流式；前端接入 `aiPredict/aiRecommend/aiAnalyze`。
