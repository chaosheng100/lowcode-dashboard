import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../mock/api'
import { useAuthStore } from './store'

export default function LoginPage() {
  const [email, setEmail] = useState('admin@demo.com')
  const [password, setPassword] = useState('Admin@123')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    setLoading(true)
    try {
      const r = await api.auth.login({ email, password })
      if (r.code === 0 && r.data?.accessToken) {
        setAuth(r.data.accessToken, r.data.refreshToken, r.data.user)
        navigate('/', { replace: true })
      } else {
        setErr(r.message || '登录失败')
      }
    } catch {
      setErr('网络异常，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={wrap}>
      <form onSubmit={submit} style={card}>
        <h2 style={{ margin: '0 0 4px', color: '#e6edf3' }}>低代码大屏平台</h2>
        <p style={{ margin: '0 0 18px', color: '#9aa7b4', fontSize: 13 }}>登录以继续使用</p>
        <label style={label}>邮箱</label>
        <input style={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <label style={label}>密码</label>
        <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
        {err && <div style={{ color: '#ff7875', fontSize: 13, margin: '6px 0' }}>{err}</div>}
        <button style={btn} disabled={loading} type="submit">
          {loading ? '登录中…' : '登 录'}
        </button>
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <span style={{ color: '#9aa7b4' }}>还没有账号？</span>
          <a href="#/register" style={{ color: '#3b82f6' }}> 注册</a>
        </div>
        <div style={{ marginTop: 10, fontSize: 12, color: '#5b6776' }}>
          演示账号：admin@demo.com / Admin@123（超级管理员）
        </div>
      </form>
    </div>
  )
}

const wrap: React.CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'linear-gradient(135deg,#0a0e1a,#0d1a33)',
}
const card: React.CSSProperties = {
  width: 340,
  padding: 28,
  background: '#111a27',
  border: '1px solid #1e2a3a',
  borderRadius: 12,
}
const label: React.CSSProperties = { display: 'block', marginTop: 12, marginBottom: 6, color: '#cfe0ff', fontSize: 13 }
const input: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: '#0d1420',
  border: '1px solid #1e2a3a',
  borderRadius: 8,
  color: '#e6edf3',
  fontSize: 14,
}
const btn: React.CSSProperties = {
  width: '100%',
  marginTop: 18,
  padding: '10px',
  background: '#3b82f6',
  border: 'none',
  borderRadius: 8,
  color: '#fff',
  fontSize: 15,
  cursor: 'pointer',
}
