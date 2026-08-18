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
    <div className="auth-wrap">
      <form onSubmit={submit} className="auth-card">
        <img src="/logo.png" alt="低代码大屏平台" className="auth-logo" />
        <h2 className="auth-title">低代码大屏平台</h2>
        <p className="auth-sub">登录以继续使用</p>
        <label className="auth-label" htmlFor="login-email">邮箱</label>
        <input id="login-email" className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <label className="auth-label" htmlFor="login-password">密码</label>
        <input id="login-password" className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
        {err && <div className="auth-error">{err}</div>}
        <button className="auth-btn" disabled={loading} type="submit">
          {loading ? '登录中…' : '登 录'}
        </button>
        <div className="auth-foot">
          <span>还没有账号？</span>
          <a href="#/register">注册</a>
        </div>
        <div className="auth-hint">
          演示账号：admin@demo.com / Admin@123
        </div>
      </form>
    </div>
  )
}
