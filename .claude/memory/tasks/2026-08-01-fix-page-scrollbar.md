---
name: fix-page-scrollbar
description: 修复所有页面内容超出视图时没有滚动条的问题
status: done
started: 2026-08-01
completed: 2026-08-01
metadata:
  type: task
  area: 布局
---

# 修复页面超出视图无滚动条

## 背景
用户反馈「所有页面超出视图都没有滚动条」，内容超出时被裁切看不到。

## 根因
双层原因：
1. `body { overflow: hidden }` 锁死了页面级滚动
2. 高度链在 `HashRouter` / `App` 组件层断了 —— `.project-view { height: 100% }` 的父级（HashRouter 渲染的 div）高度是 auto，导致 100% 失效。结果是 `.operation-area` 高度随内容撑开，`overflow:auto` 永不触发；同时 body overflow:hidden，内外都没有滚动条。

## 方案
在 `src/styles/global.css` 中加两条规则：
1. `.ant-app > *, .ant-app > * > * { height: 100% }` —— 补全 HashRouter/App 层的高度链，让 `.project-view` 的 100% 能正确解析
2. `.ant-app { overflow: auto }` —— 给独立页面（登录/注册/ScreenListPage 等不在 ProjectView 内的页面）做滚动兜底

应用式布局（ProjectView）内部高度正好 = 视口，不会触发外层滚动；独立页面内容超高时由外层兜底。

## 结果 & 经验
- 修改文件：`src/styles/global.css`（2 处新增）
- 构建验证通过（`npx vite build` exit 0）
- 经验：flex 布局 + overflow:hidden 的应用式布局，必须确保高度链完整贯通，从 html/body 一路到内容区，任何一层断了都会导致「内容超出但没滚动条」
