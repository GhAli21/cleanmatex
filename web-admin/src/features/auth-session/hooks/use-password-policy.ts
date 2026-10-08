'use client'

/**
 * TanStack Query hook for the signed-in user's password rules (current password required? email link available?).
 */

import { useQuery } from '@tanstack/react-query'
import { fetchPasswordPolicy } from '../api/password-api'

export const PASSWORD_POLICY_QUERY_KEY = ['auth-session', 'password-policy'] as const

/** The caller's password policy and email capability (cached for a minute — it changes rarely). */
export function usePasswordPolicy() {
  return useQuery({
    queryKey: PASSWORD_POLICY_QUERY_KEY,
    queryFn: fetchPasswordPolicy,
    staleTime: 60_000,
  })
}
