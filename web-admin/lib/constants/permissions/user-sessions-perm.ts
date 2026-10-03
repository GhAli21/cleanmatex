/** User sessions RBAC permission codes (mirror DB sys_auth_permissions.code; seeded by migration 0573). */
export const USER_SESSIONS_PERMISSIONS = {
  /** List active sessions of users in the tenant. */
  READ: 'user_sessions:read',
  /** End user sessions (sign users out of one or all devices). */
  REVOKE: 'user_sessions:revoke',
} as const

export type UserSessionsPermissionCode = (typeof USER_SESSIONS_PERMISSIONS)[keyof typeof USER_SESSIONS_PERMISSIONS]
