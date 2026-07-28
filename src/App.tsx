import { initPersist } from './data/store/persist'
import { openEditorWindow, openPreviewWindow } from './designer/window'
import ProjectView from './ProjectView'
import WindowApp from './designer/WindowApp'

// 启动即加载已保存项目 + 开启实时保存（同源页签共享 localStorage）
initPersist()

export default function App() {
  // 独立页签入口：?mode=editor|preview&routeId=xxx → 在该页签内打开对应模式
  const params = new URLSearchParams(location.search)
  const mode = params.get('mode')
  const routeId = params.get('routeId')
  if ((mode === 'editor' || mode === 'preview') && routeId) {
    return <WindowApp mode={mode as 'editor' | 'preview'} routeId={routeId} />
  }

  // 主应用：大屏管理台（点击卡片在新页签打开编辑/预览）
  return (
    <ProjectView
      onOpenDesigner={(id) => openEditorWindow(id)}
      onOpenPreview={(id) => openPreviewWindow(id)}
    />
  )
}
