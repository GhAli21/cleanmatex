/** Unit of Measure RBAC permission codes (mirror DB sys_auth_permissions.code, migration 0815). */
export const UOM_PERMISSIONS = {
  VIEW: 'uom:view',
  MANAGE: 'uom:manage',
} as const

export type UomPermissionCode = (typeof UOM_PERMISSIONS)[keyof typeof UOM_PERMISSIONS]
