# 数字孪生模块重建设计（企业级能力 + 与数据大屏深度融合）

> 范围：基于现有 lowcode-dashboard（React18 + Vite + TS + Zustand 低代码大屏设计器）对数字孪生模块做能力对标与架构重设计。
> 目标：把"一个能摆模型的 3D 编辑器"升级为"企业级数字孪生 + 大屏协同"的双轨体系。
> 配套结论：调研（任务2-1）、功能清单（任务2-2）、融合架构（任务2-3）。

---

## 一、企业级数字孪生核心能力调研结论

综合优锘 ThingJS、xun188 数字孪生平台、freedoonline PaaS、Mastek 七层架构、MindInventory 构建方法论，以及百度智能云/帆软/如视的大屏融合实践，企业级数字孪生的共性能力可抽象为 **"一个闭环、五层架构"**：

### 1.1 一个闭环（核心范式）
```
物理实体(传感器/PLC/视频)  ──上行──▶  数字孪生体(几何+机理+数据驱动模型)
        ▲                                 │
        │──下行(控制指令/反向驱动)──       ▼
   物理世界状态改变  ◀──  仿真推演 / AI 决策 / 告警处置
```
关键不是"3D 模型好看"，而是 **虚实双向实时映射 + 仿真预测 + 闭环控制**。几乎所有领先厂商都强调：孪生体操作可反向驱动物理设备（如远程启停、参数下发）。

### 1.2 五层参考架构（行业对齐）
| 层 | 名称 | 核心职责 | 本项目现状 |
|----|------|---------|-----------|
| L1 | 感知/接入层 | 多源异构数据接入：OPC UA / Modbus / MQTT / BACnet / 视频 / GIS / BIM；边缘网关、协议适配 | 有 `liveClient` 代理（SQL/WS/MQTT），但未接入孪生 |
| L2 | 数据层 | 时序库、流式计算(Kafka/Flink)、数据清洗、特征工程、数据资产目录 | 有 `DataEngine.resolveDataSource` + mock，缺时序/流式 |
| L3 | 模型层 | 3D 几何建模(BIM/GIS/CAD)、机理模型、数据驱动/ML 模型、模型融合与校准 | 有 Three.js 基元几何 + 91 预置模型库，**无数据/机理绑定** |
| L4 | 仿真层 | 物理引擎行为仿真、What-if 场景推演、有限元/CFD、预测性维护(RUL) | 有关键帧动画（展示用），**无仿真/预测计算** |
| L5 | 决策/应用层 | AI 决策引擎、预测预警、智能优化、闭环控制指令下发 | 无 |
| V  | 可视化/体验层 | 3D 仪表盘、AR/VR、空间计算、与大屏协同 | 有独立 `TwinPage` 3D 编辑器，**与大屏割裂** |

### 1.3 大屏融合的共识（来自百度/帆软/如视/亚秀）
- **2D 大屏与 3D 孪生不是替代，而是"双轨协同"**：三维场景承担**宏观全域空间管理**（在哪、是什么、空间拓扑），2D 大屏承担**微观业务指标运维**（参数多少、阈值、趋势、告警详情）。
- **双向数据链路是融合关键**：
  - 三维场景点击实体 → 联动弹出该实体的 2D 指标面板（运行数据/告警/趋势曲线）；
  - 2D 大屏告警事件 → 反向联动三维场景，异常实体**空间高亮定位**，形成"告警溯源→空间定位→详情查看→闭环处置"。
- **仿真推演进大屏**：大屏以"三维动画 + 数据动态变化"实时呈现处置流程（应急调度路径、疏散路线、产线停机/重启逻辑），并支持"决策沙盘"——拖拽参数实时查看结果。

---

## 二、企业级数字孪生关键功能清单（对标基线）

按五层架构梳理，作为模块重构的功能 checklist（✅=现状已有，⬜=待建）：

### L1 感知/接入层
- [✅] 静态/API/SQL/WebSocket/MQTT 数据源（经 `liveClient` 代理）
- [⬜] 工业协议原生接入（OPC UA / Modbus / BACnet）与边缘网关抽象
- [⬜] 视频流 / GIS / BIM / 点云 多源空间数据接入
- [⬜] 数据质量校验（异常检测、漂移监控、校验后再上行）

### L2 数据层
- [✅] `resolveDataSource` 拉取 + mock 抖动模拟实时
- [⬜] 时序数据库抽象（InfluxDB 类）+ 历史趋势回放
- [⬜] 流式计算 / 特征工程（KPI 派生、聚合窗口）
- [⬜] 数据资产目录（实体↔数据源↔指标映射表）

