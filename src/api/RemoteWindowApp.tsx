// ============================================================
// 后端持久化版 WindowApp
// - 从后端加载大屏配置
// - store 变化 → 防抖 500ms → PUT /api/screens/:id/save
// - 保留原 WindowApp 的全部 UI（顶栏、缩放、编辑器/预览渲染）
// ============================================================
import { useEffect, useState } from 'react'
import { Button, Slider, Switch, Spin, message } from 'antd'
import {
  CloseOutlined,
  FullscreenExitOutlined,
  FullscreenOutlined,
} from '@ant-design/icons'
import { useDesignerStore } from '../data/store/useDesignerStore'
import Editor from '../designer/editor/Editor'
import Renderer from '../designer/runtime/Renderer'
import { captureThumbnail } from '../data/utils/thumb'
import { resolveDataSource } from '../designer/runtime/DataEngine'
import { screenApi } from './screenApi'
import { routeToConfig, screenToRoute } from './screenAdapter'

interface Props {
  mode: 'editor' | 'preview'
  screenId: string
}

export default function RemoteWindowApp({ mode, screenId }: Props) {
  const isEditor = mode === 'editor'
  const route = useDesignerStore((s) => s.routes.find((r) => r.id === screenId))
  const routeName = route?.name ?? '加载中...'

  const [loading, setLoading] = useState(true)
  const [lastSaved, setLastSaved] = useState<number | null>(null)
  const [saving, setSaving] = useState(false)
  const [refreshing, setRefreshing] = useState(true)
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null)
  const [isFs, setIsFs] = useState(false)

  // 加载大屏
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      const res = await screenApi.detail(screenId)
      if (cancelled) return
      if (res.code === 0 && res.data) {
        const routeData = screenToRoute(res.data)
        const store = useDesignerStore.getState()
        // 先清理，再注入
        store.clearAll()
        store.loadProject({ version: '1.0', routes: [routeData] })
        store.selectRoute(screenId)
        store.setMode(mode === 'editor' ? 'project' : 'preview')
      } else {
        message.error(`加载失败：${res.message}`)
      }
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [screenId, mode])

  // 自动保存（防抖 500ms）
  useEffect(() => {
    if (!isEditor || loading) return

    let timer: ReturnType<typeof setTimeout> | null = null
    let lastContent = ''

    const getSnapshot = () => {
      const s = useDesignerStore.getState()
      const r = s.routes.find((x) => x.id === screenId)
      if (!r) return ''
      return JSON.stringify({
        components: r.components,
        page: r.page,
        state: r.state,
        params: r.params,
        props: r.props,
        links: r.links,
        thumbnail: r.thumbnail,
      })
    }

    const doSave = async () => {
      const s = useDesignerStore.getState()
      const r = s.routes.find((x) => x.id === screenId)
      if (!r) return
      setSaving(true)
      try {
        const config = routeToConfig(r)
        const res = await screenApi.save(screenId, config)
        if (res.code === 0) {
          setLastSaved(Date.now())
        } else {
          message.warning(`保存失败：${res.message}`)
        }
      } catch (e) {
        message.warning(`保存异常：${(e as Error).message}`)
      } finally {
        setSaving(false)
      }
    }

    const unsub = useDesignerStore.subscribe(() => {
      const snap = getSnapshot()
      if (snap === lastContent) return
      lastContent = snap
      if (timer) clearTimeout(timer)
      timer = setTimeout(doSave, 500)
    })

    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [screenId, isEditor, loading])

  // 缩略图自动截图
  useEffect(() => {
    if (!isEditor || loading) return
    let timer: ReturnType<typeof setTimeout> | null = null
    let lastCaptured = 0
    const capture = async () => {
      const now = Date.now()
      if (now - lastCaptured < 15000) return // 15s 节流
      const el = document.querySelector('.canvas-viewport') as HTMLElement | null
      if (!el) return
      lastCaptured = now
      const thumb = await captureThumbnail(el)
      if (thumb) {
        useDesignerStore.getState().updateRoute(screenId, { thumbnail: thumb })
      }
    }
    const unsub = useDesignerStore.subscribe(() => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(capture, 3000)
    })
    timer = setTimeout(capture, 2000)
    return () => {
      unsub()
      if (timer) clearTimeout(timer)
    }
  }, [screenId, isEditor, loading])

  // 预览实时刷新
  useEffect(() => {
    if (mode !== 'preview' || !refreshing || loading) return
    let alive = true
    const tick = async () => {
      const st = useDesignerStore.getState()
      const r = st.routes.find((x) => x.id === screenId)
      if (!r || !alive) return
      const newComps = await Promise.all(
        r.components.map(async (c) => {
          const ds = c.props.dataSourceId || c.dataSource?.datasetId
          if (!ds) return c
          try {
            const data = await resolveDataSource(ds, c.dataSource)
            if (!data.length) return c
            return { ...c, props: { ...c.props, data } }
          } catch {
            return c
          }
        })
      )
      if (!alive) return
      useDesignerStore.setState((s) => ({
        routes: s.routes.map((x) => (x.id === screenId ? { ...x, components: newComps } : x))
      }))
      if (alive) setLastRefresh(new Date())
    }
    tick()
    const id = setInterval(tick, 3000)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [mode, screenId, refreshing, loading])

  useEffect(() => {
    const onChange = () => setIsFs(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', onChange)
    return () => document.removeEventListener('fullscreenchange', onChange)
  }, [])

  const handlePublish = async () => {
    if (!confirm('确定发布当前版本？')) return
    const res = await screenApi.publish(screenId)
    if (res.code === 0) {
      message.success('发布成功')
    } else {
      message.error(`发布失败：${res.message}`)
    }
  }

  const toggleFs = () => {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.()
  }

  const fmtTime = (t: number) => {
    const d = new Date(t)
    const p = (n: number) => String(n).padStart(2, '0')
    return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <Spin tip="加载大屏中..." />
      </div>
    )
  }

  return (
    <div className="win-app">
      <div className="win-bar">
        <span className="win-title">
          {isEditor ? '大屏编辑器' : '大屏预览'} · {routeName}
          <span style={{ marginLeft: 8, color: '#52c41a', fontSize: 12 }}>[云端]</span>
        </span>
        <span className="win-sep" />
        {isEditor ? (
          <>
            <Button onClick={handlePublish} type="primary">
              发布
            </Button>
          </>
        ) : (
          <>
            <Switch size="small" checked={refreshing} onChange={(v) => setRefreshing(v)} />
            <span style={{ color: '#9aa7b4', fontSize: 12 }}>实时刷新</span>
            <Button
              icon={isFs ? <FullscreenExitOutlined /> : <FullscreenOutlined />}
              onClick={toggleFs}
            >
              {isFs ? '退出全屏' : '全屏查看'}
            </Button>
          </>
        )}
        <ZoomControls />
        <span className="win-spacer" />
        {isEditor && (
          <span className="win-saved">
            {saving ? '保存中...' : lastSaved ? `已保存 ${fmtTime(lastSaved)}` : '未保存'}
          </span>
        )}
        {!isEditor && lastRefresh && (
          <span className="win-saved">刷新于 {lastRefresh.toLocaleTimeString()}</span>
        )}
        <Button icon={<CloseOutlined />} onClick={() => window.close()}>
          关闭页签
        </Button>
      </div>
      <div className="win-body">{isEditor ? <Editor /> : <Renderer />}</div>
    </div>
  )
}

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
      <Button
        type={fit ? 'primary' : 'default'}
        onClick={() => setPage({ fit: true })}
      >
        适应
      </Button>
      <span style={{ color: '#9aa7b4', fontSize: 12 }}>缩放</span>
      <Slider
        style={{ width: 110, margin: 0, opacity: fit ? 0.5 : 1 }}
        min={0.2} max={1} step={0.02}
        value={scale}
        disabled={fit}
        onChange={(v) => setPage({ scale: v as number, fit: false })}
        tooltip={{ formatter: (v) => `${Math.round((v ?? 0) * 100)}%` }}
      />
      <span style={{ color: '#9aa7b4', fontSize: 12, width: 38 }}>
        {fit ? '自动' : Math.round(scale * 100) + '%'}
      </span>
    </>
  )
}
