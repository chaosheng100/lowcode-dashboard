import { useEffect, useState } from 'react'
import { useDesignerStore } from '../data/store/useDesignerStore'
import { setAutosave, onSaved } from '../data/store/persist'
import { startEditorSync, startPreviewSync } from './sync'
import { openPreviewWindow } from './window'
import Editor from './editor/Editor'
import Renderer from './runtime/Renderer'
import { resolveDataSource } from './runtime/DataEngine'
import { captureThumbnail } from '../data/utils/thumb'

interface Props {
  mode: 'editor' | 'preview'
  routeId: string
}

export default function WindowApp({ mode, routeId }: Props) {
  const isEditor = mode === 'editor'

  const route = useDesignerStore((s) => s.routes.find((r) => r.id === routeId))
  const routeName = route?.name ?? routeId

  const [lastSaved, setLastSaved] = useState<number | null>(null)
  const [refreshing, setRefreshing] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [isFs, setIsFs] = useState(false)

  // 选中路由 + 设置模式 + 同步自动保存开关（仅一次）
  useEffect(() => {
    const st = useDesignerStore.getState()
    st.selectRoute(routeId)
    // 页签态 'editor' 对应 store 态 'project'
    st.setMode(mode === 'editor' ? 'project' : 'preview')
    // 预览页签关闭自动保存，避免把本地实时刷新数据回写覆盖编辑器
    setAutosave(mode === 'editor')
  }, [mode, routeId])

  // 编辑器 → 广播同步
  useEffect(() => {
    if (mode !== 'editor') return
    return startEditorSync(() => {
      const s = useDesignerStore.getState()
      return s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0]
    })
  }, [mode, routeId])

  // 编辑器：定期用 html2canvas 生成真实缩略图（对齐 Avue Data 方案）
  // 内容变化后防抖 2.5s 截图，且节流至少 10s 一次，避免拖拽时频繁截图卡顿
  useEffect(() => {
    if (mode !== 'editor') return
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastCaptured = 0
    const capture = async () => {
      const now = Date.now()
      if (now - lastCaptured < 10000) return
      const el = document.querySelector('.canvas-viewport') as HTMLElement | null
      if (!el) return
      lastCaptured = now
      const thumb = await captureThumbnail(el)
      if (thumb) useDesignerStore.getState().updateRoute(routeId, { thumbnail: thumb })
    }
    const unsub = useDesignerStore.subscribe(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(capture, 2500)
    })
    timer = setTimeout(capture, 1500) // 进入编辑器后先截一次
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [mode, routeId])

  // 预览 → 接收同步
  useEffect(() => {
    if (mode !== 'preview') return
    return startPreviewSync(routeId, (r) => {
      useDesignerStore.getState().upsertRoute(r)
    })
  }, [mode, routeId])

  // 预览：实时数据刷新（重新拉取绑定数据源，带抖动模拟实时）
  useEffect(() => {
    if (mode !== 'preview' || !refreshing) return
    let alive = true
    const tick = async () => {
      const st = useDesignerStore.getState()
      const r = st.routes.find((x) => x.id === routeId)
      if (!r || !alive) return
      const newComps = await Promise.all(
        r.components.map(async (c) => {
          const ds = c.props.dataSourceId
          if (!ds) return c
          try {
            const data = await resolveDataSource(ds)
            // 拿不到数据则保留原 props.data，避免实时刷新把图表清空
            if (!data.length) return c
            const jittered = data.map((d) => ({
              ...d,
              value: Math.round(d.value * (0.9 + Math.random() * 0.2))
            }))
            return { ...c, props: { ...c.props, data: jittered } }
          } catch {
            return c
          }
        })
      )
      if (!alive) return
      useDesignerStore.setState((s) => ({
        routes: s.routes.map((x) => (x.id === routeId ? { ...x, components: newComps } : x))
      }))
      if (alive) setLastRefresh(new Date())
    }
    tick()
    const id = setInterval(tick, 3000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [mode, routeId, refreshing])

  // 全屏状态跟随
  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  // 编辑器：保存指示器
  useEffect(() => {
    if (mode !== 'editor') return
    return onSaved((t) => setLastSaved(t))
  }, [mode])

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.()
  }
  const fmtTime = (t: number) => {
    const d = new Date(t)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  }

  return (
    <div className="win-app">
      <div className="win-bar">
        <span className="win-title">{isEditor ? '大屏编辑器' : '大屏预览'} · {routeName}</span>
        <span className="win-sep" />
        {isEditor ? (
          <button className="btn" onClick={() => openPreviewWindow(routeId)}>
            在新页签预览
          </button>
        ) : (
          <>
            <button
              className={'btn' + (refreshing ? ' active' : '')}
              onClick={() => setRefreshing((v) => !v)}
            >
              {refreshing ? '实时刷新：开' : '实时刷新：关'}
            </button>
            <button className="btn" onClick={toggleFs}>
              {isFs ? '退出全屏' : '全屏查看'}
            </button>
          </>
        )}
        <ZoomControls />
        <span className="win-spacer" />
        {isEditor && lastSaved && (
          <span className="win-saved" title="已自动保存到本地">
            已保存 {fmtTime(lastSaved)}
          </span>
        )}
        {!isEditor && lastRefresh && (
          <span className="win-saved">刷新于 {lastRefresh.toLocaleTimeString()}</span>
        )}
        <button className="btn" onClick={() => window.close()}>
          关闭页签
        </button>
      </div>
      <div className="win-body">{isEditor ? <Editor /> : <Renderer />}</div>
    </div>
  )
}

/** 缩放控件（适应 / 手动缩放），编辑与预览窗口复用 */
function ZoomControls() {
  const scale = useDesignerStore(
    (s) => (s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0])?.page.scale ?? 0.42
  )
  const fit = useDesignerStore(
    (s) => (s.routes.find((r) => r.id === s.selectedRouteId) || s.routes[0])?.page.fit ?? true
  )
  const setPage = useDesignerStore((s) => s.setPage)
  return (
    <>
      <span className="win-sep" />
      <button
        className={'btn' + (fit ? ' active' : '')}
        title="画布自动适配窗口尺寸（自适应不同分辨率）"
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
    </>
  )
}
