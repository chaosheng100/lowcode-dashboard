import { initPersist } from './data/store/persist'
import { openEditorWindow, openPreviewWindow } from './designer/window'
import ProjectView from './ProjectView'
import WindowApp from './designer/WindowApp'
import RemoteWindowApp from './api/RemoteWindowApp'
import ScreenListPage from './api/ScreenListPage'

// 启动即加载已保存项目 + 开启实时保存（同源页签共享 localStorage）
// 仅在非 remote 模式下初始化本地持久化，避免覆盖 store
const params = new URLSearchParams(location.search)
const isRemote = params.get('remote') === 'true'
if (!isRemote) initPersist()

export default function App() {
  const params = new URLSearchParams(location.search)
  const mode = params.get('mode')
  const routeId = params.get('routeId')
  const remote = params.get('remote') === 'true'
  const screenList = params.get('screens') === 'list'

  // 大屏列表（后端版）入口
  if (screenList) return <ScreenListPage />

  // 独立页签入口
  if ((mode === 'editor' || mode === 'preview') && routeId) {
    if (remote) {
      return <RemoteWindowApp mode={mode as 'editor' | 'preview'} screenId={routeId} />
    }
    return <WindowApp mode={mode as 'editor' | 'preview'} routeId={routeId} />
  }

  // 主应用：大屏管理台（路由树 + 内容区，本地 localStorage 持久化）
  return (
    <ProjectView
      onOpenDesigner={(id) => openEditorWindow(id)}
      onOpenPreview={(id) => openPreviewWindow(id)}
    />
  )
}
