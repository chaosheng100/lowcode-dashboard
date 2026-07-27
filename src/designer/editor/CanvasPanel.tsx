import { useDesignerStore } from '../../data/store/useDesignerStore'
import type { RouteConfig } from '../../data/types'

/**
 * 画布属性面板：当未选中任何组件时展示，用于配置画布尺寸、背景色、
 * 背景图片（填充方式 + 透明度）。所有改动通过 setPage 实时生效并预览。
 */
export default function CanvasPanel() {
  const route = useDesignerStore(
    (s) => s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0]
  )! as RouteConfig
  const setPage = useDesignerStore((s) => s.setPage)
  const page = route.page

  const onUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => setPage({ backgroundImage: reader.result as string })
    reader.readAsDataURL(file)
    // 允许重复选择同一文件
    e.target.value = ''
  }

  const fit = page.backgroundImageFit ?? 'stretch'
  const opacity = page.backgroundImageOpacity ?? 1

  return (
    <div className="panel-right">
      <div style={{ marginBottom: 14 }}>
        <strong>画布属性</strong>
        <div className="rc-hint" style={{ marginTop: 4 }}>
          点击画布空白处可回到此面板；所有修改实时预览生效。
        </div>
      </div>

      {/* 尺寸 */}
      <div className="rc-block">
        <h4>画布尺寸</h4>
        <div className="row2">
          <div className="field">
            <label>宽度 (px)</label>
            <input
              type="number"
              min={1}
              value={page.width}
              onChange={(e) => setPage({ width: Math.max(1, Math.round(+e.target.value)) })}
            />
          </div>
          <div className="field">
            <label>高度 (px)</label>
            <input
              type="number"
              min={1}
              value={page.height}
              onChange={(e) => setPage({ height: Math.max(1, Math.round(+e.target.value)) })}
            />
          </div>
        </div>
      </div>

      {/* 背景色 */}
      <div className="rc-block">
        <h4>背景颜色</h4>
        <div className="row2">
          <div className="field">
            <label>取色器</label>
            <input
              type="color"
              value={/^#[0-9a-fA-F]{6}$/.test(page.background) ? page.background : '#000000'}
              onChange={(e) => setPage({ background: e.target.value })}
              style={{ height: 34, padding: 2 }}
            />
          </div>
          <div className="field">
            <label>色值 (#hex)</label>
            <input
              type="text"
              value={page.background}
              onChange={(e) => setPage({ background: e.target.value })}
            />
          </div>
        </div>
      </div>

      {/* 背景图片 */}
      <div className="rc-block">
        <h4>背景图片</h4>
        <label className="btn" style={{ display: 'inline-block', cursor: 'pointer' }}>
          上传图片
          <input type="file" accept="image/*" style={{ display: 'none' }} onChange={onUpload} />
        </label>
        {page.backgroundImage && (
          <>
            <button
              className="btn"
              style={{ marginLeft: 8, padding: '7px 14px' }}
              onClick={() => setPage({ backgroundImage: '' })}
            >
              移除
            </button>
            <img
              src={page.backgroundImage}
              alt="背景预览"
              style={{
                display: 'block',
                width: '100%',
                height: 84,
                objectFit: 'cover',
                borderRadius: 6,
                border: '1px solid var(--line)',
                marginTop: 8,
              }}
            />
            <div className="rc-hint">已嵌入为 dataURL，随项目一并导出。</div>
          </>
        )}

        {page.backgroundImage && (
          <>
            <div className="field" style={{ marginTop: 10 }}>
              <label>填充方式</label>
              <select value={fit} onChange={(e) => setPage({ backgroundImageFit: e.target.value as 'stretch' | 'tile' | 'center' })}>
                <option value="stretch">拉伸（铺满）</option>
                <option value="tile">平铺（原图重复）</option>
                <option value="center">居中（原图尺寸）</option>
              </select>
            </div>
            <div className="field">
              <label>透明度：{Math.round(opacity * 100)}%</label>
              <input
                type="range"
                min={0}
                max={100}
                value={Math.round(opacity * 100)}
                onChange={(e) => setPage({ backgroundImageOpacity: +e.target.value / 100 })}
                style={{ width: '100%' }}
              />
            </div>
          </>
        )}
      </div>
    </div>
  )
}
