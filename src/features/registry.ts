import type { ComponentType } from 'react'
import UserManagement from './UserManagement'
import DatasetManagement from './DatasetManagement'
import ComponentLibrary from './ComponentLibrary'
import DataSourcePage from './DataSourcePage'
import AssetLibrary from './AssetLibrary'
import RuntimeConfig from './RuntimeConfig'
import MessagePushPage from './MessagePushPage'
import DataEntryPage from './DataEntryPage'
import WorkflowPage from './WorkflowPage'
import ComponentMenuPage from './ComponentMenuPage'
import AIModelPage from './AIModelPage'
import AIAssistantPage from './AIAssistantPage'
import GlobalVarPage from './GlobalVarPage'
import CodeRepoPage from './CodeRepoPage'
import MapResourcePage from './MapResourcePage'
import CategoryPage from './CategoryPage'
import AnalysisPage from './AnalysisPage'
import PluginMinePage from './PluginMinePage'
import PluginMarketPage from './PluginMarketPage'
import HelpPage from './HelpPage'
import AIPlatformPage from './AIPlatformPage'
import TwinManagement from './TwinManagement'
import IoTConfigPage from './IoTConfigPage'
import ReportManagement from './ReportManagement'
import CarouselPage from './CarouselPage'
import DeployPage from './DeployPage'
import SchedulerPage from './SchedulerPage'
import SyncTaskPage from './SyncTaskPage'
import NotificationPage from './NotificationPage'
import SystemMonitorPage from './SystemMonitorPage'
import './features.css'

/**
 * 路由 → 功能页 注册表（覆盖规范全部基础模块）。
 * 命中路由时，右侧操作区渲染对应的真实数据页（由 mock 接口驱动）；
 * 其余路由（大屏类）仍走低代码画布设计器。新增页面只需在此登记并补 mock 接口。
 */
export const featurePages: Record<string, ComponentType> = {
  // 系统
  '/system/users': UserManagement,
  '/system/tags': CategoryPage,
  '/system/runtime': RuntimeConfig,
  '/system/analysis': AnalysisPage,
  // 数据管理
  '/data/dataset': DatasetManagement,
  '/data/source': DataSourcePage,
  '/data/channel': MessagePushPage,
  '/data/entry': DataEntryPage,
  '/data/workflow': WorkflowPage,
  // 组件中心
  '/components/library': ComponentLibrary,
  '/components/menu': ComponentMenuPage,
  // AI 智能
  '/ai/models': AIModelPage,
  '/ai/assistant': AIAssistantPage,
  // 开发工具
  '/dev/variables': GlobalVarPage,
  '/dev/code': CodeRepoPage,
  // 资源管理
  '/resources/static': AssetLibrary,
  '/resources/map': MapResourcePage,
  // 插件管理
  '/plugins/mine': PluginMinePage,
  '/plugins/market': PluginMarketPage,
  // 生态扩展
  '/extension/twin': TwinManagement,
  '/extension/iot': IoTConfigPage,
  '/extension/report': ReportManagement,
  '/extension/carousel': CarouselPage,
  '/extension/deploy': DeployPage,
  // 其他系统 / 帮助
  '/others/ai-platform': AIPlatformPage,
  '/others/scheduler': SchedulerPage,
  '/others/sync': SyncTaskPage,
  '/others/notify': NotificationPage,
  '/help': HelpPage,
  // 系统管理（新增监控）
  '/system/monitor': SystemMonitorPage
}
