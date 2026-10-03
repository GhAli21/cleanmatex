'use client'

/**
 * TanStack Query hooks for the auth config API.
 *
 * Tenant scoped on the server (session); the query key therefore needs no tenant id, but is namespaced
 * so it can be invalidated together with other auth-session data.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { AuthConfigChange } from '@/lib/types/auth-admin-config'
import { fetchAuthConfig, saveAuthConfig, type AuthConfigPayload } from '../api/auth-config-api'

export const AUTH_CONFIG_QUERY_KEY = ['auth-session', 'auth-config'] as const

/** Load the effective auth config (items + plan-level edit capability). */
export function useAuthConfig() {
  return useQuery({ queryKey: AUTH_CONFIG_QUERY_KEY, queryFn: fetchAuthConfig })
}

/**
 * Save overrides/resets; on success the cache is replaced with the refreshed server data.
 *
 * @returns TanStack mutation taking the changes to send
 */
export function useSaveAuthConfig() {
  const queryClient = useQueryClient()
  return useMutation<AuthConfigPayload, Error, AuthConfigChange[]>({
    mutationFn: saveAuthConfig,
    onSuccess: (data) => {
      queryClient.setQueryData(AUTH_CONFIG_QUERY_KEY, data)
    },
  })
}