### L3 模型层
- [✅] Three.js 场景 + 基元几何 + 91 预置模型库 + 拖拽放置/关键帧
- [⬜] **实体化孪生对象**：每个 3D 对象绑定 `dataSourceId` 与指标字段（温度/转速/健康度…）
- [⬜] 状态机/机理模型：正常/运行/待机/故障/离线 多状态映射（颜色/闪烁/弹窗）
- [⬜] 模型版本管理 + 校准（孪生体与物理实体同步演进）

### L4 仿真层
- [⬜] 物理/行为仿真：产线吞吐、能耗、流体/热等机理仿真
- [⬜] What-if 推演：参数调整 → 未来状态预测 → 大屏动态重算
- [⬜] 预测性维护：RUL 剩余寿命、故障提前预警（>95% 准确率行业目标）
- [⬜] 异常检测 / 健康度评分（实时驱动孪生体颜色与告警）

### L5 决策/应用层
- [⬜] 智能预警（阈值 + AI）与多渠道推送
- [⬜] 优化建议 / 自动调度（能耗↓15~30% 行业区间）
- [⬜] 闭环控制下发（孪生操作 → 物理设备指令）

### V 可视化/融合层（本设计重点）
- [✅] 独立 3D 编辑器（日照/夜景/雾效/时间轴）
- [⬜] **孪生组件（Twin Widget）嵌入数据大屏**（拖拽进画布，随画布缩放）
- [⬜] 孪生↔大屏**双向联动**（点击实体联动过滤 / 告警反向定位）
- [⬜] 仿真结果**驱动大屏动态展示**（KPI 卡、趋势图、告警清单实时变）
- [⬜] 决策沙盘（拖参实时看结果）

---

## 三、数字孪生模块功能架构重设计

### 3.1 设计目标
把孤立的 `TwinPage`（feature page）拆成 **"可复用内核 + 可嵌入组件 + 可联动中枢"** 三层：

```
┌──────────────────────────────────────────────────────────┐
│ 应用/可视化层 (Dashboard Fusion)                            │
│  TwinWidget(嵌入大屏)  │  TwinEditor(独立编辑页,复用内核)    │
├──────────────────────────────────────────────────────────┤
│ 联动中枢 (Twin Linkage Hub)  ◀── 复用 store.filter/onPick ──┤
│  实体点击→filter↑   大屏筛选→聚焦↓   仿真输出→KPI↑           │
├───────────────────────┬──────────────────────────────────┤
│ 三维渲染层            │ 仿真计算层 (新增)                    │
│ TwinRenderer(Three.js)│ TwinSim: what-if / RUL / 健康度     │
│ 场景图/相机/交互      │ 预测模型(可接后端ML/规则引擎)        │
├───────────────────────┴──────────────────────────────────┤
│ 孪生建模层 (TwinEngine)                                     │
│ 实体(TwinEntity): 几何+状态机+数据绑定(dataSourceId+字段映射) │
│ 场景(TwinScene): 实体集合+光照/环境+仿真配置                 │
├──────────────────────────────────────────────────────────┤
│ 数据接入/映射层 (Twin Data Bridge)                          │
│ 订阅 liveClient(SQL/WS/MQTT/API) → 写入实体属性/状态         │
│ 输出: 实体快照 + 全局指标流(供大屏其他组件消费)              │
└──────────────────────────────────────────────────────────┘
```

### 3.2 关键模块与职责
- **TwinEngine（建模内核）**：纯逻辑，管理 `TwinScene`/`TwinEntity`，不依赖 React/DOM。实体 = `{ id, name, geoType, transform, stateMachine, bindings:{dataSourceId, fields:{temp:'temperature',health:'health'}}, simConfig }`。
- **TwinDataBridge（数据映射）**：订阅现有 `liveClient` 实时源，按 `bindings` 把实时值写入实体属性；同时把"实体指标流"写入 store，使大屏其它图表/指标卡可消费（复用 `resolveDataSource` 体系）。
- **TwinSim（仿真计算）**：接收 What-if 参数 → 跑机理/规则/ML 预测 → 产出预测指标（产能/能耗/RUL/告警）。MVP 阶段可用确定性规则+抖动，预留接真实后端仿真服务的接口。
- **TwinRenderer（渲染）**：Three.js 封装，输入 `TwinScene` 状态，输出 3D 画面；暴露 `focusEntity(id)` / `highlightEntity(id,level)` / `setState(entityId,state)` 供联动调用。
- **TwinLinkageHub（联动中枢）**：把孪生交互翻译成现有 store 的 `filter`/`onPick` 语义，并订阅大屏筛选反向驱动渲染——**零侵入复用现有联动引擎**。

