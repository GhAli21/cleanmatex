/** Users RBAC permission codes used by the credential-administration routes (mirror DB sys_auth_permissions.code). */
export const USERS_CREDENTIAL_PERMISSIONS = {
  /** Set another user's password, email them a reset link, clear their sign-in lockout (seeded earlier; admin role added by migration 0581). */
  RESET_PASSWORD: 'users:reset_password',
} as const

export type UsersCredentialPermissionCode =
  (typeof USERS_CREDENTIAL_PERMISSIONS)[keyof typeof USERS_CREDENTIAL_PERMISSIONS]
