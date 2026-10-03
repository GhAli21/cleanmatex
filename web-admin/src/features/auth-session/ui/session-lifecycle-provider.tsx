'use client'

/**
 * SessionLifecycleProvider — mounts the client side of the session lifecycle for the dashboard.
 *
 * Renders the idle-warning dialog, shows the one-time "session ends soon" heads-up before the absolute
 * expiry, and signs the user out (with the right /login banner and a return-to path) when the server says the
 * session has ended or another tab signed out.
 */

import { useCallback, useEffect, useRef, type ReactNode } from 'react'
import { useTranslations } from 'next-intl'
import { cmxMessage } from '@ui/feedback'
import { useAuth } from '@/lib/auth/auth-context'
import { SESSION_END_REASONS, loginReasonForEndReason, type SessionEndReason } from '@/lib/constants/auth-session'
import { useSessionLifecycle } from '../hooks/use-session-lifecycle'
import { SessionIdleWarningDialog } from './session-idle-warning-dialog'

interface SessionLifecycleProviderProps {
  children: ReactNode
}

/**
 * @param props - Component props
 * @param props.children - Dashboard content (rendered unchanged)
 */
export function SessionLifecycleProvider({ children }: SessionLifecycleProviderProps) {
  const t = useTranslations('authSession.lifecycle')
  const { isAuthenticated, isTenantContextReady, signOut } = useAuth()

  const headsUpShownRef = useRef(false)

  const handleEnded = useCallback(
    ({ reason, fromOtherTab }: { reason: SessionEndReason | null; fromOtherTab: boolean }) => {
      const returnTo = typeof window !== 'undefined' ? window.location.pathname + window.location.search : undefined
      void signOut(reason === SESSION_END_REASONS.IDLE_TIMEOUT ? 'timeout' : 'session_expired', {
        loginReason: loginReasonForEndReason(reason),
        returnTo,
        // A tab told to sign out by another tab must not echo the message back (ping-pong).
        skipBroadcast: fromOtherTab,
      })
    },
    [signOut]
  )

  const { phase, warningSecondsLeft, absoluteHeadsUp, staySignedIn } = useSessionLifecycle({
    enabled: isAuthenticated && isTenantContextReady,
    onSessionEnded: handleEnded,
  })

  // Non-extendable heads-up shortly before the absolute lifetime ends — once per session.
  useEffect(() => {
    if (absoluteHeadsUp && !headsUpShownRef.current) {
      headsUpShownRef.current = true
      cmxMessage.warning(t('absoluteHeadsUp'))
    }
  }, [absoluteHeadsUp, t])

  return (
    <>
      {children}
      <SessionIdleWarningDialog
        open={phase === 'IDLE_WARNING'}
        secondsLeft={warningSecondsLeft ?? 0}
        onStaySignedIn={staySignedIn}
        onSignOut={() => void signOut('user')}
      />
    </>
  )
}
