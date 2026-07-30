# lowcode-dashboard 项目长期记忆

## UI 体系（2026-07-28 迁移完成）
- 全站 UI 已迁移至 antd 6.5.2（ConfigProvider darkAlgorithm，主色 #00d4ff 青色科技风，zhCN locale）。
- `src/features/common.tsx` 是 antd 兼容封装层（Section/Field/Tag/Stat/Modal/Input/Select/Textarea），旧调用点零改动；新代码直接用 antd。
- 刻意不用 antd 的层：designer/widgets/*（画布渲染组件）、ComponentPanel（拖拽面板）、纯布局壳（ProjectView/Designer/Editor）。

## 项目定位
React 18 + Vite + TS + Zustand 的低代码大屏设计器，**以 Avue Data（Vue3 开源数据大屏，gitee smallweigit/avue-data）为蓝本**做 React 版复刻。功能模块清单与 Avue Data 完整产品一比一对应。

## Avue Data 关键事实（2026-07-28 调研）
- 开源版 avue-data v3.0.1 仅 7 条路由（layout + build + view），只有 AI助手/组件库/全局变量/静态资源 在开源版实现，其余 18 模块为 Pro/Plugin（源码未公开，流程细节未确认）。
- 编辑器核心机制（开源版确认）：
  - 自适应缩放：`transform:scale`
  - 组件注册：`import.meta.glob` 约定式自动扫描
  - 属性面板：AvueForm schema 驱动（非手写表单）
  - 组件实例引用：`refs[uuid]`
  - 联动：`window.$glob` 全局变量 + 属性面板写 JS（无可视化规则 UI）
  - 缩略图：`html2canvas` 真实截图
  - 开源版无完整 undo/redo
- 独立部署：导出独立工程（非单 HTML），仍需后端。

## 本项目相对 Avue Data 的差异/机会
- 已有：transform:scale 自适应（useFitScale）、显式 widgetRegistry、手写 PropertyPanel、全局 filter 联动、CSS 渐变缩略图（不更新）、单 HTML 独立部署（占位）。
- 缺口（对标 Avue Data 待补）：html2canvas 真实缩略图、约定式组件注册、schema 驱动属性面板、$glob 联动/可视化联动规则、undo/redo（avue 开源版也无，可作超越项）。

## 已知坑位（踩过必记）
- **antd `<App>` 包裹层高度塌缩**：`<AntApp>` 会在 `#root` 下注入 `<div class="ant-app">` 且默认无 height，使 `.win-app{height:100%}` 解析为 auto → 整条高度链塌缩、大屏预览空白。**根高度链必须包含 `.ant-app`**：`html, body, #root, .ant-app { height: 100% }`（已在 global.css 修复）。
- **flex 嵌套滚动铁律**：每一层 flex 容器（含最内层滚动容器）都必须 `min-height:0`（column）/ `min-width:0`（row），否则中间层 `min-height:auto` 撑长会让最内层 `overflow:auto` 永不触发。排查逐层检查，别只看最内层。

## 数字孪生模块重建设计（2026-07-29 定稿 + MVP 落地）
- 完整设计文档：`docs/digital-twin-redesign.md`（企业级能力调研 + 功能清单 + 与大屏深度融合架构）。
- 核心决策：把孤立的 `TwinPage` 3D 编辑器拆为"渲染内核(TwinRenderer)+可嵌入组件(TwinWidget)+运行时 store 共享(仿真/告警/控制)"；新增 `WidgetType='digitalTwin'` 与 `'twinAlarm'`，`TwinWidget` 嵌入画布 `comp-frame`，与大屏图表同屏（3D 宏观+2D 微观双轨）。
- 双向联动**零侵入复用现有 `filter`/`onPick` 引擎**：点孪生实体 emit filter→大屏过滤高亮；大屏筛选→`TwinRenderer.focusEntity/highlightEntity` 反向定位。`TwinDataBridge` 订阅 `liveClient` 实时源写实体属性+store 指标流。
- `TwinSim`(what-if/RUL/健康度) 输出预测流驱动大屏 KPI/告警，预留后端 ML 与闭环控制接口。

### MVP + 进阶 + 高级 已落地（2026-07-29，全部推进完成）
- 内核：`src/twin/TwinRenderer.ts`（设计文档里的 TwinEngine 角色由 TwinRenderer 兼担——既渲染又管实体增删改查/拾取/地面投射）；`twinTypes.ts`(实体/场景/遥测/预测/告警/控制/WhatIf 类型 + healthIndex/healthToState/ALARM_COLORS/CONTROL_LABELS)、`sceneFactory.ts`(演示工厂)、`TwinDataBridge.ts`(模拟/subscribeTwinLive **+ subscribeTwinSource 多源接入**)。
- 仿真：`src/twin/TwinSim.ts` — 健康指数/RUL/预测状态、预测性维护告警(去重)、`runWhatIf` 决策沙盘；`src/twin/twinRuntimeStore.ts` 跨组件共享 告警/预测/控制日志/数据源状态。
- 多源：`src/twin/sources/` — `TwinSource` 接口 + 工厂 + `SimulatedSource`(完整)/`IndustrialSource`(OPC-UA/Modbus 桩)/`BimSource`(BIM 布局)/`GisSource`(GIS 经纬度)，均带入真实集成点的注释。
- 闭环控制：`src/twin/control.ts` — `TwinControlHub.dispatch` → 执行器(默认 mock，预留后端代理) → 写指令日志。
- 组件：`TwinWidget.tsx`(嵌入画布 + 双向联动 + 仿真告警 + 决策沙盘 + 控制条 + 多源切换)、`AlarmListWidget.tsx`(读 store，摘要带+分级列表+点击反向定位)；`twinAlarm` 已全链路注册。
- 编辑器改造：`src/features/TwinPage.tsx` **复用 TwinSceneView 共享内核**（移除重复的 TwinRenderer 初始化/仿真/控制样板），保留拖拽/属性/关键帧，新增 仿真/控制/告警 面板与 liveSourceId 数据绑定。
- 注册：`types.ts`(digitalTwin+twinAlarm + 新 props: sourceKind/showControl/showSim/maxItems 等)、widgetRegistry、WidgetRenderer、propSchemas、PropertyPanel(interactiveTypes)、componentAssetRegistry(businessType='twin')。
- 示例：`/screen/overview` 种子嵌入 digitalTwin + twinAlarm，预览即见 3D+2D+告警 融合。
- 验证：tsc --noEmit 0 错误；vite build 通过(4628 模块)；headless 预览 DOM 含 `<canvas>` + 孪生告警清单 + 决策沙盘 + HUD。
- **场景库互通修复（2026-07-29 后续，用户反馈两 bug）**：根因——`TwinPage`(模块)用本地 state、`TwinWidget`(大屏)硬编码 `createDemoScene()`，两者各持独立场景 → ①模块与大屏孪生数据不互通 ②编辑数据无统一存储（切换路由即丢失/表现为残留）。修复：在 `useDesignerStore` 增加 `twinScenes: Record<string,TwinScene>`（默认 main=createDemoScene()）+ `activeTwinSceneId` + CRUD actions；`TwinPage` 编辑经 `updateTwinSceneEntities` 写回 store、`TwinWidget` 经 `props.sceneId`（默认 main）从 store 读取同一场景 → 互通 + 持久化（切换路由不丢）；`TwinPage` 卸载 `clearAlarms` 避免编辑期告警残留。`propSchemas`/`widgetRegistry` 已暴露 `sceneId` 配置（默认 'main'）。
- 待深化（非阻塞）：各源的**真实**协议接入(OPC-UA/Modbus 点位、IFC 解析、GIS 瓦片)、TwinSim healthModel 接后端 ML、control 执行器接 `proxy/control`、孪生按需懒加载(当前单 chunk 3.2MB)、TwinWidget 订阅 store 场景变化实时重建以做到"模块编辑→大屏秒级联动"。

## 技术栈约定
- 运行时：managed node 22.22.2（C:\Users\潘超盛\.workbuddy\binaries\node\versions\22.22.2\node.exe）
- 类型检查：`node node_modules/typescript/bin/tsc --noEmit`
- 构建：`node node_modules/vite/bin/vite.js build`
- dev：`node node_modules/vite/bin/vite.js --port 5173 --host 127.0.0.1`
- mock 后端在 src/mock/*（替换 mockFetch 为 fetch 即可接真实后端）

## 工作流偏好（用户 2026-07-30 明确）
- **只构建校验，不启动服务**：完成任务后**不要**启动后端/前端服务做冒烟测试或 curl 验证。仅靠 `tsc --noEmit` / `vite build` / `nest build` 校验语法与编译问题即可。
- 验证交付前如需运行验证，先征求用户同意；默认只跑静态检查。
