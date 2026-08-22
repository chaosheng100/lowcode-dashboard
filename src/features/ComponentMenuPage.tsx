import { useEffect, useMemo, useState } from 'react'
import { Alert, Button, Card, Empty, Input, Select, Spin, Tag as AntTag, Typography } from 'antd'
import { ArrowDownOutlined, ArrowUpOutlined, ReloadOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons'
import { useApi } from './useApi'
import { governanceApi, type GovernanceMenuItem } from '../api/governanceResourceApi'
import { PageHeader, Tag } from './common'

/** 组件菜单管理：设计器、AI 与插件共同消费的可投放目录。 */
export default function ComponentMenuPage() {
  const state = useApi(() => governanceApi.getMenu('default'), [])
  const [items, setItems] = useState<GovernanceMenuItem[]>([])
  const [keyword, setKeyword] = useState('')
  const [group, setGroup] = useState('all')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (state.data?.items) setItems(state.data.items)
  }, [state.data])

  const groups = useMemo(() => Array.from(new Set(items.map((item) => item.groupName || '未分类'))), [items])
  const visibleItems = useMemo(() => {
    const q = keyword.trim().toLowerCase()
    return items.filter((item) => {
      const meta = item.component
      const matchesGroup = group === 'all' || (item.groupName || '未分类') === group
      const matchesKeyword = !q || `${meta?.name || ''} ${meta?.type || item.componentType}`.toLowerCase().includes(q)
      return matchesGroup && matchesKeyword
    })
  }, [group, items, keyword])

  const move = (id: string, delta: -1 | 1) => {
    setItems((current) => {
      const index = current.findIndex((item) => item.id === id)
      const nextIndex = index + delta
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current
      const next = [...current]
      const [moved] = next.splice(index, 1)
      next.splice(nextIndex, 0, moved)
      return next
    })
  }

  const save = async () => {
    if (!state.data) return
    setSaving(true)
    try {
      const response = await governanceApi.reorderMenu(state.data.id, items.map((item) => ({ id: item.id, groupName: item.groupName, visible: item.visible })))
      if (response.code === 0) setItems(response.data.items)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="feature-page">
      <PageHeader
        title="组件菜单"
        subtitle="管理设计器可投放组件的分组、排序与插件能力"
        actions={<div className="fp-head-actions"><AntTag color="blue">{items.length} 个组件</AntTag><Button icon={<ReloadOutlined />} onClick={state.reload} aria-label="刷新组件菜单" /><Button type="primary" icon={<SaveOutlined />} loading={saving} onClick={save}>保存排序</Button></div>}
      />
      <div className="list-toolbar">
        <Input allowClear prefix={<SearchOutlined />} placeholder="搜索名称或组件类型" value={keyword} onChange={(event) => setKeyword(event.target.value)} />
        <Select value={group} style={{ minWidth: 160 }} onChange={setGroup} options={[{ value: 'all', label: '全部分组' }, ...groups.map((name) => ({ value: name, label: name }))]} />
      </div>
      {state.loading && <div className="fp-loading"><Spin size="small" />正在加载组件菜单</div>}
      {state.error && <Alert type="error" showIcon message={state.error} action={<Button size="small" onClick={state.reload}>重试</Button>} />}
      {!state.loading && !state.error && visibleItems.length === 0 && <Empty description="暂无符合条件的组件" />}
      {!state.loading && !state.error && visibleItems.length > 0 && <div className="grid3">
        {visibleItems.map((item) => {
          const meta = item.component
          const index = items.findIndex((current) => current.id === item.id)
          return <Card key={item.id} size="small" title={meta?.name || item.componentType} extra={<Tag>{item.groupName || '未分类'}</Tag>}>
            <Typography.Text type="secondary" ellipsis={{ tooltip: meta?.description || item.componentType }}>{meta?.description || item.componentType}</Typography.Text>
            <div className="fp-toolbar" style={{ marginTop: 12, marginBottom: 0 }}>
              <Tag color="#34c759">v{meta?.version || '1.0.0'}</Tag><Tag color="#6e6e73">{meta?.renderer || '内置渲染器'}</Tag>
              <Button size="small" icon={<ArrowUpOutlined />} disabled={index <= 0} onClick={() => move(item.id, -1)} aria-label={`上移 ${meta?.name || item.componentType}`} />
              <Button size="small" icon={<ArrowDownOutlined />} disabled={index >= items.length - 1} onClick={() => move(item.id, 1)} aria-label={`下移 ${meta?.name || item.componentType}`} />
            </div>
          </Card>
        })}
      </div>}
    </div>
  )
}
