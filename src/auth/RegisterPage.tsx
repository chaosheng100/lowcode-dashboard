import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../mock/api'
import { useAuthStore } from './store'

export default function RegisterPage() {
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [ok, setOk] = useState(false)
  const navigate = useNavigate()
  const setAuth = useAuthStore((s) => s.setAuth)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErr('')
    if (password.length < 6) {
      setErr('密码至少 6 位')
      return
    }
    setLoading(true)
    try {
      const r = await api.auth.register({ email, name, password })
      if (r.code === 0 && r.data) {
        // 注册成功后自动登录
        const login = await api.auth.login({ email, password })
        if (login.code === 0 && login.data?.accessToken) {
          setAuth(login.data.accessToken, login.data.refreshToken, login.data.user)
          setOk(true)
          setTimeout(() => navigate('/', { replace: true }), 600)
        } else {
          setOk(true)
          setTimeout(() => navigate('/login', { replace: true }), 800)
        }
      } else {
        setErr(r.message || '注册失败')
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
        <h2 style={{ margin: '0 0 4px', color: '#e6edf3' }}>注册账号</h2>
        <p style={{ margin: '0 0 18px', color: '#9aa7b4', fontSize: 13 }}>创建你的平台账号</p>
        <label style={label}>昵称</label>
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="你的名字" />
        <label style={label}>邮箱</label>
        <input style={input} value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <label style={label}>密码（至少 6 位）</label>
        <input style={input} type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
        {err && <div style={{ color: '#ff7875', fontSize: 13, margin: '6px 0' }}>{err}</div>}
        {ok && <div style={{ color: '#52c41a', fontSize: 13, margin: '6px 0' }}>注册成功，正在跳转…</div>}
        <button style={btn} disabled={loading} type="submit">
          {loading ? '提交中…' : '注 册'}
        </button>
        <div style={{ marginTop: 12, fontSize: 13 }}>
          <span style={{ color: '#9aa7b4' }}>已有账号？</span>
          <a href="#/login" style={{ color: '#3b82f6' }}> 登录</a>
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
