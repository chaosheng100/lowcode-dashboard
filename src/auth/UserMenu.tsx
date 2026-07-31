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
      <div
        onClick={() => setOpen((v) => !v)}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '6px 10px',
          borderRadius: 8,
          cursor: 'pointer',
          background: '#0f1a30',
          border: '1px solid rgba(42,66,108,0.35)',
          maxWidth: 160,
          overflow: 'hidden',
        }}
      >
        <span
          style={{
            width: 28,
            height: 28,
            borderRadius: '50%',
            background: '#3b82f6',
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
            <span style={{ fontSize: 13, color: '#e8f0ff', maxWidth: 72, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</span>
            <span style={{ fontSize: 16, color: '#7889a3' }}>▾</span>
          </>
        )}
      </div>
      {open && (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 44,
            width: 200,
            background: '#0f1a30',
            border: '1px solid rgba(42,66,108,0.35)',
            borderRadius: 8,
            padding: 10,
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
            zIndex: 100,
          }}
        >
          <div style={{ fontSize: 12, color: '#7889a3' }}>{user.email}</div>
          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4 }}>
            {(user.roles || []).map((r) => (
              <span
                key={r.code}
                style={{
                  fontSize: 11,
                  padding: '2px 8px',
                  borderRadius: 999,
                  background: 'rgba(0,212,255,0.1)',
                  color: '#00d4ff',
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
              border: '1px solid rgba(248,113,113,0.4)',
              borderRadius: 6,
              color: '#f87171',
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
