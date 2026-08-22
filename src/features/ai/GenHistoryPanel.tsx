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
  ForkOutlined,
  RollbackOutlined,
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
  /** 回退应用该版本到画布（可选，有回调时渲染按钮） */
  onApplyVersion?: (version: GenVersion) => void
}

const SOURCE_LABEL: Record<
  GenVersion['source'],
  { text: string; full: string }
> = {
  initial: { text: '首次', full: '首次生成' },
  iterate: { text: '迭代', full: '迭代修改' },
  regenerate: { text: '重排', full: '重新生成' },
}

export default function GenHistoryPanel({
  versions,
  activeId,
  onSelect,
  onContinueFrom,
  onRename,
  onDelete,
  onClearAll,
  onApplyVersion,
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
          <span style={COUNT_STYLE}>{versions.length}</span>
        </span>
        <Tooltip title="清空全部历史">
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
            <Button
              type="text"
              size="small"
              danger
              icon={<DeleteOutlined />}
              style={ICON_BUTTON_STYLE}
            />
          </Popconfirm>
        </Tooltip>
      </div>

      <div style={LIST_STYLE}>
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
                borderColor: isActive ? 'var(--accent)' : 'var(--line)',
                background: isActive ? 'var(--panel-hover)' : 'var(--panel)',
              }}
            >
              <div style={ITEM_HEADER}>
                {editingId === v.id ? (
                  <Input
                    size="small"
                    value={editingLabel}
                    onChange={(e) => setEditingLabel(e.target.value)}
                    onPressEnter={() => confirmRename(v.id)}
                    autoFocus
                    style={RENAME_INPUT_STYLE}
                    onClick={(e) => e.stopPropagation()}
                    suffix={
                      <span style={EDIT_SUFFIX_STYLE}>
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
                  <>
                    <div style={ITEM_HEADER_MAIN}>
                      <span style={VERSION_BADGE}>v{v.version}</span>
                      <span style={VERSION_NAME} title={v.label || v.prompt}>
                        {v.label || v.prompt.slice(0, 16) + (v.prompt.length > 16 ? '…' : '')}
                      </span>
                    </div>
                    <div style={ITEM_HEADER_ACTIONS}>
                      <Tooltip title="重命名">
                        <Button
                          type="text"
                          size="small"
                          icon={<EditOutlined />}
                          onClick={(e) => {
                            e.stopPropagation()
                            startRename(v)
                          }}
                          style={ICON_BUTTON_STYLE}
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
                        <Tooltip title="删除版本">
                          <Button
                            type="text"
                            size="small"
                            danger
                            icon={<DeleteOutlined />}
                            onClick={(e) => e.stopPropagation()}
                            style={ICON_BUTTON_STYLE}
                          />
                        </Tooltip>
                      </Popconfirm>
                    </div>
                  </>
                )}
              </div>

              <span
                style={META_LINE}
                title={`${srcInfo.full} · ${compCount} 组件 · ${fmtTime(v.createdAt)}`}
              >
                <span style={{ fontWeight: 500 }}>{srcInfo.text}</span>
                <span>·</span>
                <span>{fmtTime(v.createdAt)}</span>
              </span>

              <div style={ITEM_PROMPT} title={v.prompt}>
                {v.prompt}
              </div>

              <div style={ITEM_ACTIONS} onClick={(e) => e.stopPropagation()}>
                {isActive && (
                  <Tag color="blue" style={ACTIVE_TAG_STYLE}>
                    预览
                  </Tag>
                )}
                <span style={ACTION_GROUP}>
                  <Tooltip title="从此版本修改">
                    <Button
                      size="small"
                      type="text"
                      icon={<ForkOutlined />}
                      onClick={() => onContinueFrom(v)}
                      style={ICON_BUTTON_STYLE}
                    />
                  </Tooltip>
                  {onApplyVersion && (
                    <Popconfirm
                      title={`回退应用到 v${v.version}？`}
                      description="将用该版本覆盖当前画布（可撤销）"
                      onConfirm={(e) => {
                        e?.stopPropagation()
                        onApplyVersion(v)
                      }}
                      onCancel={(e) => e?.stopPropagation()}
                      okText="回退应用"
                      cancelText="取消"
                    >
                      <Tooltip title="回退应用到画布">
                        <Button
                          size="small"
                          type="text"
                          icon={<RollbackOutlined />}
                          onClick={(e) => e.stopPropagation()}
                          style={ICON_BUTTON_STYLE}
                        />
                      </Tooltip>
                    </Popconfirm>
                  )}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ==================== 样式常量（Apple 设计令牌） ====================

const CARD_STYLE: React.CSSProperties = {
  background: 'var(--panel2)',
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-md)',
  padding: 10,
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
}

