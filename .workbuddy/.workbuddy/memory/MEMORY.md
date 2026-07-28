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

## 技术栈约定
- 运行时：managed node 22.22.2（C:\Users\潘超盛\.workbuddy\binaries\node\versions\22.22.2\node.exe）
- 类型检查：`node node_modules/typescript/bin/tsc --noEmit`
- 构建：`node node_modules/vite/bin/vite.js build`
- dev：`node node_modules/vite/bin/vite.js --port 5173 --host 127.0.0.1`
- mock 后端在 src/mock/*（替换 mockFetch 为 fetch 即可接真实后端）
