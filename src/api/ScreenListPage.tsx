// ============================================================
// 大屏列表页（对接后端版）
//  - 展示后端 /api/screens 大屏列表
//  - 点击「编辑」→ 打开编辑器窗口（后端持久化模式）
//  - 点击「新建」→ 创建大屏
// ============================================================
import { useEffect, useState } from 'react'
import { App, Button, Empty, Input, Card, Tag, Space, Popconfirm, Modal } from 'antd'
import { PlusOutlined, ReloadOutlined, EditOutlined, EyeOutlined, DeleteOutlined, SearchOutlined } from '@ant-design/icons'
import { screenApi } from './screenApi'
import type { ScreenItem } from './screenApi'

function fmt(iso: string): string {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return iso
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export default function ScreenListPage() {
  const { message } = App.useApp()
  const [screens, setScreens] = useState<ScreenItem[]>([])
  const [loading, setLoading] = useState(false)
  const [kw, setKw] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [newName, setNewName] = useState('')

  const load = async () => {
    setLoading(true)
    const res = await screenApi.list()
    if (res.code === 0 && res.data) setScreens(res.data)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  const filtered = screens.filter((s) =>
    s.name.toLowerCase().includes(kw.toLowerCase()),
  )

  // 打开「新建」弹窗（用 Modal 代替 window.prompt，避免在沙箱/预览环境被禁用）
  const openCreate = () => {
    setNewName(`新大屏 ${screens.length + 1}`)
    setCreateOpen(true)
  }

  const confirmCreate = async () => {
    const name = newName.trim()
    if (!name) {
      message.warning('请输入大屏名称')
      return
    }
    // 在「创建」点击的手势内先开一个窗口（避免被浏览器弹窗拦截器拦截），创建完成后再跳转编辑器
    const win = window.open('', '_blank', 'width=1400,height=900')
    setCreateOpen(false)
    const res = await screenApi.create('default', name)
    if (res.code === 0 && res.data) {
      setScreens((prev) => [res.data!, ...prev])
      const url = buildRemoteUrl('editor', res.data.id)
      if (win) win.location.href = url
      else window.open(url, '_blank', 'width=1400,height=900') // 兜底
    } else {
      if (win) win.close()
      message.error(`创建失败：${res.message}`)
    }
  }

  const handleDelete = async (id: string) => {
    const res = await screenApi.remove(id)
    if (res.code === 0) {
      setScreens((prev) => prev.filter((s) => s.id !== id))
    } else {
      message.error(`删除失败：${res.message}`)
    }
  }

  const handlePublish = async (id: string) => {
    const res = await screenApi.publish(id)
    if (res.code === 0 && res.data) {
      setScreens((prev) => prev.map((s) => (s.id === id ? res.data! : s)))
      message.success('发布成功')
    } else {
      message.error(`发布失败：${res.message}`)
    }
  }

  // 后端持久化模式：必须在 hash 内携带参数（应用使用 HashRouter）
  const buildRemoteUrl = (mode: 'editor' | 'preview', id: string) =>
    `${location.origin}${location.pathname}#/?mode=${mode}&routeId=${encodeURIComponent(id)}&remote=true`

  const openEditor = (id: string) => {
    window.open(buildRemoteUrl('editor', id), '_blank', 'width=1400,height=900')
  }
  const openPreview = (id: string) => {
    window.open(buildRemoteUrl('preview', id), '_blank', 'width=1400,height=900')
  }

  return (
    <div style={{ padding: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <h2 style={{ margin: 0 }}>大屏管理（后端）</h2>
        <Space>
          <Input
            placeholder="搜索大屏名称"
            prefix={<SearchOutlined style={{ opacity: 0.5 }} />}
            value={kw}
            onChange={(e) => setKw(e.target.value)}
            style={{ width: 280 }}
            allowClear
          />
          <Button icon={<ReloadOutlined />} onClick={load}>刷新</Button>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新建大屏
          </Button>
        </Space>
      </div>

      {!loading && filtered.length === 0 ? (
        <Empty description="暂无大屏，点击「新建大屏」创建" />
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
          }}
        >
          {filtered.map((s) => (
            <Card key={s.id} hoverable
              style={{ borderColor: s.status === 'PUBLISHED' ? '#52c41a' : '#d9d9d9' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <strong style={{ fontSize: 16 }}>{s.name}</strong>
                <Tag color={s.status === 'PUBLISHED' ? 'green' : 'default'}>
                  {s.status === 'PUBLISHED' ? '已发布' : '草稿'}
                </Tag>
              </div>
              <div style={{ color: '#999', fontSize: 12, marginBottom: 12 }}>
                更新于 {fmt(s.updatedAt)}
                {s.publishedVersion && ` · v${s.publishedVersion}`}
              </div>
              <div style={{ fontSize: 12, color: '#666', minHeight: 48, marginBottom: 12 }}>
                {s.description || '暂无描述'}
              </div>
              <Space size="small">
                <Button size="small" icon={<EditOutlined />} onClick={() => openEditor(s.id)}>
                  编辑
                </Button>
                <Button size="small" icon={<EyeOutlined />} onClick={() => openPreview(s.id)}>
                  预览
                </Button>
                <Button size="small" onClick={() => handlePublish(s.id)}>
                  发布
                </Button>
                <Popconfirm title="确定删除？" onConfirm={() => handleDelete(s.id)}>
                  <Button size="small" danger icon={<DeleteOutlined />}>
                    删除
                  </Button>
                </Popconfirm>
              </Space>
            </Card>
          ))}
        </div>
      )}

      <Modal
        title="新建大屏"
        open={createOpen}
        onOk={confirmCreate}
        onCancel={() => setCreateOpen(false)}
        okText="创建并打开编辑器"
        cancelText="取消"
        destroyOnHidden
      >
        <Input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="请输入大屏名称"
          onPressEnter={confirmCreate}
          autoFocus
          style={{ marginTop: 8 }}
        />
      </Modal>
    </div>
  )
}
