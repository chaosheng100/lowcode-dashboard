// ============================================================
// AI 生成历史版本面板
// —— 展示每次 AI 生成的版本节点，支持切换预览、从某版本继续、重命名、删除
// ============================================================
import { useState } from 'react'
import { App, Button, Input, Popconfirm, Tooltip, Empty, Tag } from 'antd'
import {
  DeleteOutlined,
  EditOutlined,
  HistoryOutlined,
  CheckOutlined,
  CloseOutlined,
  RocketOutlined,
  ReloadOutlined,
  ForkOutlined,
} from '@ant-design/icons'
import type { GenVersion } from './aiGenHistory'

interface Props {
  versions: GenVersion[]
  activeId: string | null
  onSelect: (id: string) => void
  /** 从此版本继续修改（将该版本设为基准，输入框填入修改提示） */
  onContinueFrom: (version: GenVersion) => void
  onRename: (id: string, label: string) => void
  onDelete: (id: string) => void
  onClearAll: () => void
}

const SOURCE_LABEL: Record<GenVersion['source'], { text: string; color: string; icon: React.ReactNode }> = {
  initial: { text: '首次生成', color: 'blue', icon: <RocketOutlined /> },
  iterate: { text: '迭代修改', color: 'green', icon: <ForkOutlined /> },
  regenerate: { text: '重新生成', color: 'orange', icon: <ReloadOutlined /> },
}

