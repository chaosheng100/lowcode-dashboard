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
    <div className="auth-wrap">
      <form onSubmit={submit} className="auth-card">
        <h2 className="auth-title">注册账号</h2>
        <p className="auth-sub">创建你的平台账号</p>
        <label className="auth-label" htmlFor="register-name">昵称</label>
        <input id="register-name" className="auth-input" value={name} onChange={(e) => setName(e.target.value)} placeholder="你的名字" />
        <label className="auth-label" htmlFor="register-email">邮箱</label>
        <input id="register-email" className="auth-input" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
        <label className="auth-label" htmlFor="register-password">密码（至少 6 位）</label>
        <input id="register-password" className="auth-input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
        {err && <div className="auth-error">{err}</div>}
        {ok && <div className="auth-ok">注册成功，正在跳转…</div>}
        <button className="auth-btn" disabled={loading} type="submit">
          {loading ? '提交中…' : '注 册'}
        </button>
        <div className="auth-foot">
          <span>已有账号？</span>
          <a href="#/login">登录</a>
        </div>
      </form>
    </div>
  )
}
