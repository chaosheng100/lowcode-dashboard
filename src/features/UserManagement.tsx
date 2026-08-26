import { useMemo, useState } from 'react'
import { Alert, App, Button, Drawer, Input, Select, Table, type TableProps } from 'antd'
import { PlusOutlined, ReloadOutlined, SearchOutlined } from '@ant-design/icons'
import { api } from '../mock/api'
import type { PageResult, RbacRoleDTO, RbacUserDTO } from '../mock/types'
import { useApi, useDebounced } from './useApi'
import { useAuthStore } from '../auth/store'
import { Modal, Field, PageHeader, Tag } from './common'
import { asArray } from '../data/utils/typeGuards'

const STATUS_TEXT: Record<string, string> = { active: '启用', disabled: '停用' }

function NoPermission() {
  return (
    <div className="feature-page">
      <Alert type="warning" showIcon message="无访问权限" description="你的账号暂无「用户管理」权限，请联系管理员。" />
    </div>
  )
}

export default function UserManagement() {
  const { message } = App.useApp()
  const [keyword, setKeyword] = useState('')
  const [page, setPage] = useState(1)
  const pageSize = 8
  const debounced = useDebounced(keyword, 300)
  const [inviting, setInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState('editor')
  const [detail, setDetail] = useState<Record<string, any> | null>(null)
  const invitationsState = useApi(() => api.rbac.listInvitations(), [])
  const membersState = useApi(() => api.rbac.listWorkspaceMembers(), [])

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

  const revokeSessions = async (id: string) => {
    const response = await api.rbac.revokeSessions(id)
    if (response.code === 0) message.success(`已强制下线 ${response.data?.revoked ?? 0} 个会话`)
    else message.error(response.message)
  }

  const openDetail = async (id: string) => {
    const response = await api.rbac.userDetail(id)
    if (response.code === 0) setDetail(response.data as Record<string, any>)
  }

  const sendInvitation = async () => {
    if (!inviteEmail.includes('@')) {
      message.warning('请输入有效邮箱')
      return
    }
    const response = await api.rbac.createInvitation({ email: inviteEmail, role: inviteRole, expiresInDays: 7 })
    if (response.code === 0) {
      message.success(`邀请已创建，令牌：${response.data.inviteToken}`)
      setInviting(false)
      setInviteEmail('')
    } else {
      message.error(response.message)
    }
  }

  const saveMember = async (userId: string, role: string) => {
    const response = await api.rbac.saveWorkspaceMember(userId, role)
    if (response.code === 0) message.success('成员角色已更新')
    else message.error(response.message)
    membersState.reload()
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
        <div className="fp-toolbar" style={{ marginBottom: 0 }}>
          <Button size="small" onClick={() => openDetail(u.id)}>详情</Button>
          <Button size="small" disabled={!hasManage} onClick={() => toggleStatus(u)}>
            {u.status === 'active' ? '停用' : '启用'}
          </Button>
          {hasManage && <Button size="small" onClick={() => revokeSessions(u.id)}>强制下线</Button>}
        </div>
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
        {hasManage && <Button type="primary" icon={<PlusOutlined />} onClick={() => setInviting(true)}>邀请用户</Button>}
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
      {inviting && (
        <Modal title="邀请用户加入工作空间" onClose={() => setInviting(false)}>
          <Field label="邮箱"><Input value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} placeholder="name@example.com" /></Field>
          <Field label="空间角色">
            <Select style={{ width: '100%' }} value={inviteRole} onChange={(role) => setInviteRole(String(role))} options={[
              { value: 'owner', label: 'Owner' }, { value: 'admin', label: 'Admin' }, { value: 'editor', label: 'Editor' }, { value: 'analyst', label: 'Analyst' }, { value: 'viewer', label: 'Viewer' },
            ]} />
          </Field>
          <div className="fp-toolbar"><Button type="primary" onClick={sendInvitation}>创建邀请</Button><Button onClick={() => setInviting(false)}>取消</Button></div>
        </Modal>
      )}
      {detail && (
        <Drawer open width={560} title={`用户详情 · ${String(detail.name || '')}`} onClose={() => setDetail(null)}>
          <div className="muted2" style={{ marginBottom: 12 }}>{String(detail.email || '')} · {detail.status === 'active' ? '启用' : '停用'}</div>
          <div style={{ marginBottom: 8 }}><b>有效权限</b></div>
          <div className="muted2" style={{ marginBottom: 14 }}>{asArray(detail.roles).map((r: any) => r.code).join('、') || '无角色'}</div>
          <div style={{ marginBottom: 8 }}><b>会话</b></div>
          <div className="muted2" style={{ marginBottom: 14 }}>{(detail.sessions?.length ?? 0)} 个会话，最近活跃 {(detail.sessions?.[0]?.lastSeenAt ? new Date(detail.sessions[0].lastSeenAt).toLocaleString() : '—')}</div>
          <div style={{ marginBottom: 8 }}><b>最近审计</b></div>
          <div className="muted2">{(detail.audit ?? []).slice(0, 8).map((a: any) => `${a.action} · ${new Date(a.createdAt).toLocaleString()}`).join('\n') || '暂无记录'}</div>
        </Drawer>
      )}
      <div style={{ marginTop: 18 }}>
        <div className="fp-toolbar"><b>工作空间成员</b><Button icon={<ReloadOutlined />} onClick={membersState.reload} aria-label="刷新成员" /></div>
        <Table
          size="small"
          rowKey="id"
          pagination={false}
          loading={membersState.loading}
          dataSource={membersState.data ?? []}
          columns={[
            { title: '成员', dataIndex: ['user', 'name'], render: (v: string, row: any) => <span>{v || row.userId}<span className="muted"> · {row.user?.email || ''}</span></span> },
            { title: '角色', dataIndex: 'role', render: (v: string) => <Tag>{v}</Tag> },
            { title: '到期', dataIndex: 'expiresAt', render: (v: string | null) => <span className="muted">{v ? new Date(v).toLocaleDateString() : '长期'}</span> },
            {
              title: '操作',
              render: (_, row: any) => hasManage ? (
                <Select style={{ minWidth: 130 }} size="small" value={row.role} onChange={(role) => saveMember(row.userId, String(role))} options={[
                  { value: 'owner', label: 'Owner' }, { value: 'admin', label: 'Admin' }, { value: 'editor', label: 'Editor' }, { value: 'analyst', label: 'Analyst' }, { value: 'viewer', label: 'Viewer' },
                ]} />
              ) : <span className="muted">只读</span>,
            },
          ]}
        />
        <div style={{ marginTop: 18 }}>
          <div className="fp-toolbar"><b>邀请记录</b><Button icon={<ReloadOutlined />} onClick={invitationsState.reload} aria-label="刷新邀请" /></div>
          <Table
            size="small"
            rowKey="id"
            pagination={false}
            loading={invitationsState.loading}
            dataSource={invitationsState.data ?? []}
            columns={[
              { title: '邮箱', dataIndex: 'email' },
              { title: '角色', dataIndex: 'role', render: (v: string) => <Tag>{v}</Tag> },
              { title: '状态', dataIndex: 'status', render: (v: string) => <span className={'status-dot ' + (v === 'pending' ? 'active' : 'disabled')}>{v}</span> },
              { title: '到期', dataIndex: 'expiresAt', render: (v: string) => <span className="muted">{new Date(v).toLocaleDateString()}</span> },
              {
                title: '操作',
                render: (_, row: any) => hasManage && row.status === 'pending' ? (
                  <Button size="small" danger icon={<ReloadOutlined />} onClick={async () => { await api.rbac.revokeInvitation(row.id); invitationsState.reload() }}>撤销</Button>
                ) : <span className="muted">—</span>,
              },
            ]}
          />
        </div>
      </div>
    </div>
  )
}
