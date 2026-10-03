'use client'

/**
 * SessionIdleWarningDialog — "You will be signed out soon" with a live countdown.
 *
 * Closing the dialog (Escape / X) means STAY SIGNED IN — the safe, expected reading — while signing out is
 * an explicit button. Only the "Stay signed in" action extends the session during the warning; ambient mouse
 * movement or typing elsewhere does not.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { CmxButton } from '@ui/primitives'
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle, CmxDialogFooter } from '@ui/overlays'

interface SessionIdleWarningDialogProps {
  open: boolean
  /** Seconds until the idle timeout signs the user out. */
  secondsLeft: number
  /** Extend the session. Resolves false when the server could not be reached. */
  onStaySignedIn: () => Promise<boolean>
  /** Sign out now. */
  onSignOut: () => void
}

/**
 * @param props - Component props
 * @param props.open - Whether the warning is showing
 * @param props.secondsLeft - Countdown value
 * @param props.onStaySignedIn - Extend the session
 * @param props.onSignOut - Sign out immediately
 */
export function SessionIdleWarningDialog({ open, secondsLeft, onStaySignedIn, onSignOut }: SessionIdleWarningDialogProps) {
  const t = useTranslations('authSession.lifecycle')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)

  const stay = async () => {
    setBusy(true)
    setFailed(false)
    const ok = await onStaySignedIn()
    setBusy(false)
    if (!ok) setFailed(true)
  }

  return (
    <CmxDialog open={open} onOpenChange={(next) => !next && !busy && void stay()}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>{t('idleWarningTitle')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-3 px-1 py-2">
          <p className="text-sm text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{t('idleWarningMessage')}</p>
          {/* role=timer: assistive tech is not interrupted every second; the dialog itself is announced on open. */}
          <p
            role="timer"
            className="text-center text-3xl font-semibold tabular-nums text-[rgb(var(--cmx-primary-rgb,14_165_233))]"
          >
            {t('countdown', { seconds: secondsLeft })}
          </p>
          {failed ? (
            <p role="alert" className="text-sm text-red-600">
              {t('stayFailed')}
            </p>
          ) : null}
        </div>
        <CmxDialogFooter>
          <CmxButton type="button" variant="secondary" disabled={busy} onClick={onSignOut}>
            {t('signOutNow')}
          </CmxButton>
          <CmxButton type="button" loading={busy} disabled={busy} onClick={() => void stay()}>
            {t('staySignedIn')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}
