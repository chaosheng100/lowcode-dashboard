import { useEffect, useMemo, useState } from "react"
import { App, Alert, Button, Dropdown, InputNumber, Select, Spin, Switch } from "antd"
import { api } from "../mock"
import type { ApiResp, CarouselDTO } from "../mock/types"
import type { RouteConfig } from "../data/types"
import { useDesignerStore } from "../data/store/useDesignerStore"
import { RouteRenderer } from "../designer/runtime/Renderer"
import { useApi } from "./useApi"
import { Input, Stat } from "./common"

type View =
  | { mode: "list" }
  | { mode: "edit"; item: CarouselDTO }
  | { mode: "preview"; item: CarouselDTO }

type StatusFilter = "all" | "enabled" | "disabled"

const EMPTY_CAROUSEL: CarouselDTO = {
  id: "", name: "", slides: [], intervalSec: 8, enabled: false, updatedAt: ""
}

function getError<T>(response: ApiResp<T>): string | null {
  return response.code === 0 ? null : response.message || "操作失败，请稍后重试"
}

export default function CarouselPage() {
  const { modal } = App.useApp()
  const carousels = useApi(() => api.listCarousels({ pageSize: 100 }), [])
  const routes = useDesignerStore((state) => state.routes)
  const updateRoute = useDesignerStore((state) => state.updateRoute)
  const dashboardList = useMemo(() => routes.filter((route) => route.kind === "dashboard"), [routes])
  const [view, setView] = useState<View>({ mode: "list" })
  const [keyword, setKeyword] = useState("")
  const [status, setStatus] = useState<StatusFilter>("all")
  const [actionId, setActionId] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const dashboardMap = useMemo(
    () => new Map(dashboardList.map((dashboard) => [dashboard.id, dashboard])),
    [dashboardList]
  )
  const items = useMemo(() => {
    const query = keyword.trim().toLowerCase()
    return [...(carousels.data?.list ?? [])]
      .filter((item) => !query || item.name.toLowerCase().includes(query))
      .filter((item) => status === "all" || (status === "enabled" ? item.enabled : !item.enabled))
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  }, [carousels.data, keyword, status])

  const syncCarouselRefs = () => {
    const allCarousels = carousels.data?.list ?? []
    const refMap = new Map<string, string[]>()
    for (const carousel of allCarousels) {
      for (const slideId of carousel.slides) {
        if (!refMap.has(slideId)) refMap.set(slideId, [])
        refMap.get(slideId)!.push(carousel.id)
      }
    }
    for (const route of dashboardList) {
      const carouselIds = refMap.get(route.id) ?? []
      const current = Array.isArray(route.state.carouselIds) ? route.state.carouselIds : []
      if (JSON.stringify([...carouselIds].sort()) !== JSON.stringify([...current].sort())) {
        updateRoute(route.id, { state: { ...route.state, carouselIds } })
      }
    }
  }

  const refresh = () => {
    carousels.reload()
    setNotice(null)
  }

  const save = async (item: CarouselDTO) => {
    const response = await api.saveCarousel(item)
    const error = getError(response)
    if (error) throw new Error(error)
    refresh()
    syncCarouselRefs()
    setView({ mode: "list" })
  }

  const toggle = async (item: CarouselDTO) => {
    if (!item.slides.length && !item.enabled) {
      setNotice("请先为该方案配置至少一个轮播大屏")
      return
    }
    setActionId(item.id)
    const response = await api.saveCarousel({ id: item.id, enabled: !item.enabled })
    setActionId(null)
    const error = getError(response)
    if (error) setNotice(error)
    else { refresh(); syncCarouselRefs() }
  }

  const duplicate = async (item: CarouselDTO) => {
    setActionId(item.id)
    const response = await api.saveCarousel({
      name: `${item.name} - 副本`, slides: [...item.slides], intervalSec: item.intervalSec, enabled: false
    })
    setActionId(null)
    const error = getError(response)
    if (error) setNotice(error)
    else { refresh(); setView({ mode: "edit", item: response.data }) }
  }

  const remove = (item: CarouselDTO) => {
    modal.confirm({
      title: "删除轮播方案",
      content: `确定删除「${item.name}」？此操作不可恢复。`,
      okText: "删除",
      cancelText: "取消",
      okButtonProps: { danger: true },
      onOk: async () => {
        setActionId(item.id)
        const response = await api.deleteCarousel(item.id)
        setActionId(null)
        const error = getError(response)
        if (error) { setNotice(error); return }
        refresh()
        syncCarouselRefs()
      }
    })
  }

  if (view.mode === "edit") {
    return (
      <CarouselEditor key={view.item.id || "new"} item={view.item} dashboards={dashboardList}
        onCancel={() => setView({ mode: "list" })} onSave={save} />
    )
  }

  if (view.mode === "preview") {
    return (
      <CarouselPreview item={view.item} dashboards={dashboardMap}
        onBack={() => setView({ mode: "list" })} onEdit={() => setView({ mode: "edit", item: view.item })} />
    )
  }

  const enabledCount = (carousels.data?.list ?? []).filter((item) => item.enabled).length

  return (
    <main className="feature-page carousel-page">
      <header className="carousel-head">
        <div><h1 className="fp-title">轮播管理</h1><p className="fp-sub">编排大屏播放顺序、切换频率与运行状态</p></div>
        <Button type="primary" onClick={() => setView({ mode: "edit", item: EMPTY_CAROUSEL })}>＋ 新建方案</Button>
      </header>
      <section aria-label="轮播方案概览" style={{ display: "flex", gap: 12 }}>
        <Stat label="全部方案" value={carousels.data?.total ?? 0} accent="#4f8cff" />
        <Stat label="运行中" value={enabledCount} accent="#4ade80" />
        <Stat label="已停用" value={Math.max(0, (carousels.data?.total ?? 0) - enabledCount)} accent="#9fb0c3" />
      </section>
      <div className="carousel-toolbar">
        <Input style={{ width: 320 }} placeholder="按名称搜索…" value={keyword} onChange={(e) => setKeyword(e.target.value)} />
        <Select
          style={{ width: 120 }}
          value={status}
          onChange={(v: StatusFilter) => setStatus(v)}
          options={[
            { value: "all", label: "全部状态" },
            { value: "enabled", label: "运行中" },
            { value: "disabled", label: "已停用" }
          ]}
        />
      </div>
      {notice && <Alert type="warning" closable message={notice} onClose={() => setNotice(null)} style={{ marginBottom: 10 }} />}
      <section className="carousel-list">
        {carousels.loading && <div style={{ padding: 40, textAlign: "center" }}><Spin /></div>}
        {carousels.error && <Alert type="error" message={`加载失败：${carousels.error}`} />}
        {!carousels.loading && !carousels.error && (
          <div className="carousel-grid">
            {items.map((item) => (
              <div className="carousel-card" key={item.id}>
                <div className="carousel-card-thumb">
                  <span className="carousel-badge">{item.enabled ? "运行中" : "已停用"}</span>
                  <span className="carousel-slide-count">{item.slides.length} 屏</span>
                </div>
                <div className="carousel-card-info">
                  <div className="carousel-card-name">{item.name}</div>
                  <div className="carousel-card-meta">每 {item.intervalSec} 秒切换 · 更新于 {item.updatedAt}</div>
                  <div className="carousel-card-actions">
                    <Button size="small" onClick={() => setView({ mode: "preview", item })} disabled={actionId === item.id}>预览</Button>
                    <Button size="small" onClick={() => setView({ mode: "edit", item })} disabled={actionId === item.id}>编辑</Button>
                    <Switch size="small" checked={item.enabled} loading={actionId === item.id} onChange={() => toggle(item)} />
                    <Dropdown
                      trigger={["click"]}
                      menu={{
                        items: [
                          { key: "duplicate", label: "复制方案" },
                          { key: "delete", label: "删除方案", danger: true }
                        ],
                        onClick: ({ key }) => {
                          if (key === "duplicate") duplicate(item)
                          if (key === "delete") remove(item)
                        }
                      }}
                    >
                      <Button size="small">更多</Button>
                    </Dropdown>
                  </div>
                </div>
              </div>
            ))}
            {!items.length && <div className="carousel-empty">没有匹配的轮播方案</div>}
          </div>
        )}
      </section>
    </main>
  )
}

