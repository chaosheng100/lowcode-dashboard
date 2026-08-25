# CLAUDE.md

## 项目身份

`react-lowcode-dashboard` 是低代码大屏设计器平台的前端应用：React 18 + TypeScript + Vite + Zustand + Ant Design，包含大屏设计器、数字孪生、数据报表、IoT、AI 助手和平台管理页。后端在 `H:\Project\code\lowcode-dashboard-server`。

## 最高优先级指令

**UI 按苹果美术水平设计。** 这是项目的硬性要求：每个页面、组件、弹层、AI 生成的大屏都必须呈现 Apple 级视觉质量。实现前先看 `src/styles/global.css` 与 `src/main.tsx` 的设计令牌，不要另起一套视觉体系。

## 设计基线

### 核心值

- 清晰（Clarity）：信息层次分明，标题、副标题、次要说明分级。
- 克制（Deference）：内容优先，界面让位于数据与操作。
- 深度（Depth）：用半透明面板、毛玻璃、层次阴影形成空间感，不滥用渐变和装饰。

### 颜色与字体

- 背景：`#f5f5f7` / 深色 `#1c1c1e`
- 主色：`#0071e3`（浅色）、`#0a84ff`（深色/高亮）
- 正文：`#1d1d1f`；次要：`#6e6e73`；弱化：`#86868b`
- 功能色：成功 `#34c759`、警告 `#ff9500`、危险 `#ff3b30`
- 字体：`-apple-system, BlinkMacSystemFont, "SF Pro Text", "PingFang SC", "Segoe UI", "Microsoft YaHei", sans-serif`

### 布局

- 8pt 间距体系（4/8/12/16/24）
- 圆角：6/8/12px，卡片级 12px 以内，按钮 8-10px
- 面板半透明 + `backdrop-filter: blur(...)`
- 工具型界面使用紧凑高度：顶栏 40-52px，控件 34px，行高克制的表格

## 常用命令

```bash
npm run dev
npm run typecheck
npm run build
npm run preview
npm run proxy
```

端口约定：前端 5173，后端 3000，数据代理 5175。Vite 同源代理配置在 `vite.config.ts`。

## 架构地图

### 应用入口

`src/main.tsx`：ConfigProvider（Apple 主题 token）+ HashRouter + AntApp。

`src/App.tsx`：路由分派：

- `?screens=list` -> `ScreenListPage`
- `?mode=editor|preview&routeId=<id>&remote=true` -> `RemoteWindowApp`
- `/register` -> 注册页
- 无 token -> 登录页
- 其他 -> `ProjectView` 主应用

### 核心目录

| 目录 | 职责 |
| --- | --- |
| `src/designer/` | 设计器：编辑器、组件面板、画布、属性面板、运行时 |
| `src/features/` | 平台功能页与 AI 能力 |
| `src/twin/` | 3D 数字孪生 |
| `src/data/` | 类型、Zustand store、注册表、路由模型 |
| `src/api/` | 后端大屏接口与独立窗口 |
| `src/auth/` | 登录、注册、权限、token 刷新 |
| `src/mock/` | 本地 mock API |
| `src/router/` | 动态路由与 KeepAlive |

## 关键规则

### 路由

- 使用 HashRouter，查询参数放在 `location.hash` 的 `?` 后。
- `AppRouter.tsx` 同时是 URL 与 store 的同步边界；不要在业务组件里手写导航逻辑。
- KeepAlive 最大 10 个页面，超出 LRU 淘汰。

### 设计器

- 大屏 Schema 统一在 `src/data/types.ts`。
- 组件渲染：`WidgetRenderer` 按 `type -> 组件` 映射，`widgetRegistry` 提供默认配置。
- 设计态与运行态共用渲染器，只以 mode 区分可编辑性。
- 新组件必须注册到 `widgetRegistry`，并尽量同步后端 `ComponentMeta`。

### AI 设计

- 后端流式事件：`delta`、`intent`、`data`、`review`、`schema`、`done`、`error`。
- 只把 `schema` 事件交给 `applyAISchema()`；其他事件用于展示或日志。
- AI 可以输出 `style: { x, y, w, h }`；应用时必须保留，不得丢弃。
- 迭代修改时空间调整改 style、属性调整改 props。

### 后端联调

- 大屏管理接口需要 token；登录态由 `auth/store.ts` 维护。
- `RemoteWindowApp` 从 hash 读 `remote`，不走本地持久化，避免污染 store。
- `vite.config.ts` 已配置 `/api`、`/socket.io` 到 3000，`/proxy`、`/health`、`/stream` 到 5175。
- BFF 数据查询：`POST /proxy/datasets/:id/query`。

## UI 改动流程

1. 查看现有设计令牌与同类页面，保持视觉一致。
2. 优先复用 Ant Design 组件与现有样式类。
3. 新样式引用 CSS 变量；需要新增变量时先确认语义，不复制魔法值。
4. 使用 lucide/antd 图标，不用手绘 SVG（已有图标体系除外）。
5. 检查移动端溢出、长文本截断、滚动容器、弹层遮挡。
6. 运行 `npm run typecheck`；涉及构建产物运行 `npm run build`。

## 测试与验证

- 前端改动至少执行 `npm run typecheck`；需要验证构建产物时再执行 `npm run build`（按全局约束不主动打包）。
- 涉及后端发布、回滚、运行时缓存、组件中心/AI 组件调整的改动，必须执行后端冒烟测试：Windows 用 `D:\Git\bin\bash.exe scripts/e2e-smoke.sh`，验收标准为 14 项通过、exit 0。
- 后端冒烟前若默认审批策略为 `required: true`，先临时改为 `required: false`，跑完恢复原值；失败中道退出会遗留“冒烟测试大屏”与 `smoke-*` 项目，测试后必须清理。

## 工作规范

- 不覆盖用户未提交改动。
- 不提交日志、`dist`、`.build_tmp` 等生成物。
- 保持改动聚焦；大范围视觉统一先确认范围再执行。
- 代码可读性优先：命名表意、逻辑直白、结构清晰，避免晦涩的简写与过度嵌套；新代码优先复用既有模式，不引入无必要的抽象。
- 项目记忆在 `.claude/memory/`，关键坑位（滚动、路由、AI schema）应更新。
