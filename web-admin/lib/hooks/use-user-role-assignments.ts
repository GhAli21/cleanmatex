'use client'

/**
 * User role assignment hooks.
 *
 * Three hooks exported from this file:
 *   useUserRoleAssignments(userId)   — tenant roles + resource roles + workflow roles + mutation actions
 *   useUserPermissionOverrides(userId) — global + resource-scoped overrides + save actions
 *   useEffectivePermissions(userId)  — pre-computed effective permission list
 *
 * All hooks read tenantId and accessToken from useAuth().
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import {
  getUserRolesExtended,
  getUserWorkflowRoles,
  assignRoles,
  removeRole,
  assignWorkflowRoles,
  getPermissionOverrides,
  setPermissionOverrides,
  setResourcePermissionOverrides,
  rebuildPermissions as rebuildPermissionsApi,
} from '@/lib/api/user-rbac'
import { getEffectivePermissions as getEffectivePermissionsApi } from '@/lib/api/users'
import type {
  UserRole,
  UserResourceRole,
  UserWorkflowRole,
  UserPermissionOverride,
  UserResourcePermissionOverride,
} from '@/lib/api/user-rbac'

// ---------------------------------------------------------------------------
// useUserRoleAssignments
// ---------------------------------------------------------------------------

export interface UseUserRoleAssignmentsResult {
  /** Tenant-level role assignments */
  tenantRoles: UserRole[]
  /** Resource-scoped role assignments */
  resourceRoles: UserResourceRole[]
  /** Workflow role assignments */
  workflowRoles: UserWorkflowRole[]
  loading: boolean
  error: string | null
  /**
   * Assign (replace) tenant-level or resource-scoped roles.
   * @param roleCodes Full replacement list of role codes
   * @param resourceType Optional resource type for resource-scoped assignment
   * @param resourceId Optional resource UUID for resource-scoped assignment
   */
  assignRoles: (roleCodes: string[], resourceType?: string, resourceId?: string) => Promise<void>
  /** Remove a single role from the user */
  removeRole: (roleCode: string) => Promise<void>
  /** Assign (replace) workflow roles */
  assignWorkflowRoles: (workflowRoles: string[]) => Promise<void>
  /** Remove a single workflow role */
  removeWorkflowRole: (workflowRole: string) => Promise<void>
  /** Rebuild effective permissions cache for this user */
  rebuildPermissions: () => Promise<void>
  /** true while rebuild is in progress */
  rebuilding: boolean
  refetch: () => void
}

export function useUserRoleAssignments(userId: string): UseUserRoleAssignmentsResult {
  const { session, currentTenant } = useAuth()
  const accessToken = session?.access_token ?? ''
  const tenantId = currentTenant?.tenant_id ?? ''

  const [tenantRoles, setTenantRoles] = useState<UserRole[]>([])
  const [resourceRoles, setResourceRoles] = useState<UserResourceRole[]>([])
  const [workflowRoles, setWorkflowRoles] = useState<UserWorkflowRole[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rebuilding, setRebuilding] = useState(false)

  const fetchAll = useCallback(async () => {
    if (!userId || !tenantId || !accessToken) return
    setLoading(true)
    setError(null)
    try {
      const [rolesResp, workflowResp] = await Promise.all([
        getUserRolesExtended(userId, tenantId, accessToken),
        getUserWorkflowRoles(userId, tenantId, accessToken),
      ])
      setTenantRoles(rolesResp.tenant_roles)
      setResourceRoles(rolesResp.resource_roles)
      setWorkflowRoles(workflowResp.workflow_roles)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load role assignments')
    } finally {
      setLoading(false)
    }
  }, [userId, tenantId, accessToken])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const handleAssignRoles = useCallback(
    async (roleCodes: string[], resourceType?: string, resourceId?: string) => {
      await assignRoles(userId, tenantId, roleCodes, accessToken, resourceType, resourceId)
      await fetchAll()
    },
    [userId, tenantId, accessToken, fetchAll]
  )

  const handleRemoveRole = useCallback(
    async (roleCode: string) => {
      await removeRole(userId, tenantId, roleCode, accessToken)
      await fetchAll()
    },
    [userId, tenantId, accessToken, fetchAll]
  )

  const handleAssignWorkflowRoles = useCallback(
    async (roles: string[]) => {
      await assignWorkflowRoles(userId, tenantId, roles, accessToken)
      await fetchAll()
    },
    [userId, tenantId, accessToken, fetchAll]
  )

  const handleRemoveWorkflowRole = useCallback(
    async (workflowRole: string) => {
      // Build the updated list without the removed role
      const updated = workflowRoles
        .map((r) => r.workflow_role)
        .filter((r) => r !== workflowRole)
      await assignWorkflowRoles(userId, tenantId, updated, accessToken)
      await fetchAll()
    },
    [userId, tenantId, accessToken, workflowRoles, fetchAll]
  )

  const handleRebuildPermissions = useCallback(async () => {
    setRebuilding(true)
    try {
      await rebuildPermissionsApi(userId, tenantId, accessToken)
    } finally {
      setRebuilding(false)
    }
  }, [userId, tenantId, accessToken])

  return {
    tenantRoles,
    resourceRoles,
    workflowRoles,
    loading,
    error,
    assignRoles: handleAssignRoles,
    removeRole: handleRemoveRole,
    assignWorkflowRoles: handleAssignWorkflowRoles,
    removeWorkflowRole: handleRemoveWorkflowRole,
    rebuildPermissions: handleRebuildPermissions,
    rebuilding,
    refetch: fetchAll,
  }
}

