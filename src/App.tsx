import { useState } from 'react'
import ProjectView from './ProjectView'
import Designer from './designer/Designer'
import { useDesignerStore } from './data/store/useDesignerStore'

export default function App() {
  // 大屏编辑器以覆盖式独立模块打开，路由与基础数据层分离
  const [editorRouteId, setEditorRouteId] = useState<string | null>(null)
  const selectRoute = useDesignerStore((s) => s.selectRoute)

  if (editorRouteId) {
    return (
      <Designer
        routeId={editorRouteId}
        onBack={() => {
          selectRoute('/dashboard')
          setEditorRouteId(null)
        }}
      />
    )
  }

  return <ProjectView onOpenDesigner={(id) => setEditorRouteId(id)} />
}
