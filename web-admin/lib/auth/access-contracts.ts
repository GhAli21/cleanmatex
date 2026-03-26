/**
 * Shared access contract types for frontend pages and actions.
 *
 * Keeps page-level and action-level authorization metadata in one place so
 * UI gating, debugging, and tests can read the same source of truth.
 */

export interface AccessRequirement {
  permissions?: string[]
  requireAllPermissions?: boolean
  featureFlags?: string[]
  workflowRoles?: string[]
  requireAllWorkflowRoles?: boolean
}

export interface AccessActionContract {
  label: string
  requirement: AccessRequirement
}

export interface PageAccessContract {
  path: string
  label: string
  page: AccessRequirement
  actions?: Record<string, AccessActionContract>
}

export function hasPermissionRequirement(
  requirement: AccessRequirement | undefined,
  userPermissions: string[]
): boolean {
  const requiredPermissions = requirement?.permissions ?? []

  if (requiredPermissions.length === 0) {
    return true
  }

  const matchesPermission = (permissionCode: string) => {
    if (userPermissions.includes(permissionCode)) return true

    const [resource] = permissionCode.split(':')
    return userPermissions.includes('*:*') || userPermissions.includes(`${resource}:*`)
  }

  return requirement?.requireAllPermissions
    ? requiredPermissions.every(matchesPermission)
    : requiredPermissions.some(matchesPermission)
}
