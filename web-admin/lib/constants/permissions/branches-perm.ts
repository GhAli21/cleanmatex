/** Branch RBAC permission codes (mirror DB sys_auth_permissions.code). */
export const BRANCHES_PERMISSIONS = {
  READ: 'branches:read',
  /** A branch's own settings, e.g. its Business Calendar. */
  SETTINGS: 'branches:settings',
} as const;

export type BranchesPermissionCode = (typeof BRANCHES_PERMISSIONS)[keyof typeof BRANCHES_PERMISSIONS];
