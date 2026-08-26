// Authentication and RBAC contracts.
// ---------------- 认证与权限（RBAC） ----------------
export interface AuthRoleDTO {
  code: string
  name: string
}
export interface AuthUserDTO {
  id: string
  email: string
  name: string
  status: string
  orgId: string | null
  roles: AuthRoleDTO[]
  permissions: string[]
  lastLoginAt?: string
  createdAt?: string
}
export interface RbacRoleDTO {
  id: string
  code: string
  name: string
  description: string | null
  isSystem: boolean
  permissions: string[]
}
export interface RbacUserDTO {
  id: string
  email: string
  name: string
  status: string
  orgId: string | null
  lastLoginAt?: string
  createdAt?: string
  roles: AuthRoleDTO[]
}
