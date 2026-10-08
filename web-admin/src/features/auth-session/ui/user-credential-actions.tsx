'use client'

/**
 * UserCredentialActions — "Reset password" and "Unlock account" buttons for the user detail header.
 *
 * Rendered only for administrators with users:reset_password, and never for the administrator's own account
 * (they use Account security; the server refuses the self-target as well). The server re-checks everything.
 */

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { KeyRound, Unlock } from 'lucide-react'
import { CmxButton } from '@ui/primitives'
import { cmxMessage } from '@ui/feedback'
import { useAuth } from '@/lib/auth/auth-context'
import { useHasPermission } from '@/lib/hooks/use-has-permission'
import { PasswordApiError } from '../api/password-api'
import { useUnlockUser } from '../hooks/use-user-credentials'
import { passwordErrorKey } from '../model/password-errors'
import { AdminResetPasswordDialog } from './admin-reset-password-dialog'

interface UserCredentialActionsProps {
  /** Auth user id of the user being viewed. */
  userId: string
  userLabel: string
  userEmail: string | null
}

/**
 * @param props - Component props
 */
export function UserCredentialActions({ userId, userLabel, userEmail }: UserCredentialActionsProps) {
  const t = useTranslations('authSession.adminReset')
  const tPassword = useTranslations('authSession.password')
  const { user } = useAuth()
  const canReset = useHasPermission('users', 'reset_password')
  const [open, setOpen] = useState(false)
  const unlock = useUnlockUser(userId)

  if (!canReset || user?.id === userId) return null

  const handleUnlock = () =>
    unlock.mutate(undefined, {
      onSuccess: ({ wasLocked }) => cmxMessage.success(wasLocked ? t('unlocked') : t('notLocked')),
      onError: (error) =>
        cmxMessage.error(tPassword(`errors.${passwordErrorKey(error instanceof PasswordApiError ? error.code : undefined)}`)),
    })

  return (
    <div className="flex flex-wrap items-center gap-2">
      <CmxButton type="button" variant="secondary" size="sm" onClick={() => setOpen(true)}>
        <KeyRound className="me-1 h-4 w-4" aria-hidden />
        {t('open')}
      </CmxButton>
      <CmxButton type="button" variant="secondary" size="sm" loading={unlock.isPending} disabled={unlock.isPending} onClick={handleUnlock}>
        <Unlock className="me-1 h-4 w-4" aria-hidden />
        {t('unlock')}
      </CmxButton>
      <AdminResetPasswordDialog
        open={open}
        onOpenChange={setOpen}
        userId={userId}
        userLabel={userLabel}
        userEmail={userEmail}
      />
    </div>
  )
}
