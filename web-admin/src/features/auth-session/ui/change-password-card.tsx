'use client'

/**
 * ChangePasswordCard — signed-in password change.
 *
 * The form adapts to the tenant policy (AUTH_PWD_REQUIRE_CURRENT):
 *  - on  → current password + new password + re-type;
 *  - off → just new password + re-type (allowed shortly after sign-in; an older session is offered the emailed
 *          link or a fresh sign-in instead).
 * A wrong current password counts toward the account lockout server-side. On success every OTHER device is signed
 * out, and the user chooses whether to sign out of this device now or later.
 */

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { useMutation } from '@tanstack/react-query'
import { Alert, AlertDescription, CmxButton, CmxInput } from '@ui/primitives'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'
import { cmxMessage } from '@ui/feedback'
import { useAuth } from '@/lib/auth/auth-context'
import { PASSWORD_ERROR_CODES } from '@/lib/constants/auth-session'
import { changePassword, PasswordApiError } from '../api/password-api'
import { usePasswordPolicy } from '../hooks/use-password-policy'
import { passwordErrorKey } from '../model/password-errors'
import { validateNewPassword } from '../model/password-form'
import { EmailPasswordLinkButton } from './email-password-link-button'
import { NewPasswordFields } from './new-password-fields'
import { PasswordChangedDialog } from './password-changed-dialog'

/** Change-password form card. */
export function ChangePasswordCard() {
  const t = useTranslations('authSession.password')
  const { signOut } = useAuth()
  const policy = usePasswordPolicy()
  const [current, setCurrent] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [currentError, setCurrentError] = useState<string | undefined>()
  const [needsReauth, setNeedsReauth] = useState(false)
  const [revokedOthers, setRevokedOthers] = useState<number | null>(null)

  const mutation = useMutation({ mutationFn: changePassword })
  const validation = validateNewPassword(password, confirmation)
  // Until the policy is known the safe assumption is the stricter one (current password required).
  const requireCurrent = policy.data?.requireCurrent ?? true

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)
    setCurrentError(undefined)
    setNeedsReauth(false)
    if (requireCurrent && !current) {
      setCurrentError(t('errors.currentRequired'))
      return
    }
    if (validation) return

    mutation.mutate(
      { currentPassword: requireCurrent ? current : undefined, newPassword: password },
      {
        onSuccess: (revoked) => {
          setCurrent('')
          setPassword('')
          setConfirmation('')
          setSubmitted(false)
          setRevokedOthers(revoked)
        },
        onError: (error) => {
          const code = error instanceof PasswordApiError ? error.code : undefined
          if (code === PASSWORD_ERROR_CODES.WRONG_PASSWORD) setCurrentError(t('errors.wrongPassword'))
          else if (code === PASSWORD_ERROR_CODES.REAUTH_REQUIRED) setNeedsReauth(true)
          else cmxMessage.error(t(`errors.${passwordErrorKey(code)}`))
        },
      }
    )
  }

  return (
    <CmxCard>
      <CmxCardHeader>
        <CmxCardTitle>{t('title')}</CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent>
        <form onSubmit={handleSubmit} className="max-w-md space-y-4" noValidate>
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {requireCurrent ? t('changeHint') : t('changeHintNoCurrent')}
          </p>

          {needsReauth ? (
            <Alert variant="warning" role="alert">
              <AlertDescription>
                <p>{t('errors.reauth')}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {policy.data?.canEmailLink ? (
                    <EmailPasswordLinkButton maskedEmail={policy.data.maskedEmail} variant="primary" />
                  ) : null}
                  <CmxButton type="button" variant="secondary" onClick={() => void signOut('user')}>
                    {t('reauthSignIn')}
                  </CmxButton>
                </div>
              </AlertDescription>
            </Alert>
          ) : null}

          {requireCurrent ? (
            <CmxInput
              id="change-password-current"
              type="password"
              autoComplete="current-password"
              label={t('currentPassword')}
              value={current}
              disabled={mutation.isPending}
              onChange={(event) => setCurrent(event.target.value)}
              error={currentError}
            />
          ) : null}
          <NewPasswordFields
            idPrefix="change-password"
            password={password}
            confirmation={confirmation}
            onPasswordChange={setPassword}
            onConfirmationChange={setConfirmation}
            error={validation}
            showErrors={submitted}
            disabled={mutation.isPending}
          />
          <CmxButton type="submit" loading={mutation.isPending} disabled={mutation.isPending}>
            {t('submitChange')}
          </CmxButton>
        </form>

        {policy.data?.canEmailLink ? (
          <div className="mt-6 max-w-md space-y-2 border-t border-[rgb(var(--cmx-border-rgb,226_232_240))] pt-4">
            <p className="text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{t('link.title')}</p>
            <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('link.hint', { email: policy.data.maskedEmail ?? '' })}
            </p>
            <EmailPasswordLinkButton maskedEmail={policy.data.maskedEmail} disabled={mutation.isPending} />
          </div>
        ) : null}
      </CmxCardContent>

      <PasswordChangedDialog
        open={revokedOthers !== null}
        revokedOtherSessions={revokedOthers ?? 0}
        onLater={() => setRevokedOthers(null)}
        onSignOutNow={() => void signOut('user')}
      />
    </CmxCard>
  )
}
