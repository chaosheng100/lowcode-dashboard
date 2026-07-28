/**
 * 独立窗口工具：把「编辑大屏 / 预览大屏」从同窗口切换改为新窗口打开。
 * 通过 URL 参数（mode + routeId）携带意图，新窗口加载同一应用、进入对应模式。
 * 同源窗口共享 localStorage（持久化）与 BroadcastChannel（实时同步）。
 */

type WinMode = 'editor' | 'preview'

function buildWindowUrl(mode: WinMode, routeId: string): string {
  const u = new URL(location.href)
  u.searchParams.set('mode', mode)
  u.searchParams.set('routeId', routeId)
  return u.toString()
}

// 独立窗口尺寸：初始给一个较宽的工作视口；fit 模式会自动适配任意分辨率
const FEATURES = 'width=1440,height=900,menubar=no,toolbar=no,location=no'

export function openEditorWindow(routeId: string): void {
  window.open(buildWindowUrl('editor', routeId), '_blank', FEATURES)
}

export function openPreviewWindow(routeId: string): void {
  window.open(buildWindowUrl('preview', routeId), '_blank', FEATURES)
}
