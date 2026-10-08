'use client'

/**
 * EmailPasswordLinkButton — "Email me a link to change my password".
 *
 * Alternative to typing the current password: the link proves control of the mailbox. Only rendered when the
 * account has a real email (the policy endpoint says so). The address is never sent from the browser — the
 * server mails the address on the verified session.
 */

import { useTranslations } from 'next-intl'
import { useMutation } from '@tanstack/react-query'
import { CmxButton } from '@ui/primitives'
import { cmxMessage } from '@ui/feedback'
import { PasswordApiError, sendMyPasswordLink } from '../api/password-api'
import { passwordErrorKey } from '../model/password-errors'

interface EmailPasswordLinkButtonProps {
  /** Masked address shown in the confirmation (e.g. j***@example.com). */
  maskedEmail: string | null
  variant?: 'primary' | 'secondary'
  disabled?: boolean
}

/**
 * @param props - Component props
 */
export function EmailPasswordLinkButton({ maskedEmail, variant = 'secondary', disabled }: EmailPasswordLinkButtonProps) {
  const t = useTranslations('authSession.password')
  const mutation = useMutation({ mutationFn: sendMyPasswordLink })

  const send = () =>
    mutation.mutate(undefined, {
      onSuccess: () => cmxMessage.success(t('link.sent', { email: maskedEmail ?? '' })),
      onError: (error) =>
        cmxMessage.error(t(`errors.${passwordErrorKey(error instanceof PasswordApiError ? error.code : undefined)}`)),
    })

  return (
    <CmxButton type="button" variant={variant} loading={mutation.isPending} disabled={disabled || mutation.isPending} onClick={send}>
      {t('link.send')}
    </CmxButton>
  )
}
