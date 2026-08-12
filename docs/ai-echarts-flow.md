# AI ECharts 组件链路

## 目标

把 AI 助手生成的 ECharts 图表沉淀为组件中心资产，再组合投放进大屏编辑器，形成一条可复用、可版本管理、可绑定数据的完整链路。

## 链路

```text
AI 助手生成 ECharts option JSON
→ 组件中心保存（kind=echarts + optionJson）
→ 组件库/组件面板展示
→ 投放或拖入大屏（echartCustom 组件）
→ 属性面板绑定数据集/实时源
→ ECharts 渲染
```

## 使用步骤

1. 打开 AI 助手，选择 ECharts，输入图表描述并生成。
2. 生成成功后页面会用本地 ReactECharts 预览，并自动提取 `option`。
3. 点击“登记到组件中心”，资产以 `kind=echarts` 保存。
4. 打开组件库，ECharts 资产会出现在网格中并展示真实图表预览。
5. 点击“投放到大屏”或直接在编辑器左侧“AI ECharts”分组拖入画布。
6. 选中图表，在属性面板“数据”Tab 绑定数据集或实时源，图表随数据刷新。

## 关键实现

- `src/features/aiEcharts.ts`：从 AI 返回的 JS 代码中提取纯对象 `option`，不做任意代码执行。
- `src/features/AIAssistantPage.tsx`：ECharts 生成预览与资产登记。
- `src/features/ComponentLibrary.tsx`：ECharts 资产列表、预览与投放。
- `src/data/registry/componentAssetRegistry.ts`：AI ECharts 组件实例创建与投放合并。
- `src/designer/widgets/EChartWidget.tsx`：`echartCustom` 渲染，并把绑定数据注入系列和分类轴。
- `src/designer/editor/ComponentPanel.tsx`：编辑器左侧 AI ECharts 拖拽入口。
- `apps/api/src/catalog/catalog.controller.ts`、`catalog.service.ts`：组件中心 CRUD、版本、生命周期、统计接口。

## 兼容性

- 旧版 `echartCustom` 组件没有 `optionJson` 时仍走原逻辑。
- AI 生成的 `option` 如无法解析，自动回退到 iframe 预览，不影响保存代码。
- 数据绑定只覆盖常见柱/线/散点/饼图系列；复杂 option 可直接编辑 `optionJson`。

## 验证

- 前端：`npm run typecheck`、`npm run build`
- 后端：`npx nest build`
- 接口：组件创建、列表、统计、版本、生命周期、删除
- 浏览器：AI 生成 → 组件库 → 投放/拖入 → 绑定数据 → 发布
