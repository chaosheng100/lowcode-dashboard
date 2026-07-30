# 项目长期笔记：react-lowcode-dashboard

## 入口与路由约定（重要）
- `src/App.tsx` 默认落地页 = `ProjectView`：**左侧路由树 `RoutePanel` + 中间内容区 `RouteOperationPanel`**，数据来自 localStorage（`useDesignerStore` + `initPersist()`）。这是用户日常「路由 + 内容区」工作视图。
- 后端大屏管理列表仅在 `?screens=list` 时进入 `ScreenListPage`（调真实后端 `/api/screens`）。
- 编辑器/预览：`?mode=editor|preview&routeId=<id>&remote=true` → `RemoteWindowApp`（后端持久化）；无 `remote` → `WindowApp`（本地）。
- ⚠️ 切勿再把默认入口改成 `ScreenListPage`，否则用户会看不到路由树与内容区（2026-07-29 已因此报障并修复）。

## ⚠️ HashRouter URL 约定（高频踩坑）
- 应用使用 **HashRouter**（`src/main.tsx`）。所有路由参数必须写在 `location.hash` 内，形如 `#/?mode=editor&routeId=<id>&remote=true`，**不能用 `?mode=...` 直接拼在 pathname 后**（HashRouter 下 `window.location.search` 永远为空，`useLocation().search` 只认 hash 里的查询串）。
- `window.open` 跳本应用页签并需携带参数时（如 `ScreenListPage.openEditor/openPreview`、`designer/window.ts` 的 `openEditorWindow/openPreviewWindow`），都必须把参数写进 hash 查询串，否则新页签读不到 `mode/routeId/remote`，会错误落到默认视图或登录页。
- `App.tsx` 模块级解析 `remote` 开关也必须从 `location.hash` 取（同因）。
- 后端 `/api/screens/*` 无需鉴权；`ScreenListPage` 与 `remote=true` 的 editor/preview 窗口都应绕过登录态（`App.tsx` 已处理），本地 `WindowApp`/`ProjectView` 才需要登录。

## 关键架构事实
- `RoutePanel` / `ProjectView` 走本地 store（localStorage），不依赖后端；用户路由数据默认安全。
- `src/api/screenAdapter.ts` 用 `Record<string,unknown>` 桥接 `route↔config` 的 thumbnail/state，不依赖 `ScreenConfig` 类型上的扩展字段。
- 后端 `lowcode-dashboard-server`（NestJS+Prisma+SQLite）运行于 :3000，全局前缀 `/api`，已开 CORS；`screen.service.create` 对缺省 projectId 自动建项目。
- **后端会自行崩溃**，前端大屏管理（list/create/editor/preview）整条链路依赖它。重启步骤：`cd H:/Project/code/lowcode-dashboard-server/apps/api` → `node_modules/.bin/tsc -p tsconfig.json`（避免 `nest build` 的 safe-delete 超时）→ `node dist/src/main.js`（cwd=apps/api）。Prisma client 通常已生成（`node_modules/@prisma/client/default.js` 存在则无需 `prisma generate`）；若该文件缺失且报 prisma client 错误，先 `rm -rf node_modules/.prisma node_modules/@prisma/client` 再 `node_modules/.bin/prisma generate`。排障先用 `curl -s -m5 -o /dev/null -w "%{http_code}" http://localhost:3000/api/screens` 确认在线。
- 前端 `src/mock/client.ts` 的 `mockFetch` 已改写为真实请求（走 `src/api/client.ts` 的 `request()`），`api` 对象调用方无感；base=VITE_API_BASE_URL||http://localhost:3000/api。

## 死代码（无人 import）
- `src/management/DashboardManagement.tsx`、`src/ProjectView.tsx` 中引用的旧本地大屏管理逻辑。统一大屏管理可并入 `ScreenListPage` 或删除。
