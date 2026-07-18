'use client'

import { useState } from 'react'
import { useTranslations } from 'next-intl'
import { ShieldAlert } from 'lucide-react'

import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxTextarea } from '@ui/primitives/cmx-textarea'
import { cmxMessage } from '@ui/feedback'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays'
import { useCSRFToken } from '@/lib/hooks/use-csrf-token'
import { approveCashDrawerSessionVariance } from '@features/cash-drawers/api/cash-drawer-api'

/**
 * B16 — variance-approval dialog (deferred maker-checker model).
 *
 * A session that closed with |variance| over the drawer's configured
 * threshold stays flagged `varianceApproval.pending` until a supervisor other
 * than the closer approves it here with a mandatory reason. The server is the
 * source of truth for the maker-checker rule (rejects self-approval and
 * duplicate approval) — this dialog surfaces the resulting error via
 * `cmxMessage` rather than re-deriving the rule client-side.
 */
export function CashDrawerVarianceApprovalDialog({
  open,
  onOpenChange,
  drawerId,
  sessionId,
  onApproved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  drawerId: string
  sessionId: string
  onApproved: () => void
}) {
  const t = useTranslations('billing.cashDrawers')
  const tCommon = useTranslations('common')
  const { token: csrfToken } = useCSRFToken()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const close = () => {
    setReason('')
    onOpenChange(false)
  }

  const submit = async () => {
    if (reason.trim().length === 0) return
    setSubmitting(true)
    try {
      await approveCashDrawerSessionVariance({ drawerId, sessionId, reason, csrfToken })
      cmxMessage.success(t('messages.varianceApproved'))
      setReason('')
      onOpenChange(false)
      onApproved()
    } catch (error) {
      const message = error instanceof Error ? error.message : t('messages.varianceApprovalFailed')
      cmxMessage.error(mapVarianceApprovalError(message, t))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CmxDialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" aria-hidden />
            {t('varianceApprovalTitle')}
          </CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            {t('varianceApprovalWarning')}
          </div>
          <CmxTextarea
            value={reason}
            placeholder={t('varianceApprovalReasonPlaceholder')}
            onChange={(event) => setReason(event.target.value)}
            aria-label={t('varianceApprovalReasonPlaceholder')}
          />
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={close} disabled={submitting}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton
            variant="primary"
            disabled={reason.trim().length === 0}
            loading={submitting}
            onClick={submit}
          >
            {t('approveVariance')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}

/** Map the server's stable `VARIANCE_APPROVAL_ERRORS` codes to i18n-resolved text. */
function mapVarianceApprovalError(rawMessage: string, t: (key: string) => string): string {
  switch (rawMessage) {
    case 'VARIANCE_SELF_APPROVAL_BLOCKED':
      return t('messages.varianceSelfApprovalBlocked')
    case 'VARIANCE_ALREADY_APPROVED':
      return t('messages.varianceAlreadyApproved')
    case 'VARIANCE_NOT_PENDING_APPROVAL':
      return t('messages.varianceNotPendingApproval')
    case 'VARIANCE_REASON_REQUIRED':
      return t('messages.varianceReasonRequired')
    default:
      return t('messages.varianceApprovalFailed')
  }
}