// ---------------------------------------------------------------------------
// useUserPermissionOverrides
// ---------------------------------------------------------------------------

export interface UseUserPermissionOverridesResult {
  globalOverrides: UserPermissionOverride[]
  resourceOverrides: UserResourcePermissionOverride[]
  loading: boolean
  error: string | null
  /**
   * Replace global permission overrides for the user.
   * @param overrides Array of { permission_code, allow }
   */
  saveGlobalOverrides: (overrides: Array<{ permission_code: string; allow: boolean }>) => Promise<void>
  /**
   * Replace resource-scoped permission overrides for the user.
   * @param overrides Array of { permission_code, allow, resource_type, resource_id }
   */
  saveResourceOverrides: (
    overrides: Array<{
      permission_code: string
      allow: boolean
      resource_type: string
      resource_id: string
    }>
  ) => Promise<void>
  refetch: () => void
}

export function useUserPermissionOverrides(userId: string): UseUserPermissionOverridesResult {
  const { session, currentTenant } = useAuth()
  const accessToken = session?.access_token ?? ''
  const tenantId = currentTenant?.tenant_id ?? ''

  const [globalOverrides, setGlobalOverrides] = useState<UserPermissionOverride[]>([])
  const [resourceOverrides, setResourceOverrides] = useState<UserResourcePermissionOverride[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchOverrides = useCallback(async () => {
    if (!userId || !tenantId || !accessToken) return
    setLoading(true)
    setError(null)
    try {
      const data = await getPermissionOverrides(userId, tenantId, accessToken)
      setGlobalOverrides(data.global_overrides)
      setResourceOverrides(data.resource_overrides)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permission overrides')
    } finally {
      setLoading(false)
    }
  }, [userId, tenantId, accessToken])

  useEffect(() => {
    fetchOverrides()
  }, [fetchOverrides])

  const handleSaveGlobalOverrides = useCallback(
    async (overrides: Array<{ permission_code: string; allow: boolean }>) => {
      await setPermissionOverrides(userId, tenantId, overrides, accessToken)
      await fetchOverrides()
    },
    [userId, tenantId, accessToken, fetchOverrides]
  )

  const handleSaveResourceOverrides = useCallback(
    async (
      overrides: Array<{
        permission_code: string
        allow: boolean
        resource_type: string
        resource_id: string
      }>
    ) => {
      await setResourcePermissionOverrides(userId, tenantId, overrides, accessToken)
      await fetchOverrides()
    },
    [userId, tenantId, accessToken, fetchOverrides]
  )

  return {
    globalOverrides,
    resourceOverrides,
    loading,
    error,
    saveGlobalOverrides: handleSaveGlobalOverrides,
    saveResourceOverrides: handleSaveResourceOverrides,
    refetch: fetchOverrides,
  }
}

// ---------------------------------------------------------------------------
// useEffectivePermissions
// ---------------------------------------------------------------------------

export interface UseEffectivePermissionsResult {
  permissions: string[]
  loading: boolean
  error: string | null
}

export function useEffectivePermissions(userId: string): UseEffectivePermissionsResult {
  const { session, currentTenant } = useAuth()
  const accessToken = session?.access_token ?? ''
  const tenantId = currentTenant?.tenant_id ?? ''

  const [permissions, setPermissions] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!userId || !tenantId || !accessToken) return
    setLoading(true)
    setError(null)
    getEffectivePermissionsApi(tenantId, userId, accessToken)
      .then((data) => setPermissions(data.permissions))
      .catch((err) =>
        setError(err instanceof Error ? err.message : 'Failed to load effective permissions')
      )
      .finally(() => setLoading(false))
  }, [userId, tenantId, accessToken])

  return { permissions, loading, error }
}
