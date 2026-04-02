/**
 * User RBAC API Client — Extended role/permission operations
 *
 * Complements lib/api/users.ts with workflow roles, resource-scoped roles,
 * permission override saves, and permissions rebuild.
 *
 * All calls go to platform-api (port 3002) via rbacFetch.
 * Auth: pass session.access_token from useAuth()
 *
 * DB tables backing these endpoints:
 *   org_auth_user_roles              → tenant-level roles
 *   org_auth_user_resource_roles     → resource-scoped roles (branch/store/pos/route/device)
 *   org_auth_user_workflow_roles     → workflow roles (ROLE_RECEPTION, ROLE_PREPARATION, etc.)
 *   org_auth_user_permissions        → global permission overrides
 *   org_auth_user_resource_permissions → resource-scoped permission overrides
 *   cmx_effective_permissions        → pre-computed effective permissions cache
 */

import { rbacFetch } from './rbac-client'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Tenant-level role assigned to a user.
 * Maps to org_auth_user_roles joined with sys_auth_roles.
 */
export interface UserRole {
  /** Role string code (primary identifier, matches sys_auth_roles.code) */
  role_code: string
  /** English name */
  name: string
  /** Arabic name */
  name2?: string
  /** true for built-in system roles */
  is_system: boolean
  /** Number of permissions granted by this role */
  permission_count?: number
  /** ISO timestamp when role was assigned */
  assigned_at: string
}

/**
 * Resource-scoped role assigned to a user.
 * Maps to org_auth_user_resource_roles joined with sys_auth_roles.
 */
export interface UserResourceRole {
  /** Role string code */
  role_code: string
  /** English name */
  name: string
  /** Arabic name */
  name2?: string
  /** Resource type: branch | store | pos | route | device */
  resource_type: 'branch' | 'store' | 'pos' | 'route' | 'device'
  /** UUID of the resource */
  resource_id: string
  /** ISO timestamp when role was assigned */
  assigned_at: string
}

/**
 * Workflow role assigned to a user.
 * Maps to org_auth_user_workflow_roles.
 */
export interface UserWorkflowRole {
  /** Workflow role code: ROLE_RECEPTION | ROLE_PREPARATION | ROLE_PROCESSING | ROLE_QA | ROLE_DELIVERY | ROLE_ADMIN */
  workflow_role: string
  /** ISO timestamp when role was assigned */
  assigned_at?: string
}

/**
 * Global (tenant-wide) permission override for a user.
 * Maps to org_auth_user_permissions.
 */
export interface UserPermissionOverride {
  /** Permission code in resource:action format */
  permission_code: string
  /** true = explicit allow, false = explicit deny */
  allow: boolean
  created_at?: string
  created_by?: string
}

/**
 * Resource-scoped permission override for a user.
 * Maps to org_auth_user_resource_permissions.
 */
export interface UserResourcePermissionOverride {
  /** Permission code in resource:action format */
  permission_code: string
  /** true = explicit allow, false = explicit deny */
  allow: boolean
  /** Resource type: branch | store | pos | route | device */
  resource_type: string
  /** UUID of the resource */
  resource_id: string
  created_at?: string
  created_by?: string
}

/** Full role assignments response — tenant-level + resource-scoped */
export interface UserRolesResponse {
  tenant_roles: UserRole[]
  resource_roles: UserResourceRole[]
}

/** Workflow roles response */
export interface UserWorkflowRolesResponse {
  workflow_roles: UserWorkflowRole[]
}

/** Permission overrides response — global + resource-scoped */
export interface UserPermissionOverridesResponse {
  global_overrides: UserPermissionOverride[]
  resource_overrides: UserResourcePermissionOverride[]
}

// ---------------------------------------------------------------------------
// Role assignment functions
// ---------------------------------------------------------------------------

/**
 * Get all role assignments for a user — both tenant-level and resource-scoped.
 * GET /tenants/{tenantId}/users/{userId}/roles
 *
 * @returns { tenant_roles, resource_roles }
 */
export async function getUserRolesExtended(
  userId: string,
  tenantId: string,
  accessToken: string
): Promise<UserRolesResponse> {
  const response = await rbacFetch<UserRolesResponse | UserRole[]>(
    `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/roles`,
    accessToken
  )
  // Handle both shaped response and flat array (backwards compat)
  if (Array.isArray(response)) {
    return { tenant_roles: response as UserRole[], resource_roles: [] }
  }
  if (response && ('tenant_roles' in response || 'resource_roles' in response)) {
    return {
      tenant_roles: (response as UserRolesResponse).tenant_roles ?? [],
      resource_roles: (response as UserRolesResponse).resource_roles ?? [],
    }
  }
  return { tenant_roles: [], resource_roles: [] }
}

/**
 * Assign (or replace) tenant-level roles for a user.
 * POST /tenants/{tenantId}/users/{userId}/roles
 *
 * @param roleCodes - Full list of role codes to assign (replaces existing)
 * @param resourceType - Optional: if provided, assign as resource-scoped role
 * @param resourceId   - Optional: resource UUID (required when resourceType set)
 */
