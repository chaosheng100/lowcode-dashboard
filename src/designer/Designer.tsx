import { useEffect, useState } from 'react'
import { useDesignerStore } from '../data/store/useDesignerStore'
import Toolbar from './editor/Toolbar'
import Editor from './editor/Editor'
import Renderer from './runtime/Renderer'
import MockDemo from '../mock/MockDemo'
import CapabilityMap from './editor/CapabilityMap'

interface Props {
  /** 待编辑的大屏路由 id */
  routeId: string
  /** 返回「大屏管理」列表 */
  onBack: () => void
}

/**
 * 大屏编辑器（独立功能模块）：与基础数据路由完全分离。
 * 复用设计器层的画布能力（组件拖拽 / 属性配置 / 联动预览），
 * 仅作用于当前选中的「大屏路由」。顶部工具条可返回大屏管理。
 */
export default function Designer({ routeId, onBack }: Props) {
  const selectRoute = useDesignerStore((s) => s.selectRoute)
  const mode = useDesignerStore((s) => s.mode)
  const [showMock, setShowMock] = useState(false)
  const [showCapability, setShowCapability] = useState(false)

  // 进入编辑器即切换为当前大屏路由，使其作为画布编辑对象
  useEffect(() => {
    selectRoute(routeId)
    useDesignerStore.getState().loadCatalog()
  }, [routeId, selectRoute])

  return (
    <div className="designer-module">
      <Toolbar
        onBack={onBack}
        onOpenMock={() => setShowMock(true)}
        onOpenCapability={() => setShowCapability(true)}
      />
      <div className="designer-body">
        {mode === 'project' ? <Editor /> : <Renderer />}
      </div>
      {showMock && <MockDemo onClose={() => setShowMock(false)} />}
      {showCapability && <CapabilityMap onClose={() => setShowCapability(false)} />}
    </div>
  )
}
