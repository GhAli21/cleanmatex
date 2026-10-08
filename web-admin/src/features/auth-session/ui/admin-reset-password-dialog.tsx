'use client'

/**
 * AdminResetPasswordDialog — an administrator resets another user's password.
 *
 * Two ways, never emailing a password:
 *  - "Choose the password": the admin types or generates a temporary password and gives it to the user in person
 *    (copy button). By default the user must replace it at first sign-in. All the user's sessions end.
 *  - "Email a link": the user receives a one-time link and chooses their own password. Needs a real email address;
 *    optionally signs the user out everywhere right away.
 */

import { useState, type FormEvent } from 'react'
import { useTranslations } from 'next-intl'
import { Copy, Wand2 } from 'lucide-react'
import { CmxButton, CmxCheckbox } from '@ui/primitives'
import { CmxRadioGroup } from '@ui/forms'
import { cmxMessage } from '@ui/feedback'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import { SYNTHETIC_EMAIL_DOMAIN } from '@/lib/constants/auth-session'
import { PasswordApiError } from '../api/password-api'
import { useSendUserPasswordLink, useSetUserPassword } from '../hooks/use-user-credentials'
import { passwordErrorKey } from '../model/password-errors'
import { generateTemporaryPassword } from '../model/password-generator'
import { validateNewPassword } from '../model/password-form'
import { NewPasswordFields } from './new-password-fields'

type Mode = 'set' | 'link'

interface AdminResetPasswordDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Auth user id of the target. */
  userId: string
  /** Display name or email, shown in the title. */
  userLabel: string
  /** Target's email; a synthetic address (or empty) disables the link option. */
  userEmail: string | null
}

/**
 * @param props - Component props
 */
export function AdminResetPasswordDialog({ open, onOpenChange, userId, userLabel, userEmail }: AdminResetPasswordDialogProps) {
  const t = useTranslations('authSession.adminReset')
  const tPassword = useTranslations('authSession.password')
  const canEmail = !!userEmail && !userEmail.toLowerCase().endsWith(SYNTHETIC_EMAIL_DOMAIN)

  const [mode, setMode] = useState<Mode>('set')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [generated, setGenerated] = useState(false)
  const [mustChange, setMustChange] = useState(true)
  const [revokeWithLink, setRevokeWithLink] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [done, setDone] = useState<{ mode: Mode; revoked: number } | null>(null)

  const setPasswordMutation = useSetUserPassword(userId)
  const linkMutation = useSendUserPasswordLink(userId)
  const pending = setPasswordMutation.isPending || linkMutation.isPending
  const validation = validateNewPassword(password, confirmation)

  const reset = () => {
    setMode('set')
    setPassword('')
    setConfirmation('')
    setGenerated(false)
    setMustChange(true)
    setRevokeWithLink(false)
    setSubmitted(false)
    setDone(null)
  }

  const close = (next: boolean) => {
    if (pending) return
    if (!next) reset()
    onOpenChange(next)
  }

  const showError = (error: unknown) =>
    cmxMessage.error(tPassword(`errors.${passwordErrorKey(error instanceof PasswordApiError ? error.code : undefined)}`))

  const handleGenerate = () => {
    const value = generateTemporaryPassword()
    setPassword(value)
    setConfirmation(value)
    setGenerated(true)
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(password)
      cmxMessage.success(t('copied'))
    } catch {
      cmxMessage.error(t('copyFailed'))
    }
  }

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    setSubmitted(true)

    if (mode === 'set') {
      if (validation) return
      setPasswordMutation.mutate(
        { newPassword: password, mustChange },
        { onSuccess: (revoked) => setDone({ mode: 'set', revoked }), onError: showError }
      )
      return
    }
    linkMutation.mutate(
      { revokeSessions: revokeWithLink },
      { onSuccess: (revoked) => setDone({ mode: 'link', revoked }), onError: showError }
    )
  }

  return (
    <CmxDialog open={open} onOpenChange={close}>
      <CmxDialogContent>
        <CmxDialogHeader>
          <CmxDialogTitle>{t('title', { user: userLabel })}</CmxDialogTitle>
        </CmxDialogHeader>

        {done ? (
          <>
            <div className="space-y-3 px-1 py-2 text-sm" role="status">
              <p>{done.mode === 'set' ? t('doneSet', { count: done.revoked }) : t('doneLink', { email: userEmail ?? '' })}</p>
              {done.mode === 'set' ? (
                <>
                  <p className="text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                    {mustChange ? t('doneSetMustChange') : t('doneSetNoForce')}
                  </p>
                  <div className="flex items-center gap-2">
                    <code className="rounded bg-[rgb(var(--cmx-muted-rgb,241_245_249))] px-2 py-1 font-mono text-sm" dir="ltr">
                      {password}
                    </code>
                    <CmxButton type="button" variant="secondary" size="sm" onClick={() => void handleCopy()}>
                      <Copy className="me-1 h-4 w-4" aria-hidden />
                      {t('copy')}
                    </CmxButton>
                  </div>
                  <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('shareHint')}</p>
                </>
              ) : null}
            </div>
            <CmxDialogFooter>
              <CmxButton type="button" onClick={() => close(false)}>
                {t('close')}
              </CmxButton>
            </CmxDialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <div className="space-y-4 px-1 py-2">
              <CmxRadioGroup
                name="admin-reset-mode"
                value={mode}
                onChange={(value) => setMode(value as Mode)}
                disabled={pending}
                options={[
                  { value: 'set', label: t('modeSet'), description: t('modeSetHint') },
                  {
                    value: 'link',
                    label: t('modeLink'),
                    description: canEmail ? t('modeLinkHint', { email: userEmail ?? '' }) : t('modeLinkNoEmail'),
                    disabled: !canEmail,
                  },
                ]}
              />

              {mode === 'set' ? (
                <div className="space-y-3">
                  <NewPasswordFields
                    idPrefix="admin-reset"
                    password={password}
                    confirmation={confirmation}
                    onPasswordChange={(value) => {
                      setPassword(value)
                      setGenerated(false)
                    }}
                    onConfirmationChange={(value) => {
                      setConfirmation(value)
                      setGenerated(false)
                    }}
                    error={validation}
                    showErrors={submitted}
                    disabled={pending}
                    forceReveal={generated}
                  />
                  <CmxButton type="button" variant="secondary" size="sm" disabled={pending} onClick={handleGenerate}>
                    <Wand2 className="me-1 h-4 w-4" aria-hidden />
                    {t('generate')}
                  </CmxButton>
                  <CmxCheckbox
                    checked={mustChange}
                    disabled={pending}
                    onChange={(event) => setMustChange(event.target.checked)}
                    label={t('mustChange')}
                    description={t('mustChangeHint')}
                  />
                  <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{tPassword('policyHint')}</p>
                </div>
              ) : (
                <CmxCheckbox
                  checked={revokeWithLink}
                  disabled={pending}
                  onChange={(event) => setRevokeWithLink(event.target.checked)}
                  label={t('revokeNow')}
                  description={t('revokeNowHint')}
                />
              )}
            </div>
            <CmxDialogFooter>
              <CmxButton type="button" variant="secondary" disabled={pending} onClick={() => close(false)}>
                {t('cancel')}
              </CmxButton>
              <CmxButton type="submit" loading={pending} disabled={pending}>
                {mode === 'set' ? t('submitSet') : t('submitLink')}
              </CmxButton>
            </CmxDialogFooter>
          </form>
        )}
      </CmxDialogContent>
    </CmxDialog>
  )
}