const HEADER_STYLE: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 8,
  marginBottom: 8,
  paddingBottom: 6,
  borderBottom: '1px solid var(--line)',
  minWidth: 0,
}

const TITLE_STYLE: React.CSSProperties = {
  fontSize: 13,
  fontWeight: 600,
  color: 'var(--txt)',
  display: 'flex',
  alignItems: 'center',
  minWidth: 0,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
}

const COUNT_STYLE: React.CSSProperties = {
  marginLeft: 6,
  padding: '1px 6px',
  background: 'var(--panel-hover)',
  color: 'var(--accent)',
  borderRadius: 'var(--r-sm)',
  fontSize: 10.5,
  fontWeight: 600,
  lineHeight: '16px',
  flexShrink: 0,
}

const LIST_STYLE: React.CSSProperties = {
  maxHeight: 360,
  overflowY: 'auto',
  overflowX: 'hidden',
  paddingRight: 4,
  width: '100%',
  minWidth: 0,
}

const ITEM_STYLE: React.CSSProperties = {
  border: '1px solid var(--line)',
  borderRadius: 'var(--r-md)',
  padding: '6px 8px',
  marginBottom: 6,
  width: '100%',
  maxWidth: '100%',
  minWidth: 0,
  boxSizing: 'border-box',
  cursor: 'pointer',
  transition: 'all var(--t-fast)',
  background: 'var(--panel)',
}

const ITEM_HEADER: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  gap: 4,
  marginBottom: 4,
  minWidth: 0,
}

const ITEM_HEADER_MAIN: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  minWidth: 0,
  flex: 1,
}

const ITEM_HEADER_ACTIONS: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 0,
  flexShrink: 0,
}

const RENAME_INPUT_STYLE: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
}

const EDIT_SUFFIX_STYLE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
}

const VERSION_BADGE: React.CSSProperties = {
  display: 'inline-block',
  padding: '1px 6px',
  background: 'var(--accent-grad-soft)',
  color: 'var(--accent)',
  borderRadius: 'var(--r-sm)',
  fontSize: 11,
  fontWeight: 600,
  fontFamily: 'monospace',
  flexShrink: 0,
}

const VERSION_NAME: React.CSSProperties = {
  fontSize: 12.5,
  color: 'var(--txt)',
  fontWeight: 500,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  flex: 1,
  minWidth: 0,
}

const META_LINE: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  marginBottom: 3,
  minWidth: 0,
  fontSize: 10.5,
  color: 'var(--sub)',
  lineHeight: '18px',
}

const ACTIVE_TAG_STYLE: React.CSSProperties = {
  margin: 0,
  fontSize: 10,
  lineHeight: '18px',
  paddingInline: 5,
  flexShrink: 0,
}

const ITEM_PROMPT: React.CSSProperties = {
  fontSize: 11,
  color: 'var(--sub)',
  lineHeight: 1.4,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
  marginBottom: 4,
  minWidth: 0,
}

const ITEM_ACTIONS: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  alignItems: 'center',
  gap: 2,
  marginTop: 2,
  minWidth: 0,
}

const ACTION_GROUP: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 2,
  flexShrink: 0,
}

const ICON_BUTTON_STYLE: React.CSSProperties = {
  padding: 0,
  minWidth: 22,
  height: 22,
  fontSize: 12,
}
