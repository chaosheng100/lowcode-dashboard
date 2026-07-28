/**
 * 独立页签工具：把「编辑大屏 / 预览大屏」在浏览器新页签（tab）中打开。
 * 通过 URL 参数（mode + routeId）携带意图，新页签加载同一应用、进入对应模式。
 * 不传 windowFeatures → 浏览器默认开新标签页（而非弹窗式独立窗口）。
 * 同源页签共享 localStorage（持久化）与 BroadcastChannel（实时同步）。
 */

type WinMode = 'editor' | 'preview'

function buildWindowUrl(mode: WinMode, routeId: string): string {
  const u = new URL(location.href)
  u.searchParams.set('mode', mode)
  u.searchParams.set('routeId', routeId)
  return u.toString()
}

export function openEditorWindow(routeId: string): void {
  // 仅传 _blank、不带 features → 浏览器以新标签页打开；fit 模式会自动适配任意分辨率
  window.open(buildWindowUrl('editor', routeId), '_blank')
}

export function openPreviewWindow(routeId: string): void {
  window.open(buildWindowUrl('preview', routeId), '_blank')
}
