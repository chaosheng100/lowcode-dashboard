# 任务记忆

每个任务一个文件，记录任务的背景、目标、进展、结果。

## 文件命名
`YYYY-MM-DD-<slug>.md`，如 `2026-08-01-fix-scrollbar.md`

## 状态
- **active** — 进行中
- **done** — 已完成
- **archived** — 已归档（保留备查，非活跃）

## 模板
```markdown
---
name: <slug>
description: 一句话描述任务
status: active
started: YYYY-MM-DD
completed: YYYY-MM-DD  # 完成时填写
metadata:
  type: task
  area: <领域，如 ai/布局/认证/性能>
---

# 任务名称

## 背景
为什么要做这件事，问题是什么。

## 目标
完成标准是什么。

## 进展
- [ ] 子任务 1
- [x] 子任务 2（已完成）

## 方案
采用什么方案、为什么。

## 结果 & 经验
完成后填写：做了什么、遇到什么坑、下次注意什么、相关文件。
```
