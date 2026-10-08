'use client'

/**
 * PasswordChangedDialog — shown after a successful self-service password change.
 *
 * The password is already changed and every OTHER device was signed out; this device stays signed in. The user
 * decides: sign out now (and prove the new password at the login screen) or carry on ("later"). Closing the
 * dialog with Escape / X is the same as "later".
 */

import { useTranslations } from 'next-intl'
import { CmxButton } from '@ui/primitives'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'

interface PasswordChangedDialogProps {
  open: boolean
  /** Other devices that were signed out by the change. */
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
