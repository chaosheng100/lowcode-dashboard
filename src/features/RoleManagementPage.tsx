import { useMemo, useState } from 'react'
import { Alert, Button, Modal, Table, Tag, type TableProps } from 'antd'
import { api } from '../mock/api'
import type { RbacRoleDTO } from '../mock/types'
import { useApi } from './useApi'
import { useAuthStore } from '../auth/store'

const ALL_PERMS = [
  { group: '用户', perms: ['user:view', 'user:manage'] },
  { group: '角色', perms: ['role:view', 'role:manage'] },
  { group: '大屏', perms: ['screen:view', 'screen:edit', 'screen:publish'] },
  { group: '组件', perms: ['widget:view', 'widget:manage'] },
  { group: '系统', perms: ['system:params', 'system:logs', 'system:monitor'] },
]

function NoPermission() {
  return (
    <div className="feature-page">
      <Alert type="warning" showIcon message="无访问权限" description="你的账号暂无「角色管理」权限，请联系管理员。" />
    </div>
  )
}

export default function RoleManagementPage() {
  const [editing, setEditing] = useState<RbacRoleDTO | null>(null)
  const [checked, setChecked] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  const hasView = useAuthStore((s) => s.hasPerm('role:view'))
  const hasManage = useAuthStore((s) => s.hasPerm('role:manage'))
  const rolesState = useApi<RbacRoleDTO[]>(() => api.rbac.listRoles(), [])

  const openEdit = (r: RbacRoleDTO) => {
    setEditing(r)
    setChecked(r.permissions || [])
  }
  const closeEdit = () => setEditing(null)

  const save = async () => {
    if (!editing) return
    setSaving(true)
    try {
      await api.rbac.updateRole(editing.id, { permissions: checked })
      rolesState.reload()
      closeEdit()
    } finally {
      setSaving(false)
    }
  }

  const remove = async (r: RbacRoleDTO) => {
    if (r.isSystem) return
    await api.rbac.deleteRole(r.id)
    rolesState.reload()
  }

  const columns: TableProps<RbacRoleDTO>['columns'] = [
    { title: '角色名称', dataIndex: 'name', key: 'name' },
    { title: '编码', dataIndex: 'code', key: 'code', render: (v: string) => <span className="muted">{v}</span> },
    {
      title: '权限',
      dataIndex: 'permissions',
      key: 'permissions',
      render: (perms: string[]) => (
        <>
          {perms.includes('*') ? (
            <Tag color="gold">全部权限 *</Tag>
          ) : (
            perms.map((p) => (
              <Tag key={p} color="blue">
                {p}
              </Tag>
            ))
          )}
        </>
      ),
    },
    {
      title: '类型',
      dataIndex: 'isSystem',
      key: 'isSystem',
      render: (v: boolean) => (v ? <Tag color="default">系统内置</Tag> : <Tag color="green">自定义</Tag>),
    },
    {
      title: '操作',
      key: 'action',
      render: (_, r) => (
        <>
          <Button size="small" disabled={!hasManage} onClick={() => openEdit(r)}>
            配置权限
          </Button>
          <Button
            size="small"
            danger
            disabled={!hasManage || r.isSystem}
            style={{ marginLeft: 8 }}
            onClick={() => remove(r)}
          >
            删除
          </Button>
        </>
      ),
    },
  ]

  if (!hasView) return <NoPermission />

  const groupedPerms = useMemo(() => ALL_PERMS, [])

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">角色管理</h2>
          <p className="fp-sub">基于 RBAC 的权限分配（权限码格式 resource:action）</p>
        </div>
        <span className="fp-count">共 {rolesState.data?.length ?? 0} 个角色</span>
      </div>

      {rolesState.error && (
        <Alert
          type="error"
          showIcon
          message={`加载失败：${rolesState.error}`}
          action={<Button size="small" onClick={() => rolesState.reload()}>重试</Button>}
          style={{ marginBottom: 12 }}
        />
      )}

      <Table<RbacRoleDTO>
        columns={columns}
        dataSource={rolesState.data || []}
        rowKey="id"
        size="small"
        loading={rolesState.loading}
        locale={{ emptyText: '无角色' }}
        pagination={false}
      />

      <Modal
        title={`配置权限 — ${editing?.name ?? ''}`}
        open={!!editing}
        onCancel={closeEdit}
        onOk={save}
        confirmLoading={saving}
        okText="保存"
        cancelText="取消"
      >
        {groupedPerms.map((g) => (
          <div key={g.group} style={{ marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: '#86868b', marginBottom: 6 }}>{g.group}</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {g.perms.map((p) => {
                const on = checked.includes(p)
                return (
                  <Tag.CheckableTag
                    key={p}
                    checked={on}
                    disabled={!hasManage}
                    onChange={(v) => setChecked((prev) => (v ? [...prev, p] : prev.filter((x) => x !== p)))}
                  >
                    {p}
                  </Tag.CheckableTag>
                )
              })}
            </div>
          </div>
        ))}
      </Modal>
    </div>
  )
}
