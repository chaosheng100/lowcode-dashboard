import type { ReactNode } from 'react'
import { useAuthStore } from './store'
import { isArray } from '../data/utils/typeGuards'

interface Props {
  /** 需要的权限码（resource:action），支持通配符 * 与 super_admin */
  perm?: string | string[]
  /** 需要的角色 code（任一即可） */
  role?: string | string[]
  /** 无权限时的兜底渲染，默认不渲染任何内容 */
  fallback?: ReactNode
  children: ReactNode
}

/**
 * 权限门组件：根据当前登录用户的角色/权限决定子内容是否可见。
 * 用法：<Can perm="user:manage"><Button>删除</Button></Can>
 */
export default function Can({ perm, role, fallback = null, children }: Props) {
  const hasPerm = useAuthStore((s) => s.hasPerm)
  const hasRole = useAuthStore((s) => s.hasRole)

  if (perm) {
    const list = isArray(perm) ? perm : [perm]
    const ok = list.some((p) => hasPerm(p))
    if (!ok) return <>{fallback}</>
  }
  if (role) {
    const list = isArray(role) ? role : [role]
    const ok = list.some((r) => hasRole(r))
    if (!ok) return <>{fallback}</>
  }
  return <>{children}</>
}
