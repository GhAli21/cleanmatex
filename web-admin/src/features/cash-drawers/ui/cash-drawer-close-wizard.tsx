'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { cmxMessage } from '@ui/feedback'
import { CmxButton, CmxInput, CmxSelect, CmxSwitch, CmxTextarea, Label } from '@ui/primitives'
import { CmxDenominationCounter } from '@ui/patterns'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import { useCSRFToken } from '@lib/hooks/use-csrf-token'
import { useTenantCurrency } from '@lib/context/tenant-currency-context'
import { useCashDrawerErrorMessage } from '@features/cash-drawers/hooks/use-cash-drawer-error-message'
import { useDrawerCountMethod, type CountMethod } from '@features/cash-drawers/hooks/use-drawer-count-method'
import { CashCountMethodField } from '@features/cash-drawers/ui/cash-count-method-field'
import {
  startCashDrawerClose,
  finalizeCashDrawerClose,
  fetchCashDrawerCatalogs,
  fetchCurrencyDenominations,
  type CurrencyBalancePreview,
  type FinalizeCloseResultV2,
} from '@features/cash-drawers/api/cash-drawer-api'
import {
  EMPTY_DISPOSITION_ROW,
  buildDispositionPayload,
  type DispositionFormRow,
} from '@features/cash-drawers/model/cash-drawer-disposition'
import { CashDrawerDispositionFields } from '@features/cash-drawers/ui/cash-drawer-disposition-fields'

interface CashDrawerCloseWizardProps {
  drawerId: string
  sessionId: string
  branchId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onFinalized: (result: FinalizeCloseResultV2) => void
}

/**
 * Two-screen close wizard on the CLF lifecycle (plan §4B.10 CLF-8-5):
 * Count (optional physical count, freezes the cut) -> Result & Disposition
 * (per-currency reveal + mandatory disposition, posts the close). Shared by
 * the drawer overview screen and the POS session hub/list close flows.
 *
 * The supervisor recount and force-close are separate, permission-gated dialogs on the session
 * page (`CashDrawerRecountDialog`, `CashDrawerForceCloseDialog`); the disposition form is
 * shared with them through `CashDrawerDispositionFields` / `buildDispositionPayload`.
 */
