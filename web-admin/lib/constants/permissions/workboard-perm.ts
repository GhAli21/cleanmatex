/**
 * Workboard permissions are intentionally read-only. Workflow changes remain
 * owned by the stage service that receives the operator after triage.
 */
export const WORKBOARD_PERMISSIONS = {
  READ: 'workboard:read',
} as const

/** Permission codes available to the operational workboard. */
export type WorkboardPermissionCode =
  (typeof WORKBOARD_PERMISSIONS)[keyof typeof WORKBOARD_PERMISSIONS]
