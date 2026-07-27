import type { ComponentType } from 'react'
import UserManagement from './UserManagement'
import DatasetManagement from './DatasetManagement'
import ComponentLibrary from './ComponentLibrary'
import DataSourcePage from './DataSourcePage'
import AssetLibrary from './AssetLibrary'
import RuntimeConfig from './RuntimeConfig'
import './features.css'

/**
 * 路由 → 功能页 注册表。
 * 命中路由时，右侧操作区渲染对应的真实数据页（由 mock 接口驱动），
 * 其余路由仍走低代码画布设计器。新增页面只需在此登记并补 mock 接口。
 *
 * 这些"基础能力提供页"与大屏编辑器的"资源中心"形成闭环：
 * 路由沉淀基础能力 → 编辑器消费为画布功能。
 */
export const featurePages: Record<string, ComponentType> = {
  '/system/users': UserManagement,
  '/data/dataset': DatasetManagement,
  // 基础能力提供页（画布能力的底座）
  '/components/library': ComponentLibrary,
  '/data/source': DataSourcePage,
  '/resources/static': AssetLibrary,
  '/system/runtime': RuntimeConfig
}
