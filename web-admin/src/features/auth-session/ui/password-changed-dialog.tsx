'use client'

/**
 * PasswordChangedDialog — shown after a successful self-service password change.
 *
 * The password is already changed and every organization session was ended, including this one.
 * Closing the dialog is the same as "Close". Sign in again uses the new password.
 */

import { useTranslations } from 'next-intl'
import { CmxButton } from '@ui/primitives'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'

interface PasswordChangedDialogProps {
  open: boolean
  /** Organization sessions that were ended by the change, including this one. */
  revokedOtherSessions: number
  onSignOutNow: () => void
  onLater: () => void
}

/**
 * @param props - Component props
 */
export function PasswordChangedDialog({ open, revokedOtherSessions, onSignOutNow, onLater }: PasswordChangedDialogProps) {
  const t = useTranslations('authSession.password.changedDialog')

  return (
    <CmxDialog open={open} onOpenChange={(next) => !next && onLater()}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-2 px-1 py-2 text-sm text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
          <p>{t('body', { count: revokedOtherSessions })}</p>
          <p className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('question')}</p>
        </div>
        <CmxDialogFooter>
          <CmxButton type="button" variant="secondary" onClick={onLater}>
            {t('later')}
          </CmxButton>
          <CmxButton type="button" onClick={onSignOutNow}>
            {t('signOutNow')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}
