import { useState } from 'react'
import { Tabs } from 'antd'
import ComponentPanel from './ComponentPanel'
import ResourcePanel from './ResourcePanel'

/** 编辑器左侧面板：组件库 + 资源中心（基础能力 → 画布）双标签 */
export default function DesignerLeftPanel() {
  const [tab, setTab] = useState<'widget' | 'resource'>('widget')
  return (
    <aside className="panel-left">
      <Tabs
        size="small"
        activeKey={tab}
        onChange={(k) => setTab(k as typeof tab)}
        items={[
          { key: 'widget', label: '组件' },
          { key: 'resource', label: '资源' },
        ]}
      />
      <div className="dlp-body">{tab === 'widget' ? <ComponentPanel /> : <ResourcePanel />}</div>
    </aside>
  )
}
