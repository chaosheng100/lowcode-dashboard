---
name: ai-style-control
description: 让 AI 生成/迭代大屏时能够控制组件的 style（位置尺寸 x/y/w/h）
status: done
started: 2026-08-01
completed: 2026-08-01
metadata:
  type: task
  area: ai
---

# AI 支持修改组件 style（位置尺寸）

## 背景
用户反馈「AI 只能改 context，改不了 x/y/w/h 和样式属性」，特别是迭代时说「把标题挪到中间」但位置不变。

## 根因
1. **生成 prompt 禁令**：`buildDesignPrompt()` 明确写了「不要输出 style（坐标/尺寸由前端自动布局）」，AI 从不输出 style
2. **迭代语义歧义**：迭代模式 prompt 没区分「空间调整改 style / 属性调整改 props」，「挪到中间」被理解为文字 `align=center` 而不是组件 `style.x` 居中
3. 后端归一化和前端应用层本来就支持 style，是 AI 没输出

## 方案
后端两处修改：

### 1. 生成 prompt（`component-catalog.ts` `buildDesignPrompt()`）
- 删除「不要输出 style」禁令
- 增加画布规格（1920×1080，坐标系）
- 增加 style 字段格式说明
- 增加 5 条布局原则（分区、间距、主次、对齐、栅格参考）
- 组件列表增加默认尺寸提示
- JSON 示例中包含 style 字段

### 2. 迭代 prompt（`agent.service.ts` `designSSE()` baseSchema 分支）
- 明确：空间调整改 style，属性调整改 props
- 3 个 few-shot 示例（挪到中间 / 调大 / 移到右边）
- 特别澄清：`align=center` 是文字居中，不是组件居中
- 允许保留组件 id（迭代时标识对应组件）
- 强调「只改提到的部分，不要重排整个布局」

## 结果 & 经验
- 修改文件：`apps/api/src/agent/component-catalog.ts`、`apps/api/src/agent/agent.service.ts`
- 链路验证：模拟 AI 带 style 输出 → normalize → review → style 完整保留
- 经验：prompt 中「明确禁止」的指令会被 AI 严格遵守，要先解除禁令再教方法；迭代场景下语义歧义是大问题，few-shot 示例比抽象描述有效得多
