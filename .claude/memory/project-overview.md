---
name: project-overview
description: 前端项目整体架构、技术栈、关键模块速览
metadata:
  type: project
---

# 前端项目概览（react-lowcode-dashboard）

## 技术栈
- React 18 + TypeScript + Vite
- 路由：react-router-dom（HashRouter）
- UI：Ant Design 5.x（暗色主题 + 自定义 token）
- 状态管理：Zustand（useDesignerStore、useAuthStore）
- 样式：全局 CSS（`src/styles/global.css`）+ 各模块 CSS 文件
- AI SDK：pi-agent（通过 SSE 流式对接后端）

## 关键架构事实
- 应用使用 **HashRouter**，所有路由参数必须写在 `location.hash` 内（`#/?mode=editor&routeId=<id>&remote=true`），不能直接拼在 pathname 后。
- `window.open` 跳本应用页签时，参数必须写进 hash 查询串，否则新页签读不到。
- `App.tsx` 模块级解析 `remote` 开关也从 `location.hash` 取。
- 后端 `/api/screens/*` 无需鉴权；`ScreenListPage` 与 `remote=true` 的 editor/preview 窗口都绕过登录态。
- 大屏管理链路（list/create/editor/preview）依赖后端 `lowcode-dashboard-server`（:3000）。

## 主应用布局
- `ProjectView`：左侧路由面板（`.route-area`，272px） + 右侧操作区（`.operation-area`，`flex:1 + overflow:auto`）
- 右上角 `UserMenu` 浮层绝对定位（`top:12 right:16`），宽度 ≤160px
- `.mg-toolbar` / `.oa-head` 右侧预留 180px 内边距，避免被 UserMenu 遮挡

## 页面体系
- 功能页统一使用 `.feature-page` 类（`flex:1 + min-height:0 + overflow:auto`，定义在 `features/features.css`）
- 卡片网格页（大屏管理/部署/插件列表）使用 `.mg` 类（内部 `.mg-grid` 滚动）
- 独立页面（登录/注册/ScreenListPage）不在 ProjectView 内，由 `.ant-app { overflow:auto }` 兜底滚动

## 滚动条修复记录（2026-08-01）
- 问题：所有页面内容超出视图时没有滚动条
- 根因：`body{overflow:hidden}` + 高度链在 HashRouter/App 层断了，导致内外都不出滚动条
- 修复：
  1. `.ant-app > *, .ant-app > * > * { height: 100% }` —— 补全高度链
  2. `.ant-app { overflow: auto }` —— 全局滚动兜底（独立页面用）
- 文件：`src/styles/global.css`
