// 认证状态（zustand）—— 持久化 token / user / perms 到 localStorage
import { create } from 'zustand'

export interface AuthRole {
  code: string
  name: string
}
export interface AuthUser {
  id: string
  email: string
  name: string
  status: string
  orgId: string | null
  roles: AuthRole[]
  permissions: string[]
  lastLoginAt?: string
  createdAt?: string
}

interface AuthState {
  token: string | null
  refreshToken: string | null
  user: AuthUser | null
  perms: string[]
  /** 登录成功：写入 token 与（可选）用户信息 */
  setAuth: (accessToken: string, refreshToken: string, user?: AuthUser | null) => void
  /** 仅刷新令牌 */
  setTokens: (accessToken: string, refreshToken: string) => void
  /** 同步当前用户信息（登录后 / profile 拉取） */
  setUser: (user: AuthUser) => void
  /** 清空登录态 */
  logout: () => void
  /** 是否拥有某权限（支持通配符 * 与 super_admin 角色） */
  hasPerm: (perm: string) => boolean
  /** 是否拥有某角色 */
  hasRole: (role: string) => boolean
  /** 启动时从 localStorage 恢复 */
  hydrate: () => void
}

const K_TOKEN = 'lc_token'
const K_REFRESH = 'lc_refresh'
const K_USER = 'lc_user'

function safeGet(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}
function safeSet(key: string, val: string) {
  try {
    localStorage.setItem(key, val)
  } catch {
    /* ignore */
  }
}
function safeDel(key: string) {
  try {
    localStorage.removeItem(key)
  } catch {
    /* ignore */
  }
}

export const useAuthStore = create<AuthState>((set, get) => ({
  token: null,
  refreshToken: null,
  user: null,
  perms: [],

  setAuth: (accessToken, refreshToken, user) => {
    safeSet(K_TOKEN, accessToken)
    safeSet(K_REFRESH, refreshToken)
    if (user) safeSet(K_USER, JSON.stringify(user))
    set({
      token: accessToken,
      refreshToken,
      user: user ?? get().user,
      perms: user?.permissions ?? get().perms,
    })
  },

  setTokens: (accessToken, refreshToken) => {
    safeSet(K_TOKEN, accessToken)
    safeSet(K_REFRESH, refreshToken)
    set({ token: accessToken, refreshToken })
  },

  setUser: (user) => {
    safeSet(K_USER, JSON.stringify(user))
    set({ user, perms: user.permissions })
  },

  logout: () => {
    safeDel(K_TOKEN)
    safeDel(K_REFRESH)
    safeDel(K_USER)
    set({ token: null, refreshToken: null, user: null, perms: [] })
  },

  hasPerm: (perm) => {
    const { perms, user } = get()
    if (perms.includes('*')) return true
    if (user?.roles.some((r) => r.code === 'super_admin')) return true
    return perms.includes(perm)
  },

  hasRole: (role) => {
    const { user } = get()
    return !!user?.roles.some((r) => r.code === role)
  },

  hydrate: () => {
    const token = safeGet(K_TOKEN)
    const refresh = safeGet(K_REFRESH)
    const rawUser = safeGet(K_USER)
    let user: AuthUser | null = null
    let perms: string[] = []
    if (rawUser) {
      try {
        user = JSON.parse(rawUser)
        perms = user?.permissions ?? []
      } catch {
        /* ignore */
      }
    }
    set({ token, refreshToken: refresh, user, perms })
  },
}))

/** 非组件环境下读取当前 token（供请求拦截器使用），避免循环依赖 */
export function getToken(): string | null {
  return safeGet(K_TOKEN)
}
export function getRefreshToken(): string | null {
  return safeGet(K_REFRESH)
}
export function clearAuthStorage() {
  safeDel(K_TOKEN)
  safeDel(K_REFRESH)
  safeDel(K_USER)
}
