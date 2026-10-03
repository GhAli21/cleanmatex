'use client'

/**
 * TanStack Query hooks for session management (self-service and administrators).
 *
 * Query keys are namespaced under `auth-session` so any revoke invalidates every sessions list at once.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  fetchMySessions,
  fetchTenantSessions,
  revokeMyOtherSessions,
  revokeMySession,
  revokeTenantSessions,
  type TenantSessionsQuery,
} from '../api/sessions-api'

export const SESSIONS_QUERY_ROOT = ['auth-session', 'sessions'] as const

/** The caller's own active sessions. */
export function useMySessions() {
  return useQuery({ queryKey: [...SESSIONS_QUERY_ROOT, 'me'], queryFn: fetchMySessions })
}

/** Sign out one of the caller's other devices. */
export function useRevokeMySession() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (sessionId: string) => revokeMySession(sessionId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_ROOT }),
  })
}

/** Sign out every other device of the caller. */
export function useRevokeMyOtherSessions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: () => revokeMyOtherSessions(),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_ROOT }),
  })
}

/**
 * Sessions of the tenant (administrators), server-side paginated.
 *
 * @param query - Filters and paging; every distinct query is cached separately
 */
export function useTenantSessions(query: TenantSessionsQuery) {
  return useQuery({
    queryKey: [...SESSIONS_QUERY_ROOT, 'tenant', query],
    queryFn: () => fetchTenantSessions(query),
    placeholderData: (previous) => previous, // keep the old page visible while the next one loads
  })
}

/** Sign users out (selected sessions or everyone in the tenant). */
export function useRevokeTenantSessions() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (target: { sessionIds: string[] } | { all: true }) => revokeTenantSessions(target),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_ROOT }),
  })
}
