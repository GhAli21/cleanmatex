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
import {
  approveCashDrawerSessionVariance,
  rejectCashDrawerSessionVariance,
} from '@features/cash-drawers/api/cash-drawer-api'

/** Which supervisor decision the dialog records. */
export type CashDrawerVarianceDecisionMode = 'approve' | 'reject'

/**
 * B16 / C3 — variance decision dialog (deferred approval model).
 *
 * A session that closed with |variance| over the drawer's configured threshold stays pending
 * until someone holding `cash_drawer:approve_variance` decides it here with a mandatory reason:
 * **approve** (accept the variance) or **reject** (not accepted — needs investigation). The
 * decision is final. No maker-checker — the decider may be the user who closed the session;
 * permission is the only gate. The server remains the source of truth for the remaining rules
 * (already decided, reason required) — this dialog surfaces the resulting error via `cmxMessage`
 * rather than re-deriving them client-side.
 */
export function CashDrawerVarianceApprovalDialog({
  open,
  onOpenChange,
  drawerId,
  sessionId,
  mode = 'approve',
  onDecided,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  drawerId: string
  sessionId: string
  mode?: CashDrawerVarianceDecisionMode
  onDecided: () => void
}) {
  const t = useTranslations('billing.cashDrawers')
  const tCommon = useTranslations('common')
  const { token: csrfToken } = useCSRFToken()
  const [reason, setReason] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const rejecting = mode === 'reject'

  const close = () => {
    setReason('')
    onOpenChange(false)
  }

  const submit = async () => {
    if (reason.trim().length === 0) return
    setSubmitting(true)
    try {
      const decide = rejecting ? rejectCashDrawerSessionVariance : approveCashDrawerSessionVariance
      await decide({ drawerId, sessionId, reason, csrfToken })
      cmxMessage.success(rejecting ? t('messages.varianceRejected') : t('messages.varianceApproved'))
      setReason('')
      onOpenChange(false)
      onDecided()
    } catch (error) {
      const message = error instanceof Error ? error.message : ''
      cmxMessage.error(mapVarianceDecisionError(message, t, rejecting))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CmxDialog open={open} onOpenChange={(next) => (next ? onOpenChange(true) : close())}>
      <CmxDialogContent className="max-w-md">
        <CmxDialogHeader>
          <CmxDialogTitle className="flex items-center gap-2">
            <ShieldAlert className={`h-4 w-4 ${rejecting ? 'text-red-600' : 'text-amber-600'}`} aria-hidden />
            {rejecting ? t('varianceRejectTitle') : t('varianceApprovalTitle')}
          </CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-4">
          <div
            className={`rounded-lg border p-3 text-sm ${
              rejecting ? 'border-red-200 bg-red-50 text-red-900' : 'border-amber-200 bg-amber-50 text-amber-900'
            }`}
          >
            {rejecting ? t('varianceRejectWarning') : t('varianceApprovalWarning')}
          </div>
          <CmxTextarea
            value={reason}
            placeholder={rejecting ? t('varianceRejectReasonPlaceholder') : t('varianceApprovalReasonPlaceholder')}
            onChange={(event) => setReason(event.target.value)}
            aria-label={rejecting ? t('varianceRejectReasonPlaceholder') : t('varianceApprovalReasonPlaceholder')}
          />
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={close} disabled={submitting}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton
            variant={rejecting ? 'destructive' : 'primary'}
            disabled={reason.trim().length === 0}
            loading={submitting}
            onClick={submit}
          >
            {rejecting ? t('rejectVariance') : t('approveVariance')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}

/** Map the server's stable `VARIANCE_APPROVAL_ERRORS` codes to i18n-resolved text. */
function mapVarianceDecisionError(rawMessage: string, t: (key: string) => string, rejecting: boolean): string {
  switch (rawMessage) {
    case 'VARIANCE_ALREADY_APPROVED':
      return t('messages.varianceAlreadyApproved')
    case 'VARIANCE_ALREADY_REJECTED':
      return t('messages.varianceAlreadyRejected')
    case 'VARIANCE_NOT_PENDING_APPROVAL':
      return t('messages.varianceNotPendingApproval')
    case 'VARIANCE_REASON_REQUIRED':
      return t('messages.varianceReasonRequired')
    default:
      return rejecting ? t('messages.varianceRejectFailed') : t('messages.varianceApprovalFailed')
  }
}