---

## 四、与现有数据大屏深度融合方案（核心）

> 现有大屏设计器机制（已在代码中验证可用）：`RouteRenderer` 渲染 `comp-frame` 网格 → `WidgetRenderer` 按 `WidgetType` 映射组件 → `onPick({field,value})` → `store.setFilter` → 同 `filterField` 组件自动过滤/高亮（`LinkageFrame`）。实时刷新经 `WindowApp` 3s tick + `resolveDataSource`。这些全部可复用。

### 4.1 三维场景如何嵌入大屏

**方案：把孪生升级为「孪生组件(Twin Widget)」，进入组件面板拖拽使用。**

1. `src/data/types.ts` 扩展 `WidgetType`：新增 `'digitalTwin'`。新增 `TwinWidgetProps`：`sceneId`（关联孪生场景）、`defaultCamera`、`interactive`、`showSimPanel`。
2. `src/data/registry/widgetRegistry.ts`：注册 `digitalTwin` 默认配置（默认绑定一个 `TwinScene`）。
3. `src/designer/widgets/WidgetRenderer.tsx`：`digitalTwin: TwinWidget`。
4. 新建 `src/designer/widgets/TwinWidget.tsx`：
   - 内部渲染 `<TwinRenderer scene={scene} />` 到 `comp-frame` 限定区域；
   - **复用 `useFitScale`**：大屏画布整体 `transform:scale`，TwinWidget 的 Three.js canvas 用 `ResizeObserver` 跟随 `comp-frame` 尺寸（与 `EChartWidget` 同套路）；
   - 编辑器内所见即预览内所得（同一组件、同一内核）。
5. `TwinPage.tsx` 改造为"孪生场景管理/编辑页"，编辑结果保存为 `TwinScene` 数据，供 `TwinWidget` 引用——**编辑与展示共用内核**。

> 价值：孪生从"独立页面"变成"大屏里的一个组件"，可和柱状图/指标卡/KPI 同屏拼装，天然实现"3D 宏观 + 2D 微观"双轨。

### 4.2 实时数据在孪生体与大屏组件间双向联动

**上行（物理/孪生 → 大屏）— TwinDataBridge 驱动：**
- 实体绑定实时源：`bindings.dataSourceId='ws:lineA'`，字段映射 `temp→temperature`。`TwinDataBridge` 经 `liveClient` 订阅，实时更新实体 `temperature`，并写 `entity.metrics` 到 store。
- 大屏其它组件（如"设备温度 TopN 条形图""健康度指标卡"）通过 `resolveDataSource`（或新增 `resolveTwinMetrics`）消费这些指标 → **孪生体温度异常，大屏图表同步变红**。

**交互上行（点击孪生体 → 过滤大屏）：**
- `TwinRenderer` 捕获实体点击 → `TwinLinkageHub.emit({ field:'entityId', value:id })` → `store.setFilter` → 大屏中 `filterField==='entityId'` 的图表/表格/指标卡自动过滤+高亮（复用 `onPick` 机制，无需新引擎）。
- 同理可 emit `field:'zone'`（区域）、`field:'type'`（设备类型），实现"点园区→大屏只看该区"。

**下行（大屏筛选 → 聚焦孪生体）：**
- `TwinLinkageHub` 订阅 `store.filter`：当大屏其它组件触发 `setFilter({field:'entityId',value:id})` 时，调用 `TwinRenderer.focusEntity(id)`（相机飞入）+ `highlightEntity(id,'warn')`（高亮描边）。
- 实现"大屏告警清单点一条 → 3D 场景自动定位并闪烁该设备"，即行业所说的**反向空间定位**。

> 这套双向链路 = 现有 `filter`/`onPick` 联动引擎 + 一层 `TwinLinkageHub` 适配，改动极小、风险低。

### 4.3 孪生仿真结果如何驱动大屏动态展示

**A. What-if 决策沙盘（推演模式）**
- 大屏上放一个"推演参数"面板（滑块/输入）：产能目标、能耗上限、检修时长…
- 改参 → `TwinSim.run(params)` → 输出预测指标流 → 实时写回 store → 大屏 KPI 卡、趋势图、能耗环形图**即时重算刷新**（复用实时刷新 tick）。
- 实现"拖参看结果"的决策沙盘，对应行业"虚拟试错降低决策成本"。

