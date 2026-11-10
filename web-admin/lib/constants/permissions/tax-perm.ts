/** Tax RBAC permission codes (mirror DB sys_auth_permissions.code). */
export const TAX_PERMISSIONS = {
  VIEW_CONFIG: 'tax:view_config',
  MANAGE_CONFIG: 'tax:manage_config',
  VIEW_REPORTS: 'tax:view_reports',
} as const

export type TaxPermissionCode = (typeof TAX_PERMISSIONS)[keyof typeof TAX_PERMISSIONS]
