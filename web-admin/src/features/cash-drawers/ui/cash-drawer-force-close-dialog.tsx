'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { AlertTriangle } from 'lucide-react'

import { cmxMessage } from '@ui/feedback'
import { CmxButton, CmxTextarea, Label } from '@ui/primitives'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import { useCSRFToken } from '@lib/hooks/use-csrf-token'
import { useCashDrawerErrorMessage } from '@features/cash-drawers/hooks/use-cash-drawer-error-message'
import {
  fetchCashDrawerCatalogs,
  forceCloseCashDrawerSession,
  type CurrencyBalancePreview,
  type FinalizeCloseResultV2,
} from '@features/cash-drawers/api/cash-drawer-api'
import {
  EMPTY_DISPOSITION_ROW,
  buildDispositionPayload,
  type DispositionFormRow,
} from '@features/cash-drawers/model/cash-drawer-disposition'
import { CashDrawerDispositionFields } from '@features/cash-drawers/ui/cash-drawer-disposition-fields'

interface CashDrawerForceCloseDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  drawerId: string
  sessionId: string
  branchId: string | null
  /** Per-currency figures known so far (a session that never reached the count step has none). */
  balances: CurrencyBalancePreview[]
  onClosed: (result: FinalizeCloseResultV2) => void
}

/**
 * Supervisor force-close of a drawer session that cannot be closed the normal way - abandoned
 * while open, or stuck mid-close in the count step (`CLOSING`). A reason is mandatory and recorded
 * with the close; the closing cash still needs a disposition, exactly as in a normal close, so
 * the cash is never left unaccounted for. Gated by `pos_session:force_close` at the API; the
 * caller only offers this entry point to holders of it.
 */
export function CashDrawerForceCloseDialog({
  open,
  onOpenChange,
  drawerId,
  sessionId,
  branchId,
  balances,
  onClosed,
}: CashDrawerForceCloseDialogProps) {
  const t = useTranslations('billing.cashDrawers')
  const tCommon = useTranslations('common')
  const errorMessage = useCashDrawerErrorMessage()
  const { token: csrfToken } = useCSRFToken()

  const [reason, setReason] = useState('')
  const [rows, setRows] = useState<Record<string, DispositionFormRow>>({})
  const [submitting, setSubmitting] = useState(false)

  const catalogsQuery = useQuery({
    queryKey: ['cash-drawers', 'catalogs'],
    enabled: open,
    queryFn: () => fetchCashDrawerCatalogs(),
  })

  const reset = () => {
    setReason('')
    setRows({})
  }

  const updateRow = (currencyCode: string, patch: Partial<DispositionFormRow>) =>
    setRows((prev) => ({ ...prev, [currencyCode]: { ...(prev[currencyCode] ?? EMPTY_DISPOSITION_ROW), ...patch } }))

  const submit = async () => {
    if (!reason.trim()) {
      cmxMessage.error(t('forceClose.reasonRequired'))
      return
    }
    const { payload, error } = buildDispositionPayload(
      balances.map((b) => b.currencyCode),
      rows,
      catalogsQuery.data?.dispositions ?? []
    )
    if (error) {
      cmxMessage.error(t(`wizard.${error}`))
      return
    }

    setSubmitting(true)
    try {
      const result = await forceCloseCashDrawerSession({
        drawerId,
        sessionId,
        reason: reason.trim(),
        dispositions: payload,
        csrfToken,
      })
      cmxMessage.success(t('forceClose.done'))
      reset()
      onOpenChange(false)
      onClosed(result)
    } catch (err) {
      cmxMessage.error(errorMessage(err, t('forceClose.failed')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CmxDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset()
        onOpenChange(next)
      }}
    >
      <CmxDialogContent className="max-w-2xl">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('forceClose.title')}</CmxDialogTitle>
        </CmxDialogHeader>

        <div className="space-y-4">
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>{t('forceClose.warning')}</span>
          </div>

          <div className="space-y-2">
            <Label htmlFor="force-close-reason">{t('forceClose.reason')} *</Label>
            <CmxTextarea
              id="force-close-reason"
              value={reason}
              placeholder={t('forceClose.reasonPlaceholder')}
              onChange={(event) => setReason(event.target.value)}
            />
          </div>

          <CashDrawerDispositionFields
            drawerId={drawerId}
            branchId={branchId}
            balances={balances}
            rows={rows}
            onRowChange={updateRow}
          />
        </div>

        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton variant="destructive" loading={submitting} onClick={submit} disabled={balances.length === 0}>
            {t('forceClose.confirm')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}