**B. 预测性维护驱动动态告警**
- `TwinSim` 持续计算实体 `health`/`RUL`（MVP：规则+抖动；进阶：接后端 ML）。
- `health<阈值` → 实体颜色转黄/红 + 顶部"告警清单"组件新增一行（数据源=`resolveTwinAlerts`）→ 点击告警行 → 反向定位 3D 实体（4.2 下行）。
- 预留"生成处置工单"钩子（接现有 mock 工单系统），形成"预警→定位→处置→闭环"。

**C. 闭环控制（进阶）**
- 仿真得出"最优参数" → 通过 `liveClient` 下发控制指令（孪生操作反向驱动物理设备）→ 设备状态变化经上行链路回写 → 大屏状态更新。完成"数字孪生→物理世界"闭环。

### 4.4 技术实现路径（落到代码）

| 变更 | 文件 | 说明 |
|------|------|------|
| 类型 | `src/data/types.ts` | +`digitalTwin` 到 `WidgetType`；+`TwinEntity`/`TwinScene`/`TwinWidgetProps`/`TwinMetrics` |
| 注册 | `src/data/registry/widgetRegistry.ts` | 注册 `digitalTwin` 默认组件 |
| 映射 | `src/designer/widgets/WidgetRenderer.tsx` | `digitalTwin: TwinWidget` |
| 组件 | `src/designer/widgets/TwinWidget.tsx`（新） | 嵌入画布的 3D 组件，复用 `useFitScale`+`ResizeObserver` |
| 内核 | `src/twin/TwinEngine.ts`（新） | 场景/实体纯逻辑，状态机+绑定 |
| 渲染 | `src/twin/TwinRenderer.ts`（新） | Three.js 封装，暴露 `focus/highlight/setState` |
| 数据 | `src/twin/TwinDataBridge.ts`（新） | 订阅 `liveClient`→写实体属性→写 store 指标流 |
| 仿真 | `src/twin/TwinSim.ts`（新） | what-if / RUL / 健康度，预留后端接口 |
| 联动 | `src/twin/twinLinkage.ts`（新） | 孪生交互↔`store.filter` 互译（复用现有引擎） |
| 编辑 | `src/features/TwinPage.tsx`（改） | 改为场景管理页，产出 `TwinScene` 供组件引用 |
| 面板 | `PropertyPanel.tsx` / `propSchemas.ts` | 孪生组件属性（绑定场景/交互/仿真面板开关） |

**数据模型示例（types.ts 新增）：**
```ts
export interface TwinEntity {
  id: string; name: string; geoType: GeoType;
  transform: { x:number; y:number; z:number; rotationY:number; scale:number };
  state: 'normal'|'running'|'idle'|'fault'|'offline';
  bindings?: { dataSourceId: string; fields: Record<string,string> }; // 孪生字段→源字段
  sim?: { baseRul?: number; healthRule?: string };
}
export interface TwinScene {
  id: string; name: string; entities: TwinEntity[];
  env: { lighting:'day'|'night'; fog:boolean }; camera?: {...};
}
```

---

## 五、落地路线图（优先级建议）

**MVP（先打通融合，验证价值）**
1. `TwinWidget` 嵌入画布 + `TwinEngine`/`TwinRenderer` 内核抽离；
2. `TwinDataBridge`：实体绑定 `liveClient` 实时源，温度/健康度驱动颜色；
3. `TwinLinkageHub`：点击实体→大屏过滤；大屏筛选→3D 聚焦高亮（双向联动）。

**进阶（仿真驱动大屏）**
4. `TwinSim` What-if 决策沙盘 + 预测性维护告警流；
5. 告警清单组件 + 反向定位 + 工单钩子。

**高级（闭环与生态）**
6. 工业协议/视频/GIS/BIM 多源接入；
7. 后端 ML 仿真服务对接（RUL/优化）；
8. 闭环控制下发。

> 建议先做 MVP 三步（约 1~2 个迭代），用"孪生组件 + 双向联动"把现有大屏与 3D 真正打通，再按业务优先级推进仿真与闭环。需要我继续把 MVP 落地为可运行代码（新增 `TwinWidget`/`TwinEngine`/`TwinDataBridge`/`TwinLinkageHub` 骨架）时告诉我即可。

---

