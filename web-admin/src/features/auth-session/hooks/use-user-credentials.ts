'use client'

/**
 * TanStack Query mutations for the administrator credential actions on one user.
 *
 * A successful change invalidates the sessions lists (the user was signed out) and the user's activity trail.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query'
import { sendUserPasswordLink, setUserPassword, unlockUserAccount } from '../api/admin-password-api'
import { SESSIONS_QUERY_ROOT } from './use-sessions'

/** Set the user's password (all their sessions end). */
export function useSetUserPassword(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { newPassword: string; mustChange: boolean }) => setUserPassword(userId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_ROOT }),
  })
}

/** Email the user a choose-your-own-password link. */
export function useSendUserPasswordLink(userId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { revokeSessions: boolean }) => sendUserPasswordLink(userId, input),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSIONS_QUERY_ROOT }),
  })
}

/** Clear the user's sign-in lockout. */
export function useUnlockUser(userId: string) {
  return useMutation({ mutationFn: () => unlockUserAccount(userId) })
}
