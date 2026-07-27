import { useRef } from 'react'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import { buildPlatformProject } from '../../data/routes/platformRoutes'
import { downloadJSON, readJSONFile } from '../../data/utils/export'

export default function Toolbar({
  onOpenMock,
  onOpenCapability,
  onBack
}: {
  onOpenMock?: () => void
  /** 打开"能力映射"总览（基础路由 → 画布能力） */
  onOpenCapability?: () => void
  /** 提供时为「大屏编辑器」模式，显示返回按钮 */
  onBack?: () => void
}) {
  const mode = useDesignerStore((s) => s.mode)
  const setMode = useDesignerStore((s) => s.setMode)
  const loadProject = useDesignerStore((s) => s.loadProject)
  const exportProject = useDesignerStore((s) => s.exportProject)
  const clearAll = useDesignerStore((s) => s.clearAll)
  const scale = useDesignerStore(
    (s) => (s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0])?.page.scale ?? 0.42
  )
  const fit = useDesignerStore(
    (s) => (s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0])?.page.fit ?? true
  )
  const setPage = useDesignerStore((s) => s.setPage)
  const fileRef = useRef<HTMLInputElement>(null)

  const onImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const data = await readJSONFile(file)
      loadProject(data as Parameters<typeof loadProject>[0])
    } catch (err) {
      alert('导入失败：' + (err as Error).message)
    }
    e.target.value = ''
  }

  return (
    <div className="toolbar">
      {onBack && (
        <button className="btn tb-back" onClick={onBack} title="返回大屏管理">
          ← 返回
        </button>
      )}
      <span className="title">{onBack ? '大屏编辑器' : '低代码大屏设计器'}</span>
      <button className={'btn ' + (mode === 'project' ? 'active' : '')} onClick={() => setMode('project')}>
        项目
      </button>
      <button className={'btn ' + (mode === 'preview' ? 'active' : '')} onClick={() => setMode('preview')}>
        预览
      </button>
      <span style={{ width: 1, height: 22, background: '#2a3340' }} />
      <button
        className={'btn ' + (fit ? 'active' : '')}
        title="画布自动适配容器尺寸"
        onClick={() => setPage({ fit: true })}
      >
        适应
      </button>
      <label style={{ color: '#9aa7b4', fontSize: 12 }}>缩放</label>
      <input
        type="range"
        min="0.2"
        max="1"
        step="0.02"
        value={scale}
        disabled={fit}
        onChange={(e) => setPage({ scale: parseFloat(e.target.value), fit: false })}
        style={{ width: 110, opacity: fit ? 0.5 : 1 }}
      />
      <span style={{ color: '#9aa7b4', fontSize: 12, width: 38 }}>
        {fit ? '自动' : Math.round(scale * 100) + '%'}
      </span>
      <span style={{ width: 1, height: 22, background: '#2a3340' }} />
      <button className="btn" onClick={() => onOpenCapability?.()}>
        能力映射
      </button>
      <button className="btn" onClick={() => onOpenMock?.()}>
        Mock 演示
      </button>
      <button className="btn" onClick={() => loadProject(buildPlatformProject())}>
        加载示例
      </button>
      <button className="btn" onClick={() => downloadJSON(exportProject(), 'project.json')}>
        导出 JSON
      </button>
      <button className="btn" onClick={() => fileRef.current?.click()}>
        导入
      </button>
      <input ref={fileRef} type="file" accept="application/json" style={{ display: 'none' }} onChange={onImport} />
      <button className="btn" onClick={() => { if (confirm('确定清空所有页面？')) clearAll() }}>
        清空
      </button>
    </div>
  )
}
