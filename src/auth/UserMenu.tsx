import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../mock/api'
import { useAuthStore } from './store'

/** 用户菜单：展示当前用户/角色，提供登出。compact 模式仅显示头像（用于 ra-head 等窄头部）。 */
export default function UserMenu({ compact = false }: { compact?: boolean }) {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useAuthStore((s) => s.logout)
  const [open, setOpen] = useState(false)

  const doLogout = async () => {
    try {
      await api.auth.logout()
    } catch {
      /* 无状态，忽略 */
    }
    logout()
    navigate('/login', { replace: true })
  }

  if (!user) return null
  const initial = (user.name || user.email || '?').slice(0, 1).toUpperCase()

  return (
    <div style={{ position: 'relative', userSelect: 'none' }}>
      <div className="user-menu-trigger" onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 'var(--r-lg)',
          cursor: 'pointer',
          background: 'var(--panel2)',
          border: '1px solid var(--line)',
          maxWidth: 160,
          overflow: 'hidden', transition: '.2s',
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: 'var(--accent-blue)',
            color: '#fff',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 13,
          }}
        >
          {initial}
        </span>
        {!compact && (
          <>
            <span style={{ fontSize: 13, color: 'var(--txt)', maxWidth: 72, overflow: 'hidden', transition: '.2s', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
            <span style={{ fontSize: 16, color: 'var(--sub)' }}>▾</span>
          </>
        )}
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 44,
            width: 200,
            background: 'var(--panel2)',
            border: '1px solid var(--line)',
            borderRadius: 'var(--r-lg)',
            padding: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.45)',
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: 12, color: 'var(--sub)' }}>{user.email}</div>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(user.roles || []).map((r) => (
              <span
                key={r.code}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'var(--accent-grad-soft)',
                  color: 'var(--accent)',
                }}
              >
                {r.name}
              </span>
            ))}
          </div>
          <button
            onClick={doLogout}
            style={{
              marginTop: 10,
              width: '100%',
              padding: '7px',
              background: 'transparent',
              border: '1px solid var(--danger)',
              borderRadius: 6,
              color: 'var(--danger)',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            退出登录
          </button>
        </div>
      )}
    </div>
  )
}
