# AGENTS.md

## 项目身份

`react-lowcode-dashboard` 是「低代码大屏设计器」的前端应用：React 18 + TypeScript + Vite + Zustand + Ant Design，覆盖大屏设计器、数字孪生、数据报表、IoT 组态、AI 助手、平台管理页等能力。后端 API 由相邻仓库 `H:\Project\code\lowcode-dashboard-server` 提供。

## 最高优先级：苹果美术级 UI

所有界面、组件、页面、交互和 AI 生成的大屏都必须按苹果美术水平设计与实现。这是项目级硬性要求，不是可选风格。

### 视觉原则

- Apple HIG 三原则：**Clarity（清晰）、Deference（克制）、Depth（层次）**。
- 浅色为主，浅灰分层（`#f5f5f7` 系），克制的系统蓝（`#0071e3` / `#0a84ff`），正文 `#1d1d1f`，次要文字 `#6e6e73`。
- 使用系统字体栈：`-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", ...`，文字清晰抗锯齿。
- 间距采用 8pt 体系；圆角克制（6/8/12px 级别，卡片不超过 12px，按钮 8-10px）。
- 面板使用半透明毛玻璃分层（`backdrop-filter` + 低透明度白色），深色主题下使用系统深色灰阶。
- 动效克制：150-250ms 缓动，优先透明度/位移/阴影，尊重 `prefers-reduced-motion`。

### 设计令牌（唯一真相源）

- `src/main.tsx`：Ant Design ConfigProvider 的 Apple 主题 token。
- `src/styles/global.css`：全局 CSS 变量（`--bg`、`--panel`、`--txt`、`--accent`、`--r-*`、`--sp-*`、`--ease` 等）。
- 禁止散落硬编码颜色、字体、圆角；新样式必须引用现有令牌。
- 新页面优先复用 `features/features.css`、`management/DashboardManagement.css` 中的既有组件级样式。

### UI 交付检查清单

每次新增或修改 UI 后自检：

- 层级清晰：主次分明，页面标题、操作、内容有明显视觉权重差异。
- 对齐精确：列表、表单、按钮、卡片遵循同一网格与 8pt 间距。
- 信息密度：工具型页面克制装饰，突出数据与操作；不做营销式大卡片堆叠。
- 文本不溢出：按钮、标签、表格、卡片在窄屏不截断、不重叠、不换行破坏布局。
- 响应式：桌面/平板/手机均可用，弹层不遮挡关键操作，表格与工具条窄屏可滚动或收拢。
- 可访问性：`:focus-visible` 焦点可见，对比度达标，动效可关闭。
- 状态完整：加载、空态、错误、禁用、成功都有明确呈现。

## 技术栈

- React 18 + TypeScript 5 + Vite 5
- React Router（HashRouter）+ KeepAlive 路由缓存
- Zustand（`src/data/store/useDesignerStore.ts`、`src/auth/store.ts`）
- Ant Design 5/6 + @ant-design/icons
- ECharts（图表）、Three.js / React Three Fiber（3D 数字孪生）
- @dnd-kit（拖拽）、socket.io-client（实时）、axios（API）
- 本地 BFF 代理：`server/proxy-server.mjs`（Express + WebSocket）

## 常用命令

```bash
npm run dev          # Vite dev server，默认 http://localhost:5173
npm run typecheck    # tsc --noEmit
npm run build        # typecheck + vite build
npm run preview      # 预览构建产物，默认 4173
npm run proxy        # 数据代理 BFF，默认 5175
npm run model:obj2gltf
```

联调时后端跑在 `:3000`，数据代理跑在 `:5175`。Vite 已配置同源代理：`/api`、`/socket.io` -> 3000；`/proxy`、`/health`、`/stream` -> 5175。

## 目录地图

