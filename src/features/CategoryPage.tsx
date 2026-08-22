import { useState } from 'react'
import { Alert, Button, Empty, Input, Spin, Tabs } from 'antd'
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons'
import { useApi } from './useApi'
import { governanceApi, type GovernanceTag, type GovernanceTaxonomy } from '../api/governanceResourceApi'
import { Modal, Field, Tag, PageHeader } from './common'

const COLORS = ['#0071e3', '#34c759', '#ff9500', '#af52de', '#ff3b30']

export default function CategoryPage() {
  const tagsState = useApi(() => governanceApi.listTags({ pageSize: 100 }), [])
  const taxonomyState = useApi(() => governanceApi.listTaxonomies({ resourceType: 'all' }), [])
  const [editingTag, setEditingTag] = useState<Partial<GovernanceTag> | null>(null)
  const [editingTaxonomy, setEditingTaxonomy] = useState<Partial<GovernanceTaxonomy> | null>(null)
  const [activeTab, setActiveTab] = useState('tags')

  const saveTag = async () => { if (!editingTag) return; await governanceApi.saveTag(editingTag); setEditingTag(null); tagsState.reload() }
  const saveTaxonomy = async () => { if (!editingTaxonomy) return; await governanceApi.saveTaxonomy(editingTaxonomy); setEditingTaxonomy(null); taxonomyState.reload() }
  const removeTag = async (id: string) => { await governanceApi.deleteTag(id); tagsState.reload() }
  const removeTaxonomy = async (id: string) => { await governanceApi.deleteTaxonomy(id); taxonomyState.reload() }

  return <div className="feature-page">
    <PageHeader title="分类标签" subtitle="统一治理组件、数据集、大屏、资产、地图、代码与插件的导航和检索元数据" actions={<div className="fp-head-actions"><Button icon={<ReloadOutlined />} onClick={() => { tagsState.reload(); taxonomyState.reload() }} aria-label="刷新分类标签" /><Button type="primary" icon={<PlusOutlined />} onClick={() => activeTab === 'tags' ? setEditingTag({ name: '', resourceType: 'all', color: COLORS[0], aliases: [], count: 0 }) : setEditingTaxonomy({ name: '', resourceType: 'all', color: COLORS[0], sortOrder: 0 })}>新建</Button></div>} />
    <Tabs activeKey={activeTab} onChange={setActiveTab} items={[{ key: 'tags', label: '标签库' }, { key: 'taxonomy', label: '分类树' }]} />
    {activeTab === 'tags' && <>
      {tagsState.loading && <div className="fp-loading"><Spin size="small" />正在加载标签</div>}
      {tagsState.error && <Alert type="error" showIcon message={tagsState.error} />}
      {!tagsState.loading && !tagsState.error && !tagsState.data?.list.length && <Empty description="暂无标签" />}
      <div className="grid3">{tagsState.data?.list.map((tag) => <div className="card" key={tag.id}>
        <div className="flex" style={{ justifyContent: 'space-between' }}><b>{tag.name}</b><Tag color={tag.color}>{tag.resourceType}</Tag></div>
        <div className="muted2" style={{ margin: '8px 0' }}>真实关联 {tag.count} 项 · {tag.aliases?.join('、') || '无别名'}</div>
        <div className="fp-toolbar"><Button size="small" onClick={() => setEditingTag(tag)}>编辑</Button><Button size="small" danger onClick={() => removeTag(tag.id)}>停用</Button></div>
      </div>)}</div>
    </>}
    {activeTab === 'taxonomy' && <>
      {taxonomyState.loading && <div className="fp-loading"><Spin size="small" />正在加载分类</div>}
      {taxonomyState.error && <Alert type="error" showIcon message={taxonomyState.error} />}
      {!taxonomyState.loading && !taxonomyState.error && !taxonomyState.data?.length && <Empty description="暂无分类" />}
      <div className="grid3">{taxonomyState.data?.map((taxonomy) => <div className="card" key={taxonomy.id}><div className="flex" style={{ justifyContent: 'space-between' }}><b>{taxonomy.name}</b><Tag color={taxonomy.color}>{taxonomy.resourceType}</Tag></div><div className="muted2">排序 {taxonomy.sortOrder} · {taxonomy.parentId ? '子分类' : '根分类'}</div><div className="fp-toolbar"><Button size="small" onClick={() => setEditingTaxonomy(taxonomy)}>编辑</Button><Button size="small" danger onClick={() => removeTaxonomy(taxonomy.id)}>停用</Button></div></div>)}</div>
    </>}
    {editingTag && <Modal title={editingTag.id ? '编辑标签' : '新建标签'} onClose={() => setEditingTag(null)}><Field label="名称"><Input value={editingTag.name || ''} onChange={(e) => setEditingTag({ ...editingTag, name: e.target.value })} /></Field><Field label="资源域"><Input value={editingTag.resourceType || 'all'} onChange={(e) => setEditingTag({ ...editingTag, resourceType: e.target.value })} /></Field><Field label="别名"><Input value={(editingTag.aliases || []).join(',')} onChange={(e) => setEditingTag({ ...editingTag, aliases: e.target.value.split(/[,，]/).map((v) => v.trim()).filter(Boolean) })} /></Field><Field label="颜色"><div className="flex">{COLORS.map((color) => <button type="button" key={color} aria-label={`选择颜色 ${color}`} onClick={() => setEditingTag({ ...editingTag, color })} style={{ width: 24, height: 24, borderRadius: 12, border: editingTag.color === color ? '3px solid var(--txt)' : '1px solid var(--line)', background: color }} />)}</div></Field><Button type="primary" onClick={saveTag}>保存</Button></Modal>}
    {editingTaxonomy && <Modal title={editingTaxonomy.id ? '编辑分类' : '新建分类'} onClose={() => setEditingTaxonomy(null)}><Field label="名称"><Input value={editingTaxonomy.name || ''} onChange={(e) => setEditingTaxonomy({ ...editingTaxonomy, name: e.target.value })} /></Field><Field label="资源域"><Input value={editingTaxonomy.resourceType || 'all'} onChange={(e) => setEditingTaxonomy({ ...editingTaxonomy, resourceType: e.target.value })} /></Field><Field label="颜色"><div className="flex">{COLORS.map((color) => <button type="button" key={color} aria-label={`选择颜色 ${color}`} onClick={() => setEditingTaxonomy({ ...editingTaxonomy, color })} style={{ width: 24, height: 24, borderRadius: 12, border: editingTaxonomy.color === color ? '3px solid var(--txt)' : '1px solid var(--line)', background: color }} />)}</div></Field><Button type="primary" onClick={saveTaxonomy}>保存</Button></Modal>}
  </div>
}
