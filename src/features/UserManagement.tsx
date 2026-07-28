import { useMemo, useState } from 'react'
import { Alert, Button, Input, Select, Table, type TableProps } from 'antd'
import { SearchOutlined } from '@ant-design/icons'
import { api } from '../mock'
import type { PageResult, RoleDTO, UserDTO, UserStatus } from '../mock'
import { useApi, useDebounced } from './useApi'
import { Tag } from './common'

const STATUS_TEXT: Record<UserStatus, string> = { active: '启用', disabled: '停用' }

export default function UserManagement() {
  const [keyword, setKeyword] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 8
  const debounced = useDebounced(keyword, 300)

  const rolesState = useApi<RoleDTO[]>(() => api.listRoles(), [])
  const usersState = useApi<PageResult<UserDTO>>(
    () => api.listUsers({ keyword: debounced, page, pageSize }),
    [debounced, page]
  )

  const roleName = useMemo(() => {
    const map: Record<string, string> = {}
    ;(rolesState.data || []).forEach((r) => (map[r.key] = r.name))
    return map
  }, [rolesState.data])

  const rows = usersState.data?.list ?? []
  const total = usersState.data?.total ?? 0

  const toggleStatus = async (u: UserDTO) => {
    await api.setUserStatus(u.id, u.status === 'active' ? 'disabled' : 'active')
    usersState.reload()
  }

  // 角色筛选项：全部 + 服务端角色
  const roleOptions = useMemo(
    () => [{ value: '', label: '全部角色' }, ...(rolesState.data || []).map((r) => ({ value: r.key, label: r.name }))],
    [rolesState.data]
  )

  // 表格列：角色用 Tag、状态保留 status-dot 状态点、操作列为启停按钮
  const columns: TableProps<UserDTO>['columns'] = [
    { title: '姓名', dataIndex: 'name', key: 'name' },
    { title: '邮箱', dataIndex: 'email', key: 'email', render: (v: string) => <span className="muted">{v}</span> },
    {
      title: '角色',
      dataIndex: 'roles',
      key: 'roles',
      render: (roles: string[]) => roles.map((r) => <Tag key={r}>{roleName[r] || r}</Tag>),
    },
    { title: '组织', dataIndex: 'orgId', key: 'orgId', render: (v: string) => <span className="muted">{v}</span> },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      render: (s: UserStatus) => <span className={'status-dot ' + s}>{STATUS_TEXT[s]}</span>,
    },
    { title: '最近登录', dataIndex: 'lastLogin', key: 'lastLogin', render: (v: string) => <span className="muted">{v}</span> },
    {
      title: '操作',
      key: 'action',
      render: (_, u) => (
        <Button size="small" onClick={() => toggleStatus(u)}>
          {u.status === 'active' ? '停用' : '启用'}
        </Button>
      ),
    },
  ]

  return (
    <div className="feature-page">
      <div className="fp-head">
        <div>
          <h2 className="fp-title">用户管理</h2>
          <p className="fp-sub">平台账号与角色绑定（RBAC 管控入口）</p>
        </div>
        <span className="fp-count">共 {total} 个用户</span>
      </div>

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
        <Select style={{ minWidth: 140 }} value={roleFilter} options={roleOptions} onChange={setRoleFilter} />
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
        <Table<UserDTO>
          columns={columns}
          dataSource={rows.filter((u) => !roleFilter || u.roles.includes(roleFilter))}
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
