import { useState } from 'react'
import { App, Button, ColorPicker, Form, Input, InputNumber, Select, Slider, Upload } from 'antd'
import { uploadImageAsset } from '../../api/governanceResourceApi'
import { useDesignerStore } from '../../data/store/useDesignerStore'
import type { RouteConfig } from '../../data/types'
import LayerPanel from './LayerPanel'

/**
 * 画布属性面板：当未选中任何组件时展示，用于配置画布尺寸、背景色、
 * 背景图片（填充方式 + 透明度）。所有改动通过 setPage 实时生效并预览。
 */
export default function CanvasPanel() {
  const { message } = App.useApp()
  const [uploading, setUploading] = useState(false)
  const route = useDesignerStore(
    (s) => s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0]
  )! as RouteConfig
  const setPage = useDesignerStore((s) => s.setPage)
  const page = route.page

  // 上传背景图：优先写入静态资源，再在画布保存轻量 URL 引用
  const onUpload = async (file: File) => {
    setUploading(true)
    try {
      const { id, url } = await uploadImageAsset(file)
      setPage({ backgroundImage: url, backgroundImageAssetId: id })
      message.success('背景图已上传')
    } catch (e) {
      message.error('背景图上传失败：' + (e as Error).message)
    } finally {
      setUploading(false)
    }
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
          <Form.Item label="宽度 (px)" colon={false} style={{ marginBottom: 11 }}>
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              value={page.width}
              onChange={(v) => setPage({ width: Math.max(1, Math.round(v ?? 1)) })}
            />
          </Form.Item>
          <Form.Item label="高度 (px)" colon={false} style={{ marginBottom: 11 }}>
            <InputNumber
              style={{ width: '100%' }}
              min={1}
              value={page.height}
              onChange={(v) => setPage({ height: Math.max(1, Math.round(v ?? 1)) })}
            />
          </Form.Item>
        </div>
      </div>

      {/* 背景色 */}
      <div className="rc-block">
        <h4>背景颜色</h4>
        <div className="row2">
          <Form.Item label="取色器" colon={false} style={{ marginBottom: 11 }}>
            <ColorPicker
              value={/^#[0-9a-fA-F]{6}$/.test(page.background) ? page.background : '#000000'}
              onChange={(c) => setPage({ background: c.toHexString() })}
            />
          </Form.Item>
          <Form.Item label="色值 (#hex)" colon={false} style={{ marginBottom: 11 }}>
            <Input value={page.background} onChange={(e) => setPage({ background: e.target.value })} />
          </Form.Item>
        </div>
      </div>

      {/* 背景图片 */}
      <div className="rc-block">
        <h4>背景图片</h4>
        <Upload
          accept="image/*"
          showUploadList={false}
          beforeUpload={(f) => {
            void onUpload(f)
            return false
          }}
        >
          <Button loading={uploading}>上传图片</Button>
        </Upload>
        {page.backgroundImage && (
          <>
            <Button
              style={{ marginLeft: 8 }}
              onClick={() => setPage({ backgroundImage: '', backgroundImageAssetId: '' })}
            >
              移除
            </Button>
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
            <div className="rc-hint">已引用静态资源图片。</div>
          </>
        )}

        {page.backgroundImage && (
          <>
            <Form.Item label="填充方式" colon={false} style={{ marginBottom: 11, marginTop: 10 }}>
              <Select
                style={{ width: '100%' }}
                value={fit}
                onChange={(v) => setPage({ backgroundImageFit: v as 'stretch' | 'tile' | 'center' })}
                options={[
                  { value: 'stretch', label: '拉伸（铺满）' },
                  { value: 'tile', label: '平铺（原图重复）' },
                  { value: 'center', label: '居中（原图尺寸）' }
                ]}
              />
            </Form.Item>
            <Form.Item
              label={`透明度：${Math.round(opacity * 100)}%`}
              colon={false}
              style={{ marginBottom: 11 }}
            >
              <Slider
                min={0}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(v) => setPage({ backgroundImageOpacity: v })}
              />
            </Form.Item>
          </>
        )}
      </div>

      <LayerPanel />
    </div>
  )
}
