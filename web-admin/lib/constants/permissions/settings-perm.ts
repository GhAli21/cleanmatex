/** Settings module RBAC permission codes (mirror DB sys_auth_permissions_cd.permission_code). */
export const SETTINGS_PERMISSIONS = {
  READ: 'settings:read',
  UPDATE: 'settings:update',
  WORKFLOW: 'settings:workflow',
  WORKFLOW_ROLES_VIEW: 'settings:workflow_roles:view',
} as const

export type SettingsPermissionCode =
  (typeof SETTINGS_PERMISSIONS)[keyof typeof SETTINGS_PERMISSIONS]
