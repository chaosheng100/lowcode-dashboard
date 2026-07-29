import { useEffect, useState } from 'react'
import { Modal, Tag } from 'antd'
import { routesByCapability, CAPABILITY_META, type CanvasCapability } from '../../data/capabilities'
import { api } from '../../mock'
import type { CapabilityRegistryDTO } from '../../mock/types'

interface Props {
  onClose: () => void
}

/**
 * 能力映射总览：把全部基础数据路由显式映射为画布编辑能力，
 * 证明"现有路由一切功能的基础能力都能转化为画布编辑所需要的功能"这一前提。
 */
export default function CapabilityMap({ onClose }: Props) {
  const grouped = routesByCapability()
  const caps = Object.keys(CAPABILITY_META) as CanvasCapability[]
  // 平台实时能力：挂载时拉取开放能力注册表；失败则回退静态映射提示
  const [live, setLive] = useState<CapabilityRegistryDTO | null>(null)
  const [liveFailed, setLiveFailed] = useState(false)
  useEffect(() => {
    let cancelled = false
    api.getOpenCapabilities().then((res) => {
      if (cancelled) return
      if (res.code === 0) setLive(res.data)
      else setLiveFailed(true)
    }).catch(() => { if (!cancelled) setLiveFailed(true) })
    return () => { cancelled = true }
  }, [])

  return (
    <Modal
      open
      onCancel={onClose}
      footer={null}
      width={880}
      title="能力映射 · 基础路由 → 画布编辑能力"
    >
      {/* 平台实时能力（后端开放能力注册表） */}
      <div className="cap-live">
        <div className="sec-title" style={{ marginBottom: 8 }}>平台实时能力</div>
        {live ? (
          <div className="cap-live-grid">
            {live.modules.map((m) => (
              <div className="cap-card" key={m.key}>
                <div className="cap-card-h">
                  <span className="cap-label">{m.name}</span>
                  <span className="cap-count">{m.resources.length}</span>
                </div>
                <div className="cap-routes">
                  {m.resources.map((r) => (
                    <Tag key={r.kind + r.name} title={r.basePath}>
                      {r.kind} · {r.count}
                    </Tag>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="muted2" style={{ color: 'var(--sub)' }}>
            {liveFailed ? '后端未连接，展示静态映射' : '实时能力加载中…'}
          </div>
        )}
      </div>

      <div className="cap-intro">
        设计前提：现有 {Object.keys(routesByCapability).length} 类基础能力，皆可由对应路由沉淀，转化为大屏画布编辑器所需功能。
      </div>
      <div className="cap-grid">
        {caps.map((cap) => {
          const meta = CAPABILITY_META[cap]
          const list = grouped[cap]
          if (!list.length) return null
          return (
            <div className="cap-card" key={cap}>
              <div className="cap-card-h">
                <span className="cap-ico">{meta.icon}</span>
                <span className="cap-label">{meta.label}</span>
                <span className="cap-count">{list.length}</span>
              </div>
              <div className="cap-desc">{meta.desc}</div>
              <div className="cap-routes">
                {list.map((r) => (
                  <Tag key={r.routeId} title={r.description}>
                    {r.routeName}
                  </Tag>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </Modal>
  )
}