```text
src/
├── api/            # 后端大屏接口与 RemoteWindow（编辑器/预览独立窗口）
├── auth/           # 登录、注册、token 刷新、权限组件
├── data/           # 类型、store、注册表、路由模型、live client
├── designer/       # 低代码设计器：editor + widgets + runtime + window
├── features/       # 平台功能页（AI、报表、IoT、孪生、插件、管理页等）
├── twin/           # 3D 数字孪生：渲染、数据桥、场景、模型转换
├── management/     # 大屏管理列表等后台样式
├── mock/           # 本地 mock API
├── router/         # 动态路由 + KeepAlive
├── styles/         # 全局 Apple 设计系统
└── main.tsx        # Ant Design 主题入口
```

## 架构约定

- **Schema 驱动**：项目/大屏由 JSON Schema 描述，设计态与运行态共用组件渲染器。
- **类型集中**：对外数据结构集中在 `src/data/types.ts`（原 `src/types.ts` 目录已在演进），store、组件、引擎共享。
- **单向数据流**：通过 Zustand store 管理选中路由、设计 schema、筛选状态；URL 与 store 双向同步放在 `router/AppRouter.tsx`。
- **HashRouter**：`mode`、`routeId`、`remote` 等参数写在 hash 查询串中，禁止直接拼 pathname。
- **组件注册表**：`src/data/registry/widgetRegistry.ts` 与组件目录（后端 `ComponentMeta`）对齐，前端只做 `renderer -> React 组件` 映射。
- **AI Schema 应用**：`useDesignerStore.applyAISchema()` 是唯一入口，保证 style/props 合并、校验与撤销历史一致。

## AI 生成大屏

- 入口：`src/features/AIAssistantPage.tsx`，通过 SSE 调后端 `POST /api/ai/design`。
- 事件：`delta` / `intent` / `data` / `review` / `schema` / `done` / `error`。
- 只信任 `schema` 事件；`delta` 仅用于流式展示。
- `applyAISchema()` 应用时保留 `style.x/y/w/h`；空间调整由 AI 输出 style，属性调整走 props。
- 版本历史：`src/features/ai/aiGenHistory.ts`；预览：`AIDashboardPreview.tsx`。

## 后端边界

- 大屏管理、编辑器、预览已接入后端 `lowcode-dashboard-server`（需登录态）。
- 本地独立窗口参数：`?mode=editor|preview&routeId=<screenId>&remote=true`。
- 实时数据通过 `/socket.io` 或 `/stream` 代理；BFF 数据查询走 `/proxy/datasets/:id/query`。
- 切换真实后端只替换 API client 或环境变量，不散改业务组件。

## 测试与验证

- 当前无自动化前端测试配置；UI 改动至少执行 `npm run typecheck`（按全局约束验证时不主动打包，需要验证构建产物时再执行 `npm run build`）。
- 涉及后端发布、回滚、运行时缓存、组件中心/AI 组件调整的改动，必须执行后端冒烟测试：Windows 用 `D:\Git\bin\bash.exe scripts/e2e-smoke.sh`，验收标准为 14 项通过、exit 0。
- 后端冒烟前若默认审批策略为 `required: true`，先通过 `POST /api/governance/approval-policies` 临时改为 `required: false`，跑完恢复原值；失败中道退出会遗留“冒烟测试大屏”与 `smoke-*` 项目，测试后必须清理。
- 视觉改动建议在桌面与移动视口手动检查：文本溢出、滚动、弹层遮挡、深浅主题。
- 涉及 3D 场景时检查 WebGL 资源与模型加载、空态和错误态。

## 协作规则

- 保留用户未提交改动；不擅自回滚或覆盖。
- 不提交 `.dev-server.log`、`.proxy-server.log`、`dist`、`.build_tmp` 等生成物。
- UI 改动必须按「苹果级 UI 检查清单」自检，并在交付说明中体现。
- 代码可读性优先：命名表意、逻辑直白、结构清晰，避免晦涩的简写与过度嵌套；新代码优先复用既有模式，不引入无必要的抽象。
- 项目记忆位于 `.claude/memory/`，重大决策与坑位应同步更新。
