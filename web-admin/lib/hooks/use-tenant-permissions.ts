'use client'

/**
 * useTenantPermissions — Fetches all permissions available in the current tenant context.
 *
 * Wraps getAllPermissionsList() from lib/api/permissions.ts.
 * Token is read from useAuth() — no props required.
 *
 * Usage:
 * ```tsx
 * const { permissions, loading, error } = useTenantPermissions()
 * ```
 */

import { useState, useEffect, useCallback } from 'react'
import { useAuth } from '@/lib/auth/auth-context'
import { getAllPermissionsList } from '@/lib/api/permissions'
import type { TenantPermission } from '@/lib/api/permissions'

export interface UseTenantPermissionsResult {
  /** Flat list of all permissions */
  permissions: TenantPermission[]
  loading: boolean
  error: string | null
}

export function useTenantPermissions(): UseTenantPermissionsResult {
  const { session } = useAuth()
  const accessToken = session?.access_token ?? ''

  const [permissions, setPermissions] = useState<TenantPermission[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchPermissions = useCallback(async () => {
    if (!accessToken) return
    setLoading(true)
    setError(null)
    try {
      const data = await getAllPermissionsList(accessToken)
      setPermissions(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load permissions')
    } finally {
      setLoading(false)
    }
  }, [accessToken])

  useEffect(() => {
    fetchPermissions()
  }, [fetchPermissions])

  return { permissions, loading, error }
}
