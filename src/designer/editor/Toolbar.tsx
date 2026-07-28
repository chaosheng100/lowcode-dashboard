import { App, Button, Slider, Space, Upload } from 'antd'
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
  const { message, modal } = App.useApp()
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

  // 导入项目 JSON：beforeUpload 拦截自动上传，读取后手动加载
  const onImport = async (file: File) => {
    try {
      const data = await readJSONFile(file)
      loadProject(data as Parameters<typeof loadProject>[0])
    } catch (err) {
      message.error('导入失败：' + (err as Error).message)
    }
  }

  return (
    <div className="toolbar">
      {onBack && (
        <Button className="tb-back" onClick={onBack} title="返回大屏管理">
          ← 返回
        </Button>
      )}
      <span className="title">{onBack ? '大屏编辑器' : '低代码大屏设计器'}</span>
      <Space size={12}>
        <Button type={mode === 'project' ? 'primary' : 'default'} onClick={() => setMode('project')}>
          项目
        </Button>
        <Button type={mode === 'preview' ? 'primary' : 'default'} onClick={() => setMode('preview')}>
          预览
        </Button>
        <span style={{ width: 1, height: 22, background: '#2a3340' }} />
        <Button
          type={fit ? 'primary' : 'default'}
          title="画布自动适配容器尺寸"
          onClick={() => setPage({ fit: true })}
        >
          适应
        </Button>
        <span style={{ color: '#9aa7b4', fontSize: 12 }}>缩放</span>
        <Slider
          min={0.2}
          max={1}
          step={0.02}
          value={scale}
          disabled={fit}
          tooltip={{ formatter: (v) => `${Math.round((v ?? 0) * 100)}%` }}
          onChange={(v) => setPage({ scale: v, fit: false })}
          style={{ width: 120 }}
        />
        <span style={{ color: '#9aa7b4', fontSize: 12, width: 38 }}>
          {fit ? '自动' : Math.round(scale * 100) + '%'}
        </span>
        <span style={{ width: 1, height: 22, background: '#2a3340' }} />
        <Button onClick={() => onOpenCapability?.()}>能力映射</Button>
        <Button onClick={() => onOpenMock?.()}>Mock 演示</Button>
        <Button onClick={() => loadProject(buildPlatformProject())}>加载示例</Button>
        <Button onClick={() => downloadJSON(exportProject(), 'project.json')}>导出 JSON</Button>
        <Upload
          accept="application/json"
          showUploadList={false}
          beforeUpload={(f) => {
            onImport(f)
            return false
          }}
        >
          <Button>导入</Button>
        </Upload>
        <Button
          danger
          onClick={() =>
            modal.confirm({
              title: '清空确认',
              content: '确定清空所有页面？',
              okButtonProps: { danger: true },
              onOk: () => clearAll()
            })
          }
        >
          清空
        </Button>
      </Space>
    </div>
  )
}
