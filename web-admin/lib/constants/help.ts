/** Help module permission codes (mirror DB sys_auth_permissions.code). */
export const HELP_PERMISSIONS = {
  PLATFORM_INVENTORIES: 'help:platform_inventories',
} as const

export type HelpPermissionCode = (typeof HELP_PERMISSIONS)[keyof typeof HELP_PERMISSIONS]
