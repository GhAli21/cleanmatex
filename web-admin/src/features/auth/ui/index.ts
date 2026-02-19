/**
 * Auth Components - Permission-based UI Gating
 *
 * Export all permission-based components for easy importing
 */

export {
  RequirePermission,
  RequireAnyPermission,
  RequireAllPermissions,
  type RequirePermissionProps,
  type RequireAnyPermissionProps,
  type RequireAllPermissionsProps,
} from './RequirePermission'

export {
  RequireResourcePermission,
  RequireAnyResourcePermission,
  RequireAllResourcePermissions,
  type RequireResourcePermissionProps,
  type RequireAnyResourcePermissionProps,
  type RequireAllResourcePermissionsProps,
} from './RequireResourcePermission'

export {
  RequireWorkflowRole,
  RequireAnyWorkflowRole,
  RequireAllWorkflowRoles,
  type RequireWorkflowRoleProps,
  type RequireAnyWorkflowRoleProps,
  type RequireAllWorkflowRolesProps,
} from './RequireWorkflowRole'
