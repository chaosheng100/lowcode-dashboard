import { useState } from 'react'
import ComponentPanel from './ComponentPanel'
import ResourcePanel from './ResourcePanel'

/** 编辑器左侧面板：组件库 + 资源中心（基础能力 → 画布）双标签 */
export default function DesignerLeftPanel() {
  const [tab, setTab] = useState<'widget' | 'resource'>('widget')
  return (
    <aside className="panel-left">
      <div className="dlp-tabs">
        <button className={'tab' + (tab === 'widget' ? ' active' : '')} onClick={() => setTab('widget')}>
          组件
        </button>
        <button className={'tab' + (tab === 'resource' ? ' active' : '')} onClick={() => setTab('resource')}>
          资源
        </button>
      </div>
      <div className="dlp-body">{tab === 'widget' ? <ComponentPanel /> : <ResourcePanel />}</div>
    </aside>
  )
}
