/** Setup Health RBAC permission codes (mirror DB sys_auth_permissions.code, seeded by migration 0710). */
export const SETUP_HEALTH_PERMISSIONS = {
  VIEW: 'setup_health:view',
} as const

export type SetupHealthPermissionCode =
  (typeof SETUP_HEALTH_PERMISSIONS)[keyof typeof SETUP_HEALTH_PERMISSIONS]
