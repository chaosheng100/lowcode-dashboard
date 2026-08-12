import { useState } from 'react'
import { Tabs } from 'antd'
import ComponentPanel from './ComponentPanel'
import ResourcePanel from './ResourcePanel'
import AIPanel from './AIPanel'

/** 编辑器左侧面板：组件库 + 资源中心 + AI 编排 */
export default function DesignerLeftPanel() {
  const [tab, setTab] = useState<'widget' | 'resource' | 'ai'>('widget')
  return (
    <aside className="panel-left">
      <Tabs
        size="small"
        activeKey={tab}
        onChange={(k) => setTab(k as typeof tab)}
        items={[
          { key: 'widget', label: '组件' },
          { key: 'resource', label: '资源' },
          { key: 'ai', label: 'AI 编排' },
        ]}
      />
      <div className="dlp-body">
        {tab === 'widget' ? <ComponentPanel /> : tab === 'resource' ? <ResourcePanel /> : <AIPanel embedded onClose={() => setTab('widget')} />}
      </div>
    </aside>
  )
}