export async function assignRoles(
  userId: string,
  tenantId: string,
  roleCodes: string[],
  accessToken: string,
  resourceType?: string,
  resourceId?: string
): Promise<void> {
  const body: Record<string, unknown> = { role_codes: roleCodes }
  if (resourceType) body.resource_type = resourceType
  if (resourceId) body.resource_id = resourceId

  await rbacFetch<void>(
    `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/roles`,
    accessToken,
    { method: 'POST', body }
  )
}

/**
 * Remove a single role from a user.
 * DELETE /tenants/{tenantId}/users/{userId}/roles/{roleCode}
 */
export async function removeRole(
  userId: string,
  tenantId: string,
  roleCode: string,
  accessToken: string
): Promise<void> {
  await rbacFetch<void>(
    `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/roles/${encodeURIComponent(roleCode)}`,
    accessToken,
    { method: 'DELETE' }
  )
}

// ---------------------------------------------------------------------------
// Workflow role functions
// ---------------------------------------------------------------------------

/**
 * Get all workflow roles assigned to a user.
 * GET /tenants/{tenantId}/users/{userId}/workflow-roles
 */
export async function getUserWorkflowRoles(
  userId: string,
  tenantId: string,
  accessToken: string
): Promise<UserWorkflowRolesResponse> {
  const response = await rbacFetch<UserWorkflowRolesResponse | UserWorkflowRole[] | string[]>(
    `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/workflow-roles`,
    accessToken
  )
  if (Array.isArray(response)) {
    // Handle both string[] and UserWorkflowRole[]
    const roles = response.map((r) =>
      typeof r === 'string' ? { workflow_role: r } : (r as UserWorkflowRole)
    )
    return { workflow_roles: roles }
  }
  if (response && 'workflow_roles' in response) {
    return response as UserWorkflowRolesResponse
  }
  return { workflow_roles: [] }
}

/**
 * Assign (replace) workflow roles for a user.
 * POST /tenants/{tenantId}/users/{userId}/workflow-roles
 *
 * @param workflowRoles - Full list of workflow role codes to assign (replaces existing)
 */
export async function assignWorkflowRoles(
  userId: string,
  tenantId: string,
  workflowRoles: string[],
  accessToken: string
): Promise<void> {
  await rbacFetch<void>(
    `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/workflow-roles`,
    accessToken,
    { method: 'POST', body: { workflow_roles: workflowRoles } }
  )
}

// ---------------------------------------------------------------------------
// Permission override functions
// ---------------------------------------------------------------------------

/**
 * Get global and resource-scoped permission overrides for a user.
 * GET /tenants/{tenantId}/users/{userId}/permissions
 */
export async function getPermissionOverrides(
  userId: string,
  tenantId: string,
  accessToken: string
): Promise<UserPermissionOverridesResponse> {
  try {
    const response = await rbacFetch<UserPermissionOverridesResponse>(
      `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/permissions`,
      accessToken
    )
    return response ?? { global_overrides: [], resource_overrides: [] }
  } catch (err) {
    console.error('[getPermissionOverrides]', { tenantId, userId, err })
    return { global_overrides: [], resource_overrides: [] }
  }
}

/**
 * Save global permission overrides for a user (replaces existing).
 * POST /tenants/{tenantId}/users/{userId}/permissions
 *
 * @param overrides - Array of { permission_code, allow } objects
 */
export async function setPermissionOverrides(
  userId: string,
  tenantId: string,
  overrides: Array<{ permission_code: string; allow: boolean }>,
  accessToken: string
): Promise<void> {
  await rbacFetch<void>(
    `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/permissions`,
    accessToken,
    { method: 'POST', body: { overrides } }
  )
}

/**
 * Save resource-scoped permission overrides for a user (replaces existing).
 * POST /tenants/{tenantId}/users/{userId}/permissions/resource
 *
 * @param overrides - Array of { permission_code, allow, resource_type, resource_id }
 */
export async function setResourcePermissionOverrides(
  userId: string,
  tenantId: string,
  overrides: Array<{
    permission_code: string
    allow: boolean
    resource_type: string
    resource_id: string
  }>,
  accessToken: string
): Promise<void> {
  await rbacFetch<void>(
    `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/permissions/resource`,
    accessToken,
    { method: 'POST', body: { overrides } }
  )
}

// ---------------------------------------------------------------------------
// Permissions rebuild
// ---------------------------------------------------------------------------

/**
 * Rebuild effective permissions cache for a user.
 * Triggers recomputation of cmx_effective_permissions for this user+tenant.
 * POST /tenants/{tenantId}/users/{userId}/rebuild-permissions
 */
export async function rebuildPermissions(
  userId: string,
  tenantId: string,
  accessToken: string
): Promise<void> {
  await rbacFetch<void>(
    `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/rebuild-permissions`,
    accessToken,
    { method: 'POST' }
  )
}