interface EditorProps {
  item: CarouselDTO
  dashboards: RouteConfig[]
  onCancel: () => void
  onSave: (item: CarouselDTO) => void
}

function CarouselEditor({ item, dashboards, onCancel, onSave }: EditorProps) {
  const dashboardMap = useMemo(() => new Map(dashboards.map((d) => [d.id, d])), [dashboards])
  const [name, setName] = useState(item.name || "")
  const [slides, setSlides] = useState<string[]>(item.slides ?? [])
  const [intervalSec, setIntervalSec] = useState(item.intervalSec ?? 8)
  const [dashboardId, setDashboardId] = useState("")
  const available = useMemo(() => dashboards.filter((d) => !slides.includes(d.id)), [dashboards, slides])

  const addSlide = () => {
    if (!dashboardId) return
    if (slides.includes(dashboardId)) return
    setSlides((current) => [...current, dashboardId])
    setDashboardId("")
  }

  const move = (index: number, offset: -1 | 1) => {
    const target = index + offset
    if (target < 0 || target >= slides.length) return
    setSlides((current) => {
      const next = [...current]
      ;[next[index], next[target]] = [next[target], next[index]]
      return next
    })
  }

  const submit = () => {
    if (!name.trim()) return
    onSave({ ...item, name: name.trim(), slides, intervalSec })
  }

  return (
    <main className="carousel-editor">
      <header className="carousel-editor-head">
        <div><h1 className="fp-title">轮播方案编辑器</h1><p className="fp-sub">选择已发布大屏，按顺序编排轮播</p></div>
        <div className="carousel-editor-actions">
          <Button onClick={onCancel}>返回列表</Button>
          <Button type="primary" onClick={submit} disabled={!name.trim()}>保存方案</Button>
        </div>
      </header>
      <div className="carousel-editor-body">
        <section className="carousel-editor-config">
          <label className="field"><span>方案名称</span><Input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field"><span>切换间隔（秒）</span><InputNumber style={{ width: "100%" }} min={3} max={120} value={intervalSec} onChange={(v) => setIntervalSec(v ?? 8)} /></label>
        </section>
        <section className="carousel-editor-sequence">
          <h3>轮播序列</h3>
          <div className="carousel-sequence-add">
            <Select
              style={{ flex: 1 }}
              value={dashboardId || undefined}
              placeholder={available.length ? "选择一个大屏" : "没有更多可添加的大屏"}
              disabled={!available.length}
              onChange={(v: string) => setDashboardId(v)}
              options={available.map((d) => ({ value: d.id, label: d.name }))}
            />
            <Button type="primary" onClick={addSlide} disabled={!dashboardId}>添加</Button>
          </div>
          <ol className="carousel-sequence-list">
            {slides.map((id, index) => {
              const dashboard = dashboardMap.get(id)
              return (
                <li key={id}>
                  <span className="carousel-sequence-index">{String(index + 1).padStart(2, "0")}</span>
                  <div><strong>{dashboard?.name ?? "大屏已删除"}</strong>
                    <span>{dashboard ? `设计器大屏 · ${dashboard.components.length} 个组件` : id}</span></div>
                  <div className="carousel-sequence-actions">
                    <Button type="text" size="small" title="上移" aria-label={`上移 ${dashboard?.name ?? id}`} onClick={() => move(index, -1)} disabled={index === 0}>↑</Button>
                    <Button type="text" size="small" title="下移" aria-label={`下移 ${dashboard?.name ?? id}`} onClick={() => move(index, 1)} disabled={index === slides.length - 1}>↓</Button>
                    <Button type="text" size="small" danger title="移除" aria-label={`移除 ${dashboard?.name ?? id}`} onClick={() => setSlides((current) => current.filter((sid) => sid !== id))}>×</Button>
                  </div>
                </li>
              )
            })}
            {!slides.length && <li className="carousel-sequence-empty">从上方选择已发布大屏，按添加顺序播放</li>}
          </ol>
        </section>
      </div>
    </main>
  )
}