export default function GenHistoryPanel({
  versions,
  activeId,
  onSelect,
  onContinueFrom,
  onRename,
  onDelete,
  onClearAll,
}: Props) {
  const { message } = App.useApp()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingLabel, setEditingLabel] = useState('')

  const startRename = (v: GenVersion) => {
    setEditingId(v.id)
    setEditingLabel(v.label || '')
  }

  const confirmRename = (id: string) => {
    onRename(id, editingLabel)
    setEditingId(null)
  }

  const fmtTime = (iso: string) => {
    const d = new Date(iso)
    const pad = (n: number) => String(n).padStart(2, '0')
    return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
  }

  if (!versions.length) {
    return (
      <div style={CARD_STYLE}>
        <div style={HEADER_STYLE}>
          <span style={TITLE_STYLE}>
            <HistoryOutlined style={{ marginRight: 6 }} />
            生成历史
          </span>
        </div>
        <Empty
          image={Empty.PRESENTED_IMAGE_SIMPLE}
          description="还没有生成记录"
          style={{ padding: '20px 0' }}
        />
      </div>
    )
  }

  return (
    <div style={CARD_STYLE}>
      <div style={HEADER_STYLE}>
        <span style={TITLE_STYLE}>
          <HistoryOutlined style={{ marginRight: 6 }} />
          生成历史
          <Tag style={{ marginLeft: 8, fontSize: 11 }} color="default">
            {versions.length} 个版本
          </Tag>
        </span>
        <Popconfirm
          title="确定清空所有生成历史？"
          onConfirm={() => {
            onClearAll()
            message.success('已清空')
          }}
          okText="清空"
          cancelText="取消"
          okButtonProps={{ danger: true }}
        >
          <Button type="text" size="small" danger style={{ fontSize: 12 }}>
            清空
          </Button>
        </Popconfirm>
      </div>

      <div style={{ maxHeight: 380, overflowY: 'auto', paddingRight: 4 }}>
        {versions.map((v) => {
          const isActive = v.id === activeId
          const srcInfo = SOURCE_LABEL[v.source]
          const compCount = v.schema?.components?.length ?? 0

          return (
            <div
              key={v.id}
              onClick={() => onSelect(v.id)}
              style={{
                ...ITEM_STYLE,
                borderColor: isActive ? '#0071e3' : '#e5e5ea',
                background: isActive ? 'rgba(22,119,255,0.08)' : 'transparent',
              }}
            >
              <div style={ITEM_HEADER}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                  <span style={VERSION_BADGE}>v{v.version}</span>
                  {editingId === v.id ? (
                    <Input
                      size="small"
                      value={editingLabel}
                      onChange={(e) => setEditingLabel(e.target.value)}
                      onPressEnter={() => confirmRename(v.id)}
                      autoFocus
                      style={{ width: 100 }}
                      onClick={(e) => e.stopPropagation()}
                      suffix={
                        <span style={{ display: 'flex', gap: 2 }}>
                          <CheckOutlined
                            style={{ color: '#34c759', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              confirmRename(v.id)
                            }}
                          />
                          <CloseOutlined
                            style={{ color: '#ff3b30', cursor: 'pointer' }}
                            onClick={(e) => {
                              e.stopPropagation()
                              setEditingId(null)
                            }}
                          />
                        </span>
                      }
                    />
                  ) : (
                    <span style={VERSION_NAME} title={v.label || v.prompt}>
                      {v.label || v.prompt.slice(0, 14) + (v.prompt.length > 14 ? '…' : '')}
                    </span>
                  )}
                </div>
                <div style={{ display: 'flex', gap: 2 }}>
                  <Tooltip title="重命名">
                    <Button
                      type="text"
                      size="small"
                      icon={<EditOutlined />}
                      onClick={(e) => {
                        e.stopPropagation()
                        startRename(v)
                      }}
                      style={{ padding: '0 4px' }}
                    />
                  </Tooltip>
                  <Popconfirm
                    title="删除此版本？"
                    onConfirm={(e) => {
                      e?.stopPropagation()
                      onDelete(v.id)
                    }}
                    onCancel={(e) => e?.stopPropagation()}
                    okText="删除"
                    cancelText="取消"
                    okButtonProps={{ danger: true }}
                  >
                    <Button
                      type="text"
                      size="small"
                      danger
                      icon={<DeleteOutlined />}
                      onClick={(e) => e.stopPropagation()}
                      style={{ padding: '0 4px' }}
                    />
                  </Popconfirm>
                </div>
              </div>

              <div style={ITEM_META}>
                <Tag icon={srcInfo.icon} color={srcInfo.color} style={{ fontSize: 11, margin: 0 }}>
                  {srcInfo.text}
                </Tag>
                <span style={META_TEXT}>{compCount} 个组件</span>
                <span style={META_TEXT}>{fmtTime(v.createdAt)}</span>
              </div>

              <div style={ITEM_PROMPT} title={v.prompt}>
                {v.prompt}
              </div>

              <div style={ITEM_ACTIONS} onClick={(e) => e.stopPropagation()}>
                <Button
                  type="primary"
                  size="small"
                  onClick={() => onContinueFrom(v)}
                  icon={<ForkOutlined />}
                >
                  从此版本修改
                </Button>
                {isActive && (
                  <Tag color="blue" style={{ margin: 0 }}>
                    当前预览
                  </Tag>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ==================== 样式常量 ====================

const CARD_STYLE: React.CSSProperties = {
  background: '#ffffff',
  border: '1px solid #e5e5ea',
  borderRadius: 10,
  padding: 12,
  minWidth: 280,
}

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 10,
  paddingBottom: 8,
  borderBottom: '1px solid #e5e5ea',
}

const TITLE_STYLE: React.CSSProperties = {
  fontSize: 14,
  fontWeight: 600,
  color: '#1d1d1f',
  display: 'flex',
  alignItems: 'center',
}

const ITEM_STYLE: React.CSSProperties = {
  border: '1px solid #e5e5ea',
  borderRadius: 8,
  padding: '8px 10px',
  marginBottom: 8,
  cursor: 'pointer',
  transition: 'all 0.2s',
}

const ITEM_HEADER: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 4,
}

const VERSION_BADGE: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  background: '#e8f1fb',
  color: '#0071e3',
  borderRadius: 4,
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'monospace',
}

const VERSION_NAME: React.CSSProperties = {
  fontSize: 13,
  color: '#1d1d1f',
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  maxWidth: 140,
}

const ITEM_META: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  marginBottom: 4,
}

const META_TEXT: React.CSSProperties = {
  fontSize: 11,
  color: '#86868b',
}

const ITEM_PROMPT: React.CSSProperties = {
  fontSize: 12,
  color: '#86868b',
  lineHeight: 1.5,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  display: '-webkit-box',
  WebkitLineClamp: 2,
  WebkitBoxOrient: 'vertical',
  marginBottom: 6,
}

const ITEM_ACTIONS: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: 4,
  borderTop: '1px dashed #e5e5ea',
}
