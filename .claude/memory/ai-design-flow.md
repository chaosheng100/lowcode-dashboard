---
name: ai-design-flow
description: AI 生成/迭代大屏的数据流、prompt 构建、style 支持情况
metadata:
  type: project
---

# AI 生成大屏数据流

## 调用链路
`AIAssistantPage.runDesign()` → `api.aiDesign(prompt, opts)`（SSE）→ 后端 `POST /api/ai/design`

## SSE 事件类型
- `delta`：流式文本
- `intent`：结构化设计意图（Orchestrator）
- `data`：数据绑定结果（DataAgent，可选）
- `review`：结构校验与修复（ReviewAgent）
- `schema`：归一化后的最终 Schema
- `done` / `error`

## Schema 结构（AIDesignSchema）
```
{
  version: "1.0",
  page: { width, height, background },
  components: [
    { id?, type, style: {x,y,w,h}, props: {...} }
  ]
}
```

## AI 控制组件 style 的能力
- ✅ 生成时：AI 可输出 style 字段（prompt 中有明确要求 + 布局原则 + 5 条栅格指导）
- ✅ 迭代时：AI 可修改 style（迭代 prompt 中有明确区分「空间调整改 style / 属性调整改 props」+ 3 个示例）
- ✅ 后端归一化：`normalizeAndValidateSchema()` 完整支持 AI 传入的 style（默认值打底 + AI 值覆盖）
- ✅ ReviewAgent：只修越界/重叠，不会把 style 改回默认值
- ⚠️ 小模型可能忽略 style 指令，需要实际验证模型能力

## 迭代修改注意点
- 用户说「把标题挪到中间」= 改 `style.x`（组件在画布中水平居中），不是改 `props.align`（文字在组件内居中）
- 迭代 prompt 中有 few-shot 示例明确区分
- 迭代模式下 AI 保留组件 `id` 原样带回，前端可对应到原组件

## 版本管理
- 前端：`useGenHistory` hook（`src/features/ai/aiGenHistory.ts`）+ `AIAssistantPage` 维护多版本
- 后端：`ScreenVersion` 表（持久化版本快照），`screen/:id/versions` 接口

## 相关文件
- 前端入口：`src/features/AIAssistantPage.tsx`
- 前端预览：`src/features/ai/AIDashboardPreview.tsx`
- 前端版本历史：`src/features/ai/aiGenHistory.ts`
- 前端 store 应用：`src/data/store/useDesignerStore.ts` → `applyAISchema()`
- 后端主流程：`apps/api/src/agent/agent.service.ts` → `designSSE()`
- 后端 prompt 构建：`apps/api/src/agent/component-catalog.ts` → `buildDesignPrompt()`
- 后端迭代 prompt：`apps/api/src/agent/agent.service.ts` → `designSSE()` 中 baseSchema 分支