export function CashDrawerCloseWizard({
  drawerId,
  sessionId,
  branchId,
  open,
  onOpenChange,
  onFinalized,
}: CashDrawerCloseWizardProps) {
  const t = useTranslations('billing.cashDrawers')
  const tCommon = useTranslations('common')
  const errorMessage = useCashDrawerErrorMessage()
  const { token: csrfToken } = useCSRFToken()
  const { formatMoneyWithCode, decimalPlaces } = useTenantCurrency()

  const [phase, setPhase] = useState<'count' | 'disposition'>('count')
  const [countNow, setCountNow] = useState(false)
  const [countChoice, setCountMode] = useState<CountMethod>('TOTAL_ONLY')
  const countPolicy = useDrawerCountMethod(drawerId, 'closing', open)
  const countMode = countPolicy.resolve(countChoice)
  const [totalAmount, setTotalAmount] = useState('')
  const [denomQuantities, setDenomQuantities] = useState<Record<string, number>>({})
  const [countNotes, setCountNotes] = useState('')
  const [balances, setBalances] = useState<CurrencyBalancePreview[]>([])
  const [dispositions, setDispositions] = useState<Record<string, DispositionFormRow>>({})
  const [varianceReason, setVarianceReason] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const catalogsQuery = useQuery({
    queryKey: ['cash-drawers', 'catalogs'],
    enabled: open,
    queryFn: () => fetchCashDrawerCatalogs(),
  })

  // The drawer's own currency — the field the balance rows key off of. In
  // practice there is exactly one row (P12 pins one currency per drawer).
  const primaryCurrencyCode = balances[0]?.currencyCode

  const denominationsQuery = useQuery({
    queryKey: ['cash-drawers', 'currencies', primaryCurrencyCode ?? 'none', 'denominations'],
    enabled: open && countNow && countMode === 'DENOMINATION' && !!primaryCurrencyCode,
    queryFn: () => fetchCurrencyDenominations(primaryCurrencyCode as string),
  })

  const resetAll = () => {
    setPhase('count')
    setCountNow(false)
    setCountMode('TOTAL_ONLY')
    setTotalAmount('')
    setDenomQuantities({})
    setCountNotes('')
    setBalances([])
    setDispositions({})
    setVarianceReason('')
  }

  const handleStartClose = async () => {
    if (countNow && countMode === 'TOTAL_ONLY') {
      // A blank field is not a zero count: Number('') is 0, which would silently book a full shortage.
      const numeric = Number(totalAmount)
      if (totalAmount.trim() === '' || !Number.isFinite(numeric) || numeric < 0) {
        cmxMessage.error(t('wizard.countedAmountRequired'))
        return
      }
    }

    setSubmitting(true)
    try {
      const denominations = denominationsQuery.data ?? []
      const result = await startCashDrawerClose({
        drawerId,
        sessionId,
        closingCount: countNow
          ? {
              countMode,
              totalAmount: countMode === 'TOTAL_ONLY' ? Number(totalAmount) : undefined,
              denominations:
                countMode === 'DENOMINATION'
                  ? denominations
                      .filter((d) => (denomQuantities[d.id] ?? 0) > 0)
                      .map((d) => ({ denominationId: d.id, quantity: denomQuantities[d.id] }))
                  : undefined,
            }
          : undefined,
        notes: countNotes.trim() || undefined,
        csrfToken,
      })

      setBalances(result.currencyBalances)
      setDispositions(
        Object.fromEntries(
          result.currencyBalances.map((b) => [
            b.currencyCode,
            { ...EMPTY_DISPOSITION_ROW },
          ]),
        ),
      )
      setPhase('disposition')
    } catch (error) {
      cmxMessage.error(errorMessage(error, t('messages.closeFailed')))
    } finally {
      setSubmitting(false)
    }
  }

  const updateDisposition = (currencyCode: string, patch: Partial<DispositionFormRow>) => {
    setDispositions((prev) => ({ ...prev, [currencyCode]: { ...prev[currencyCode], ...patch } }))
  }

  const anyVarianceReasonRequired = balances.some((b) => b.varianceReasonRequired)

  const handleFinalize = async () => {
    const { payload, error } = buildDispositionPayload(
      balances.map((b) => b.currencyCode),
      dispositions,
      catalogsQuery.data?.dispositions ?? [],
    )
    if (error) {
      cmxMessage.error(t(`wizard.${error}`))
      return
    }

    if (anyVarianceReasonRequired && !varianceReason.trim()) {
      cmxMessage.error(t('wizard.varianceReasonRequired'))
      return
    }

    setSubmitting(true)
    try {
      const result = await finalizeCashDrawerClose({
        drawerId,
        sessionId,
        dispositions: payload,
        varianceReason: varianceReason.trim() || undefined,
        csrfToken,
      })
      cmxMessage.success(
        result.varianceApprovalPending ? t('wizard.closedPendingApproval') : t('messages.sessionClosed'),
      )
      onFinalized(result)
      resetAll()
      onOpenChange(false)
    } catch (error) {
      cmxMessage.error(errorMessage(error, t('messages.closeFailed')))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <CmxDialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAll()
        onOpenChange(next)
      }}
    >
      <CmxDialogContent className="max-w-2xl">
        <CmxDialogHeader>
          <CmxDialogTitle>{phase === 'count' ? t('closeSessionConfirm') : t('wizard.resultAndDisposition')}</CmxDialogTitle>
        </CmxDialogHeader>

        {phase === 'count' ? (
          <div className="space-y-4">
            <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('closeSessionDesc')}</p>

            <CmxSwitch
              checked={countNow}
              onCheckedChange={setCountNow}
              label={t('wizard.countNow')}
              description={t('wizard.countNowDescription')}
            />

            {countNow ? (
              <div className="space-y-4 rounded-xl border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
                <CashCountMethodField methods={countPolicy.methods} value={countMode} onChange={setCountMode} />
                {countMode === 'TOTAL_ONLY' ? (
                  <CmxInput
                    label={t('wizard.countedAmount')}
                    type="number"
                    min="0"
                    step="0.001"
                    value={totalAmount}
                    onChange={(event) => setTotalAmount(event.target.value)}
                  />
                ) : denominationsQuery.isLoading ? (
                  <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{tCommon('loading')}</p>
                ) : (denominationsQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('wizard.noDenominationCatalog')}</p>
                ) : (
                  <CmxDenominationCounter
                    denominations={(denominationsQuery.data ?? []).map((d) => ({ id: d.id, label: d.name, valueMinor: d.denominationMinor }))}
                    value={denomQuantities}
                    onChange={setDenomQuantities}
                    minorUnit={decimalPlaces}
                    formatTotal={(totalMajor) => formatMoneyWithCode(totalMajor, primaryCurrencyCode)}
                    quantityLabel={t('wizard.denominationBreakdown')}
                    totalLabel={t('wizard.countedAmount')}
                    disabled={submitting}
                  />
                )}
              </div>
            ) : null}

            <div className="space-y-2">
              <Label>{t('notesOptional')}</Label>
              <CmxTextarea value={countNotes} onChange={(event) => setCountNotes(event.target.value)} />
            </div>
          </div>
        ) : (
          <div className="space-y-5">
            <CashDrawerDispositionFields
              drawerId={drawerId}
              branchId={branchId}
              balances={balances}
              rows={dispositions}
              onRowChange={updateDisposition}
            />

            {anyVarianceReasonRequired ? (
              <div className="space-y-2">
                <Label>{t('wizard.varianceReason')}</Label>
                <CmxTextarea value={varianceReason} onChange={(event) => setVarianceReason(event.target.value)} />
              </div>
            ) : null}
          </div>
        )}

        <CmxDialogFooter>
          {phase === 'disposition' ? (
            <CmxButton variant="outline" onClick={() => setPhase('count')} disabled={submitting}>
              {tCommon('back')}
            </CmxButton>
          ) : (
            <CmxButton variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              {tCommon('cancel')}
            </CmxButton>
          )}
          {phase === 'count' ? (
            <CmxButton loading={submitting} onClick={handleStartClose}>
              {tCommon('next')}
            </CmxButton>
          ) : (
            <CmxButton variant="destructive" loading={submitting} onClick={handleFinalize}>
              {t('confirmClose')}
            </CmxButton>
          )}
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}
