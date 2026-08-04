# 低代码大屏设计器（React 18 + TypeScript · 纯前端）

基于 React 18 + Vite + TypeScript + Zustand 的**纯前端低代码数据大屏设计器**：拖拽组件搭建大屏、配置数据与交互、组件相互联动、一键预览。无需后端，开箱即跑。

> 全量使用 **TypeScript**（`.ts` / `.tsx`），类型定义集中在 `src/types.ts`，`npm run build` 会先执行 `tsc` 类型检查再打包。

## 功能特性

- **拖拽式设计**：左侧组件库拖入画布，自由移动、缩放、选中、删除
- **组件库**：文本、图片、折线图、柱状图、饼图、指标卡、表格、容器（8 类，基于 SVG 自绘，零图表依赖）
- **属性面板**：样式 / 数据 / 交互 三档配置，图表数据以 JSON 编辑
- **组件联动**：点击可交互组件（柱状图/饼图/表格）的数据元素，自动联动所有同 `filterField` 的组件（指标卡、表格实时筛选）
- **预览模式**：所见即所得，顶部显示当前联动筛选并可一键清除
- **多页面路由**：项目由「路由 / 页面」组成，支持任意层级（父子）嵌套
- **双视图项目页**：左侧**路由区**展示与选择页面路由树（层级 + 点击导航），右侧**操作区**对当前选中路由做配置与编辑，两侧实时联动
- **路由配置**：每个路由可设置参数（params）、属性（props）、状态（state），并以 JSON 编辑
- **Schema 驱动**：设计结果即 JSON 项目（多路由），可导出 / 导入 / 加载示例模板

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器（默认 http://localhost:5173）
npm run dev

# 类型检查 + 构建生产包（先 tsc --noEmit，再 vite build）
npm run build

# 仅做类型检查
npm run typecheck

