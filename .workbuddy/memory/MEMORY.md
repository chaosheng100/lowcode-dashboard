# 项目长期笔记：react-lowcode-dashboard

## 入口与路由约定（重要）
- `src/App.tsx` 默认落地页 = `ProjectView`：**左侧路由树 `RoutePanel` + 中间内容区 `RouteOperationPanel`**，数据来自 localStorage（`useDesignerStore` + `initPersist()`）。这是用户日常「路由 + 内容区」工作视图。
- 后端大屏管理列表仅在 `?screens=list` 时进入 `ScreenListPage`（调真实后端 `/api/screens`）。
- 编辑器/预览：`?mode=editor|preview&routeId=<id>&remote=true` → `RemoteWindowApp`（后端持久化）；无 `remote` → `WindowApp`（本地）。
- ⚠️ 切勿再把默认入口改成 `ScreenListPage`，否则用户会看不到路由树与内容区（2026-07-29 已因此报障并修复）。

## 关键架构事实
- `RoutePanel` / `ProjectView` 走本地 store（localStorage），不依赖后端；用户路由数据默认安全。
- `src/api/screenAdapter.ts` 用 `Record<string,unknown>` 桥接 `route↔config` 的 thumbnail/state，不依赖 `ScreenConfig` 类型上的扩展字段。
- 后端 `lowcode-dashboard-server`（NestJS+Prisma+SQLite）运行于 :3000，全局前缀 `/api`，已开 CORS；`screen.service.create` 对缺省 projectId 自动建项目。
- 前端 `src/mock/client.ts` 的 `mockFetch` 已改写为真实请求（走 `src/api/client.ts` 的 `request()`），`api` 对象调用方无感；base=VITE_API_BASE_URL||http://localhost:3000/api。

## 死代码（无人 import）
- `src/management/DashboardManagement.tsx`、`src/ProjectView.tsx` 中引用的旧本地大屏管理逻辑。统一大屏管理可并入 `ScreenListPage` 或删除。
