import { useEffect, useState } from 'react'
import PluginManagement from './PluginManagement'
import { api } from '../mock'
import type { CarouselDTO } from '../mock/types'
import { Tag } from './common'

/** 轮播管理：多屏巡播方案，列表 + 编辑 + 预览（关系与大屏管理一致） */
export default function CarouselPage() {
  return (
    <PluginManagement<CarouselDTO>
      title="轮播管理"
      subtitle="大屏巡播 / 翻页方案，支持多屏轮播配置与自动播放预览"
      countLabel="方案"
      fetcher={() => api.listCarousels({ pageSize: 50 })}
      saveItem={(b) => api.saveCarousel(b)}
      deleteItem={(id) => api.deleteCarousel(id)}
      blankItem={() => ({ id: '', name: '新建轮播', slides: [], intervalSec: 5 })}
      renderMeta={(c) => [`切换间隔 ${c.intervalSec}s`, `轮播大屏 ${c.slides.length} 个`]}
      renderTags={(c) => (
        <div className="flex" style={{ margin: '6px 0' }}>
          {c.slides.slice(0, 4).map((s) => <Tag key={s}>{s}</Tag>)}
        </div>
      )}
      renderEditor={(c, save) => <CarouselEditor item={c} save={save} />}
      renderPreview={(c) => <CarouselPlayer item={c} />}
    />
  )
}

function CarouselEditor({ item, save }: { item: CarouselDTO; save: (p: Partial<CarouselDTO>) => Promise<void> }) {
  const [name, setName] = useState(item.name)
  const [intervalSec, setIntervalSec] = useState(item.intervalSec)
  const [slidesText, setSlidesText] = useState(item.slides.join('\n'))
  const [saving, setSaving] = useState(false)

  const doSave = async () => {
    setSaving(true)
    await save({
      name,
      intervalSec: Math.max(1, intervalSec),
      slides: slidesText.split('\n').map((s) => s.trim()).filter(Boolean)
    })
    setSaving(false)
  }

  return (
    <div className="card" style={{ maxWidth: 680, margin: '0 auto' }}>
      <div className="field"><label>名称</label><input className="inp" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label>切换间隔（秒）</label><input type="number" className="inp" min={1} value={intervalSec} onChange={(e) => setIntervalSec(+e.target.value)} /></div>
      <div className="field"><label>轮播大屏（每行一个名称）</label><textarea className="inp" style={{ minHeight: 180 }} value={slidesText} onChange={(e) => setSlidesText(e.target.value)} placeholder="销售总览&#10;区域分析&#10;实时监控" /></div>
      <div className="fp-toolbar"><button className="btn primary" onClick={doSave} disabled={saving}>{saving ? '保存中…' : '保存'}</button></div>
    </div>
  )
}

function CarouselPlayer({ item }: { item: CarouselDTO }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    if (!item.slides.length) return
    setI(0)
    const id = setInterval(() => setI((p) => (p + 1) % item.slides.length), Math.max(1, item.intervalSec) * 1000)
    return () => clearInterval(id)
  }, [item.slides, item.intervalSec])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: 16 }}>
      <div style={{ fontSize: 52, fontWeight: 700, color: '#e6edf3', textAlign: 'center' }}>{item.slides[i] || '无轮播内容'}</div>
      <div className="muted2">第 {item.slides.length ? i + 1 : 0} / {item.slides.length} 屏 · 每 {item.intervalSec}s 切换</div>
      <div className="flex" style={{ gap: 6 }}>
        {item.slides.map((s, idx) => (
          <span key={s} style={{ width: 10, height: 10, borderRadius: '50%', background: idx === i ? '#00d4ff' : '#2a3340' }} />
        ))}
      </div>
    </div>
  )
}
