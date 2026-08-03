---
name: ai-data-binding
description: AI 生成大屏时自动关联数据源、给组件绑定真实数据
status: active
started: 2026-08-01
completed: 
metadata:
  type: task
  area: ai
---

# AI 大屏数据关联

## 背景
当前 AI 生成大屏时，组件的 data 字段要么是 AI 生成的示例数据，要么是假数据。需要让 AI 能够理解用户的数据源，自动把大屏组件和真实数据源/数据集关联起来。

## 目标
梳理现有数据体系，设计并实现 AI 自动关联数据源的方案：
- AI 能感知有哪些数据源、数据集
- AI 生成组件时能自动匹配对应的数据
- 组件在运行时能拿到真实数据（而非写死的示例数据）

## 进展
- [x] 调研现状：组件数据格式、数据源管理、DataAgent 能力
- [x] 确定路线：分 5 步走，先做第 1+2 步（语义字段 + AI 自动匹配）
- [x] 第 1 步：数据集加语义字段元信息（业务名称、维度/指标类型、聚合方式）
- [x] 第 2 步：AI 生成时自动匹配数据集 + 字段映射（替代硬编码首列/第二列）
- [ ] 第 3 步（后续）：运行时动态拉取数据
- [ ] 第 4 步（后续）：AI 推荐图表类型
- [ ] 第 5 步（后续）：自然语言 SQL 生成

## 方案（2026-08-03 实施第 1+2 步）
前端侧与后端联动：
- **mock/types.ts**：`DatasetField` 改为语义结构（fieldKey/label/fieldType/semanticType/aggregation/format/sampleValues）；`DatasetDTO` 对齐后端（dataSourceId/sourceName/type/config/fields）
- **mock/api.ts**：新增 `getDataset` / `saveDataset` / `deleteDataset` / `listDataEngineSources`；`queryDataset` 改 body 传参；`aiDesign` 透传 `datasetId`
- **DatasetManagement.tsx** 增强：
  - 新建/编辑数据集（名称/描述/类型/数据源选择/静态数据粘贴）
  - 「解析并自动推断字段」：从 JSON 静态数据推断 fieldType/semanticType/aggregation/sampleValues
  - 字段语义表格（业务名称/维度指标/聚合方式/类型/格式），可手动调整
  - 数据预览列改用字段语义 label
- **AIAssistantPage.tsx**：数据源下拉改为「数据集」下拉，传 `datasetId`；绑定结果展示数据集名
- **DataEngine.ts** / ResourcePanel / PropertyPanel 保持 `queryDataset` 消费，兼容

## 结果 & 经验
- 前端 `vite build` 通过；后端 `tsc` 通过
- ⚠️ 后端数据库不可达（`59.110.241.244:3306`），Dataset/DatasetField 表 migration 未 apply；需恢复后执行 `npx prisma migrate deploy` 才能联调
- 经验：mock 层已全部转发真实后端，接口契约必须与后端 dataset 模块逐字段对齐（返回形状、字段名、query 传参方式）