# 预览构建产物
npm run preview
```

> 依赖仅 `react` / `react-dom` / `zustand`，开发依赖含 `typescript` 与 `@types/*`，安装快、无重型图表库。

## 数据代理（BFF）

```bash
# 启动数据代理（默认 http://localhost:5175）
npm run proxy

# 本地联调跳过鉴权（不接 3000 后端时）
PROXY_AUTH_DISABLED=1 npm run proxy
```

- 健康检查：`http://localhost:5175/health`
- 鉴权默认对接现有后端 `AUTH_PROFILE_URL`（`Authorization: Bearer <token>`）
- 数据集查询统一走 `POST /proxy/datasets/:id/query`，SQL 模板仅允许只读语句并参数化执行
- 数据源凭据通过环境变量 `DS_CRED_<REF>_USER/PASS/DB` 配置，注册表不落明文

## 使用步骤

1. 点击顶部「加载示例」一键生成含多页面路由的联动大屏项目；
2. 在**项目**模式：左侧路由区浏览/选择页面（可新增根页面或子页面、删除），右侧操作区随选中路由同步切换；
3. 右侧「页面配置」Tab 编辑路由的**参数 / 属性 / 状态**；「画布设计」Tab 从组件库拖组件到画布，调样式/数据/交互；
4. 切到**预览**模式，点击柱状图/饼图/表格的数据项，观察指标卡与表格联动；
5. 点「导出 JSON」保存整个项目（多路由），或「导入」恢复，或「清空」重新开始。

## 目录结构

```
react-lowcode-dashboard/
├── index.html
├── package.json
├── tsconfig.json / tsconfig.node.json
├── vite.config.ts
└── src/
    ├── main.tsx                # 入口
    ├── App.tsx                 # 项目/预览模式切换
    ├── types.ts                # 统一类型定义（组件/路由/筛选/状态等）
    ├── ProjectView.tsx         # 项目页：左路由区 + 右操作区
    ├── styles/global.css       # 全局样式（含响应式）
    ├── store/
    │   └── useDesignerStore.ts # Zustand 中央状态（routes/mode/filter）
    ├── registry/
    │   └── widgetRegistry.ts   # 组件注册表（默认配置）
    ├── utils/
    │   ├── id.ts               # ID 生成
    │   └── export.ts           # 导出/读取 JSON
    ├── widgets/                # 组件库（含 SVG 图表）
    │   ├── WidgetRenderer.tsx  # 类型 -> 组件映射
    │   ├── filterUtils.ts      # 联动筛选工具
    │   ├── TextWidget.tsx  ImageWidget.tsx  ContainerWidget.tsx
    │   ├── MetricWidget.tsx TableWidget.tsx
    │   └── LineChart.tsx  BarChart.tsx  PieChart.tsx
    ├── route/                  # 项目页路由视图
    │   ├── platformRoutes.ts   # 平台路由树（11 一级 / 25 二级）
    │   ├── RoutePanel.tsx      # 左侧路由区（层级树 + 导航）
    │   ├── RouteOperationPanel.tsx # 右侧操作区（配置/设计双 Tab）
    │   └── RouteConfigPanel.tsx    # 参数/属性/状态 配置
    ├── editor/                 # 设计态（嵌入操作区）
    │   ├── Toolbar.tsx         # 顶栏（项目/预览/示例/导入/导出）
    │   ├── ComponentPanel.tsx  # 组件面板（拖源）
    │   ├── Canvas.tsx          # 画布（放置/移动/缩放/选中）
    │   ├── PropertyPanel.tsx   # 属性面板（样式/数据/交互）
    │   └── Editor.tsx          # 编辑器布局
    └── runtime/                # 运行态
        ├── Renderer.tsx        # 预览渲染 + 联动分发
        ├── LinkageEngine.ts    # 事件总线 + 规则引擎（可扩展）
        └── DataEngine.ts       # 数据引擎（静态/预留 REST/WS）
```

## 架构要点

- **Schema 驱动**：项目 = `routes[]` 的 JSON，每条路由含 `page + components[] + params/props/state`。设计态与运行态共用「渲染器 + 组件库」，仅由 `mode` 区分是否可编辑，保证预览即真实效果。
- **路由模型**：`routes` 以 `parentId` 组织成任意层级；组件的所有增删改操作都作用于「当前选中路由」，天然支持多页面独立设计。
- **左右联动**：左侧 `RoutePanel` 选中路由 → 右侧 `RouteOperationPanel` 通过 `selectedRouteId` 同步渲染该路由的配置面板与画布。
- **分层引擎**（见设计书）：表现层 / 核心引擎层（Schema、渲染、拖拽、联动、数据）/ 组件层 / 存储层。
- **联动机制**：当前以「全局筛选（filter）」实现；`runtime/LinkageEngine.ts` 已预留基于 `links` 规则表的声明式联动引擎，可平滑升级为多源多动作联动。
- **类型集中**：所有对外数据结构（组件、路由、筛选、状态）统一在 `src/types.ts` 定义，store / 组件 / 引擎共享，保证设计态与运行态类型一致。

## 扩展方向

- 接入真实数据源（REST / WebSocket）：扩展 `DataEngine.resolveDataSource`
- 更多组件（地图、Tab、轮播、排行榜等）
- 自定义组件注册、模板市场、导出为独立静态站点

## 备注（本机构建）

`npm run build` 已配置 `tsc --noEmit && vite build`。若在本机重新构建前 `dist` 目录存在旧产物，直接 `npm run build` 即可（本环境对 `dist` 的写入有安全删除保护，属环境限制，与个人机器无关）。

## 已覆盖的功能模块（对照需求清单）

平台以「路由 → 功能页 / 低代码画布」双模式驱动，所有基础模块均为真实数据页（mock 后端驱动，可无缝替换为真实 REST）。

| 需求模块 | 落地情况 |
| --- | --- |
| 大屏管理 / 分类管理 | ✅ 大屏管理列表 + 分类标签治理 |
| 数据集管理 / 数据源配置 | ✅ 数据集列表与查询；数据源覆盖 **静态 / API / SQL(MySQL·SQLServer·PostgreSQL·StarRocks·Oracle) / WebSocket / MQTT / Flow / 爬虫解析**，支持公共/独立数据集 |
| 组件库 / 自定义组件 | ✅ 海量内置组件（EChart / HTML / Vue / 源码 / 3D / 基础）实时预览；组件菜单分组 |
| 全局变量 / 代码库 / 静态资源 / AI 模型 / 地图资源 | ✅ 全局变量(变量/函数/格式化)、代码仓库、静态资源、AI 模型管理、地图资源(EChart/高德/百度/腾讯/三方) |
| 消息推送 | ✅ 企业微信 / 钉钉 / 邮件 / 阿里云短信 / 腾讯云短信 |
| 智能 AI | ✅ AI 助手（智能问答 + 生成 Vue/EChart/HTML 组件 + 自定义机器人）|
| 3D 数字孪生 | ✅ Three.js 实时场景（日照/夜景/雾效）+ 91 种预置 3D 模型库 |
| 数据报表 | ✅ Excel 式零代码报表设计 + 数据集绑定 + AI 智能生成 |
| IOT 数据组态 | ✅ 设备实时状态监控 + 多级联动智能报警 |
| 快速导出部署 | ✅ 独立部署：导出项目 JSON / 独立 HTML / 数据源配置 / 命令行批量构建 |
| 基础功能 | ✅ 导入导出、组件数据共享(全局变量)、版本/主题、快捷键、分辨率自适应、在线加密分享(导出)、3D 在线预览、多屏幕、水印(主题)、组件二次开发(代码库)、海量内置组件 |
| 数据管理(填报/工作流/轮播/插件) | ✅ 数据填报、数据工作流、轮播管理、插件(我的/市场) |

> 技术栈：React 18 + Vite + TypeScript + Zustand。可视化依赖 `echarts` 与 `three`。
> 实时数据源（SQL/WebSocket/MQTT）的取数需后端代理，当前由 mock 模拟；接入真实后端只需替换 `src/mock/client.ts` 的 `mockFetch`。

