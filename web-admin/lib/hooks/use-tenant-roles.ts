'use client'

/**
 * useTenantRoles — Fetches all roles available in the current tenant context.
 *
 * Wraps getAllRoles() from lib/api/roles.ts.
 * Token is read from useAuth() — no props required.
 *
 * Usage:
 * ```tsx
 * const { roles, systemRoles, customRoles, loading, error, refetch } = useTenantRoles()
 * ```
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { getAllRoles } from '@/lib/api/roles'
import type { TenantRole } from '@/lib/api/roles'

export interface UseTenantRolesResult {
  /** All roles (system + custom) */
  roles: TenantRole[]
  /** Only system roles (is_system === true) */
  systemRoles: TenantRole[]
  /** Only custom roles (is_system === false) */
  customRoles: TenantRole[]
  loading: boolean
  error: string | null
  refetch: () => void
}

export function useTenantRoles(): UseTenantRolesResult {
  const { session } = useAuth()
  const accessToken = session?.access_token ?? ''

  const [roles, setRoles] = useState<TenantRole[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRoles = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const data = await getAllRoles(accessToken)
      setRoles(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load roles')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    fetchRoles()
  }, [fetchRoles])

  return {
    roles,
    systemRoles: roles.filter((r) => r.is_system),
    customRoles: roles.filter((r) => !r.is_system),
    loading,
    error,
    refetch: fetchRoles,
  }
}
