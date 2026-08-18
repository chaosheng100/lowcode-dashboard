import { useMemo, useState } from 'react'
import { Alert, Button, Input, Select, Table, type TableProps } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { api } from '../mock/api'
import type { PageResult, RbacRoleDTO, RbacUserDTO } from '../mock/types'
import { useApi, useDebounced } from './useApi'
import { useAuthStore } from '../auth/store'
import { PageHeader } from './common'

const STATUS_TEXT: Record<string, string> = { active: '启用', disabled: '停用' }

function NoPermission() {
  return (
    <div className="feature-page">
      <Alert type="warning" showIcon message="无访问权限" description="你的账号暂无「用户管理」权限，请联系管理员。" />
    </div>
  )
}

export default function UserManagement() {
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 8
  const debounced = useDebounced(keyword, 300)

  const hasView = useAuthStore((s) => s.hasPerm('user:view'))
  const hasManage = useAuthStore((s) => s.hasPerm('user:manage'))

  const rolesState = useApi<RbacRoleDTO[]>(() => api.rbac.listRoles(), [])
  const usersState = useApi<PageResult<RbacUserDTO>>(
    () => api.rbac.listUsers({ keyword: debounced, page, pageSize }),
    [debounced, page]
  )

  const roleOptions = useMemo(
    () => (rolesState.data || []).map((r) => ({ value: r.code, label: r.name })),
    [rolesState.data]
  )

  const rows = usersState.data?.list ?? []
  const total = usersState.data?.total ?? 0

  const toggleStatus = async (u: RbacUserDTO) => {
    await api.rbac.setUserStatus(u.id, u.status === 'active' ? 'disabled' : 'active')
    usersState.reload()
  }

  const changeRoles = async (u: RbacUserDTO, codes: string[]) => {
    await api.rbac.setUserRoles(u.id, codes)
    usersState.reload()
  }

  const columns: TableProps<RbacUserDTO>['columns'] = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '邮箱', dataIndex: 'email', key: 'email', render: (v: string) => <span className="muted">{v}</span> },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: { code: string; name: string }[], u: RbacUserDTO) => (
        <Select
          mode="multiple"
          size="small"
          style={{ minWidth: 160 }}
          value={roles.map((r) => r.code)}
          options={roleOptions}
          disabled={!hasManage}
          onChange={(codes) => changeRoles(u, codes as string[])}
          placeholder="分配角色"
        />
      ),
    },
    { title: '组织', dataIndex: 'orgId', key: 'orgId', render: (v: string) => <span className="muted">{v || '-'}</span> },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: string) => <span className={'status-dot ' + (s as 'active' | 'disabled')}>{STATUS_TEXT[s] || s}</span>,
    },
    {
      title: '最近登录',
      dataIndex: 'lastLoginAt',
      key: 'lastLoginAt',
      render: (v: string) => <span className="muted">{v ? new Date(v).toLocaleString() : '-'}</span>,
    },
    {
      title: '操作',
      key: 'action',
      render: (_, u) => (
        <Button size="small" disabled={!hasManage} onClick={() => toggleStatus(u)}>
          {u.status === 'active' ? '停用' : '启用'}
        </Button>
      ),
    },
  ]

  if (!hasView) return <NoPermission />

  return (
    <div className="feature-page">
      <PageHeader title="用户管理" subtitle="平台账号与角色绑定（RBAC 管控入口）">
<span className="fp-count">共 {total} 个用户</span>
</PageHeader>

      <div className="fp-toolbar">
        <Input
          style={{ width: 260 }}
          placeholder="搜索姓名 / 邮箱"
          prefix={<SearchOutlined />}
          allowClear
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value)
            setPage(1)
          }}
        />
        <Button onClick={() => usersState.reload()}>刷新</Button>
      </div>

      {usersState.error && (
        <Alert
          type="error"
          showIcon
          message={`加载失败：${usersState.error}`}
          action={<Button size="small" onClick={() => usersState.reload()}>重试</Button>}
          style={{ marginBottom: 12 }}
        />
      )}

      {!usersState.error && (
        <Table<RbacUserDTO>
          columns={columns}
          dataSource={rows}
          rowKey="id"
          size="small"
          loading={usersState.loading}
          locale={{ emptyText: '无匹配用户' }}
          pagination={{
            current: page,
            pageSize,
            total,
            onChange: setPage,
            showSizeChanger: false,
            showTotal: (t) => `共 ${t} 个用户`,
          }}
        />
      )}
    </div>
  )
}
