/** Admin module RBAC permission codes (mirror DB sys_auth_permissions.code). */
export const ADMIN_PERMISSIONS = {
  MANAGE: 'admin:manage',
} as const

export type AdminPermissionCode = (typeof ADMIN_PERMISSIONS)[keyof typeof ADMIN_PERMISSIONS]