## 附：本次调研来源（节选）
- 优锘 ThingJS / 数字孪生可视化平台
- xun188 数字孪生平台 v3.0（五层架构：感知/数据/模型/仿真/决策）
- freedoonline《数字孪生 PaaS 平台核心功能盘点》
- Mastek《What is a Digital Twin?》七层架构
- MindInventory《How to Build a Digital Twin》
- 百度智能云 / 帆软 / 如视 / 亚秀：数字孪生与大屏融合、双向联动、决策沙盘实践

---

## 六、实施状态（2026-07-29，MVP + 进阶 + 高级已落地）

### 已交付代码（src/twin/ + 组件注册）
| 能力 | 模块 | 说明 |
|------|------|------|
| 渲染内核 | `src/twin/TwinRenderer.ts` | Three.js 封装；`focusEntity`/`highlightEntity`/`setEntityState` + 编辑器接口 `addEntity/removeEntity/updateEntityTransform/setEntityColor/getEntities/getEntityTransform/pickEntityAt/groundPointAt` |
| 实体/场景模型 | `src/twin/twinTypes.ts` | `TwinEntity/TwinScene/TelemetrySample/TwinPrediction/AlarmRecord/ControlCommand/WhatIf*` + `healthIndex/healthToState/ALARM_COLORS/CONTROL_LABELS` |
| 数据映射 | `src/twin/TwinDataBridge.ts` | `createTelemetrySimulator` + `subscribeTwinLive` + **`subscribeTwinSource`(多源适配器接入)** |
| 仿真计算 | `src/twin/TwinSim.ts` | 健康指数 / RUL / 预测状态 / 预测性维护告警(去重) / `runWhatIf` 决策沙盘 |
| 运行时 store | `src/twin/twinRuntimeStore.ts` | 跨组件共享 告警/预测/控制日志/数据源状态/选中实体 |
| 多源接入 | `src/twin/sources/` | `TwinSource` 接口 + `createSource` 工厂 + `SimulatedSource`(完整)/`IndustrialSource`(OPC-UA/Modbus 桩)/`BimSource`(BIM 布局)/`GisSource`(GIS 经纬度) |
| 闭环控制 | `src/twin/control.ts` | `TwinControlHub.dispatch` → 执行器(默认 mock，预留后端代理) → 写入指令日志 |
| 嵌入组件 | `src/designer/widgets/TwinWidget.tsx` | 复用内核 + 双向联动 + 仿真告警写 store + 决策沙盘 + 闭环控制条 + 多源切换 |
| 告警组件 | `src/designer/widgets/AlarmListWidget.tsx` | 读运行时 store，摘要带(平均健康/预测故障) + 分级列表 + 点击反向定位 |
| 编辑器改造 | `src/features/TwinPage.tsx` | **复用 TwinRenderer 内核**（移除重复 Three.js），保留拖拽/属性/关键帧，新增 仿真/控制/告警 面板与数据绑定 |
| 注册 | types/widgetRegistry/WidgetRenderer/propSchemas/componentAssetRegistry/PropertyPanel | `digitalTwin` + `twinAlarm` 全链路注册 |

### 功能清单对标结果（✅=已落地）
- L1 多源：✅ 模拟源 / ✅ 工业协议(桩) / ✅ BIM(桩) / ✅ GIS(桩) / ⬜ 视频流 / ⬜ 边缘网关真实接入
- L3 实体化：✅ 实体绑定 liveSourceId + 状态机颜色/呼吸光
- L4 仿真：✅ What-if 推演 / ✅ RUL 与健康指数 / ✅ 预测性维护告警 / ⬜ 物理机理仿真(CFD/流体)
- L5 决策：✅ 智能预警(分级+反向定位) / ✅ 闭环控制下发(启停/设定) / ⬜ 自动调度优化
- V 融合：✅ 孪生组件嵌入大屏 / ✅ 双向联动 / ✅ 仿真驱动大屏动态展示 / ✅ 决策沙盘

### 验证
- `tsc --noEmit` 0 错误；`vite build` 通过(4628 模块)。
- headless 预览 `/screen/overview`：含 `<canvas>`(孪生) + 孪生告警清单 + 决策沙盘 + HUD，双向联动链路打通。

### 后续可深化
1. 真实后端接入：`subscribeTwinSource` 各桩的 `connect/read` 实现（OPC-UA/Modbus 点位映射、IFC 解析、GIS 瓦片）。
2. 仿真升级：`TwinSim` 的 `healthModel` 替换为后端 ML 服务（RUL 预测准确率 >95%）。
3. 闭环升级：控制执行器接 `proxy/control`，增加 自动巡检/工单生成 钩子。
4. 性能：孪生场景与图表按需懒加载（当前单 chunk 3.2MB）。

