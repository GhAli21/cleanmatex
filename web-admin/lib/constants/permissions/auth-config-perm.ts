/** Auth config RBAC permission codes (mirror DB sys_auth_permissions.code; seeded by migration 0573). */
export const AUTH_CONFIG_PERMISSIONS = {
  /** View the effective sign-in / session policy (Security & Sessions screen). */
  READ: 'auth_config:read',
  /** Change tenant overrides (also gated by plan flag session_timeout_control). */
  UPDATE: 'auth_config:update',
} as const

export type AuthConfigPermissionCode = (typeof AUTH_CONFIG_PERMISSIONS)[keyof typeof AUTH_CONFIG_PERMISSIONS]
