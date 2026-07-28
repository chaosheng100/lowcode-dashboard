import { Modal, Tag } from 'antd'
import { routesByCapability, CAPABILITY_META, type CanvasCapability } from '../../data/capabilities'

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

  return (
    <Modal
      open
      onCancel={onClose}
      footer={null}
      width={880}
      title="能力映射 · 基础路由 → 画布编辑能力"
    >
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