interface PreviewProps {
  item: CarouselDTO
  dashboards: Map<string, RouteConfig>
  onBack: () => void
  onEdit: () => void
}

function CarouselPreview({ item, dashboards, onBack, onEdit }: PreviewProps) {
  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(true)
  const active = dashboards.get(item.slides[index])
  const total = item.slides.length
  const go = (offset: -1 | 1) => setIndex((current) => (current + offset + total) % total)
  useEffect(() => {
    if (!playing || total < 2) return
    const timer = window.setInterval(() => setIndex((current) => (current + 1) % total), item.intervalSec * 1000)
    return () => window.clearInterval(timer)
  }, [item.intervalSec, playing, total])
  return (
    <main className="carousel-preview" tabIndex={0} onKeyDown={(event) => {
      if (event.key === "ArrowLeft") go(-1)
      if (event.key === "ArrowRight") go(1)
      if (event.key === " ") { event.preventDefault(); setPlaying((value) => !value) }
    }}>
      <header>
        <div><Button type="text" onClick={onBack}>← 返回列表</Button><strong>{item.name}</strong>
          <span className={item.enabled ? "carousel-state enabled" : "carousel-state"}>{item.enabled ? "运行中" : "预览模式"}</span></div>
        <div><Button onClick={onEdit}>编辑方案</Button>
          <Button type="primary" onClick={() => setPlaying((value) => !value)}>{playing ? "暂停" : "继续播放"}</Button></div>
      </header>
      <section className="carousel-stage" aria-live="polite" aria-label={active?.name ?? "大屏已删除"}>
        {active ? <RouteRenderer key={active.id} route={active} /> : <div className="carousel-stage-missing"><strong>大屏已删除</strong><span>请返回编辑器移除失效大屏</span></div>}
        <div className="carousel-stage-label"><span>{String(index + 1).padStart(2, "0")}</span><strong>{active?.name ?? "大屏已删除"}</strong></div>
        {total > 1 && <><button className="carousel-stage-nav prev" onClick={() => go(-1)} aria-label="上一个大屏">‹</button>
          <button className="carousel-stage-nav next" onClick={() => go(1)} aria-label="下一个大屏">›</button></>}
      </section>
      <footer className="carousel-preview-footer">
        <div className="carousel-dots" aria-label="轮播进度">
          {item.slides.map((id, dotIndex) => <button key={id} className={dotIndex === index ? "active" : ""} onClick={() => setIndex(dotIndex)} aria-label={`转到第 ${dotIndex + 1} 个大屏`} />)}
        </div>
        <span>第 {index + 1} / {total} 屏 · 每 {item.intervalSec} 秒切换</span>
      </footer>
    </main>
  )
}
