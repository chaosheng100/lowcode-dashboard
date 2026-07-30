import { initPersist } from './data/store/persist'
import { openEditorWindow, openPreviewWindow } from './designer/window'
import ProjectView from './ProjectView'
import WindowApp from './designer/WindowApp'
import RemoteWindowApp from './api/RemoteWindowApp'
import ScreenListPage from './api/ScreenListPage'
import LoginPage from './auth/LoginPage'
import RegisterPage from './auth/RegisterPage'
import { useAuthStore } from './auth/store'
import { useLocation } from 'react-router-dom'

// 启动即恢复登录态（localStorage → store），在组件渲染前完成，避免登录页闪烁
useAuthStore.getState().hydrate()

// 仅在非 remote 模式下初始化本地持久化
const params = new URLSearchParams(location.search)
const isRemote = params.get('remote') === 'true'
if (!isRemote) initPersist()

export default function App() {
  const location = useLocation()
  const token = useAuthStore((s) => s.token)

  const p = new URLSearchParams(location.search)
  const mode = p.get('mode')
  const routeId = p.get('routeId')
  const remote = p.get('remote') === 'true'
  const screenList = p.get('screens') === 'list'

  // 大屏列表（后端版）入口
  if (screenList) return <ScreenListPage />

  // 独立页签入口
  if ((mode === 'editor' || mode === 'preview') && routeId) {
    if (remote) {
      return <RemoteWindowApp mode={mode as 'editor' | 'preview'} screenId={routeId} />
    }
    return <WindowApp mode={mode as 'editor' | 'preview'} routeId={routeId} />
  }

  // 认证路由（独立于主应用）
  if (location.pathname === '/register') return <RegisterPage />
  if (!token) return <LoginPage />

  // 主应用：大屏管理台（路由树 + 内容区，本地 localStorage 持久化）
  return (
    <ProjectView
      onOpenDesigner={(id) => openEditorWindow(id)}
      onOpenPreview={(id) => openPreviewWindow(id)}
    />
  )
}
