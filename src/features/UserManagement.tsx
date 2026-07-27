import { useMemo, useState } from 'react'
import { api } from '../mock'
import type { PageResult, RoleDTO, UserDTO, UserStatus } from '../mock'
import { useApi, useDebounced } from './useApi'

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
  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  const toggleStatus = async (u: UserDTO) => {
    await api.setUserStatus(u.id, u.status === 'active' ? 'disabled' : 'active')
    usersState.reload()
  }

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
        <input
          className="search"
          placeholder="搜索姓名 / 邮箱"
          value={keyword}
          onChange={(e) => {
            setKeyword(e.target.value)
            setPage(1)
          }}
        />
        <select
          className="role-filter"
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
        >
          <option value="">全部角色</option>
          {(rolesState.data || []).map((r) => (
            <option key={r.key} value={r.key}>
              {r.name}
            </option>
          ))}
        </select>
        <button className="btn" onClick={() => usersState.reload()}>
          刷新
        </button>
      </div>

      {usersState.loading && <div className="fp-loading">加载中…</div>}
      {usersState.error && (
        <div className="fp-error">
          加载失败：{usersState.error}
          <button className="btn" onClick={() => usersState.reload()}>
            重试
          </button>
        </div>
      )}

      {!usersState.loading && !usersState.error && (
        <table className="data-table">
          <thead>
            <tr>
              <th>姓名</th>
              <th>邮箱</th>
              <th>角色</th>
              <th>组织</th>
              <th>状态</th>
              <th>最近登录</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="fp-empty">
                  无匹配用户
                </td>
              </tr>
            )}
            {rows
              .filter((u) => !roleFilter || u.roles.includes(roleFilter))
              .map((u) => (
                <tr key={u.id}>
                  <td>{u.name}</td>
                  <td className="muted">{u.email}</td>
                  <td>
                    {u.roles.map((r) => (
                      <span key={r} className="role-chip">
                        {roleName[r] || r}
                      </span>
                    ))}
                  </td>
                  <td className="muted">{u.orgId}</td>
                  <td>
                    <span className={'status-dot ' + u.status}>{STATUS_TEXT[u.status]}</span>
                  </td>
                  <td className="muted">{u.lastLogin}</td>
                  <td>
                    <button className="btn sm" onClick={() => toggleStatus(u)}>
                      {u.status === 'active' ? '停用' : '启用'}
                    </button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      )}

      <div className="pager">
        <button className="btn sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
          上一页
        </button>
        <span>
          第 {page} / {totalPages} 页
        </span>
        <button className="btn sm" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)}>
          下一页
        </button>
      </div>
    </div>
  )
}
