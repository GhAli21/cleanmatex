'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { cmxMessage } from '@ui/feedback'
import { CmxButton, CmxInput, CmxSelect, CmxSwitch, CmxTextarea, Label } from '@ui/primitives'
import { CmxDenominationCounter } from '@ui/patterns'
import { CmxMoneyVariance } from '@ui/data-display'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import { useCSRFToken } from '@lib/hooks/use-csrf-token'
import { useTenantCurrency } from '@lib/context/tenant-currency-context'
import { useCashDrawerErrorMessage } from '@features/cash-drawers/hooks/use-cash-drawer-error-message'
import {
  startCashDrawerClose,
  finalizeCashDrawerClose,
  fetchCashDrawerCatalogs,
  fetchCurrencyDenominations,
  fetchCashDrawersWithCurrentSession,
  type CurrencyBalancePreview,
  type FinalizeCloseResultV2,
  type DispositionDecisionInput,
} from '@features/cash-drawers/api/cash-drawer-api'

interface CashDrawerCloseWizardProps {
  drawerId: string
  sessionId: string
  branchId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onFinalized: (result: FinalizeCloseResultV2) => void
}

interface DispositionFormRow {
  dispositionCode: string
  destDrawerId: string
  keptAmount: string
  dispositionNotes: string
}

/**
 * Two-screen close wizard on the CLF lifecycle (plan §4B.10 CLF-8-5):
 * Count (optional physical count, freezes the cut) -> Result & Disposition
 * (per-currency reveal + mandatory disposition, posts the close). Shared by
 * the drawer overview screen and the POS session hub/list close flows.
 *
 * Deliberately out of scope for this pass (documented, not silently
 * dropped): the supervisor recount sub-step and force-close. Both need their
 * own permission-gated entry points and are lower-frequency paths than the
 * everyday open/count/finalize flow this wizard replaces.
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
  const [countMode, setCountMode] = useState<'TOTAL_ONLY' | 'DENOMINATION'>('TOTAL_ONLY')
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

  const siblingDrawersQuery = useQuery({
    queryKey: ['cash-drawers', 'with-current-session', branchId ?? 'none', 'close-wizard'],
    enabled: open && phase === 'disposition' && !!branchId,
    queryFn: () => fetchCashDrawersWithCurrentSession(branchId),
  })

  const drawerTypeCanReceive = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const dt of catalogsQuery.data?.drawerTypes ?? []) map.set(dt.code, dt.canReceiveDisposition)
    return map
  }, [catalogsQuery.data])

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
            { dispositionCode: '', destDrawerId: '', keptAmount: '', dispositionNotes: '' },
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
    const dispositionCatalog = catalogsQuery.data?.dispositions ?? []
    const payload: DispositionDecisionInput[] = []

    for (const balance of balances) {
      const row = dispositions[balance.currencyCode]
      if (!row?.dispositionCode) {
        cmxMessage.error(t('wizard.dispositionRequired'))
        return
      }
      const disp = dispositionCatalog.find((d) => d.code === row.dispositionCode)
      if (disp && disp.cashMoveMode !== 'NONE' && !row.destDrawerId) {
        cmxMessage.error(t('wizard.destinationRequired'))
        return
      }
      if (disp?.requiresNotes && !row.dispositionNotes.trim()) {
        cmxMessage.error(t('wizard.dispositionNotesRequired'))
        return
      }
      if (disp?.requiresKeptAmount) {
        const kept = Number(row.keptAmount)
        if (row.keptAmount.trim() === '' || !Number.isFinite(kept) || kept < 0) {
          cmxMessage.error(t('wizard.keptAmountRequired'))
          return
        }
      }

      payload.push({
        currencyCode: balance.currencyCode,
        dispositionCode: row.dispositionCode,
        dispositionNotes: row.dispositionNotes.trim() || undefined,
        destDrawerId: row.destDrawerId || undefined,
        keptAmount: disp?.requiresKeptAmount ? Number(row.keptAmount) : undefined,
      })
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

  const siblingDrawerOptions = (currencyCode: string, dispositionCode: string) => {
    const disp = (catalogsQuery.data?.dispositions ?? []).find((d) => d.code === dispositionCode)
    const drawers = siblingDrawersQuery.data ?? []
    return drawers
      .filter((d) => d.id !== drawerId && d.is_active && d.currency_code === currencyCode)
      .filter((d) => (disp?.destDrawerTypeCode ? d.drawer_type === disp.destDrawerTypeCode : drawerTypeCanReceive.get(d.drawer_type) ?? false))
      .map((d) => ({ value: d.id, label: `${d.drawer_name} (${d.drawer_code})` }))
  }

  /**
   * The selectable dispositions for one currency. A cash-moving disposition is disabled — with the
   * reason in its label and a hint under the select — when the branch has no active drawer that can
   * receive it, instead of letting the user pick it and fail later with an empty destination list.
   * Nothing is disabled while the sibling drawers are still loading.
   */
  const dispositionOptions = (currencyCode: string) =>
    (catalogsQuery.data?.dispositions ?? [])
      .filter((d) => d.isSelectable)
      .map((d) => {
        const unavailable =
          d.cashMoveMode !== 'NONE' &&
          !siblingDrawersQuery.isLoading &&
          siblingDrawerOptions(currencyCode, d.code).length === 0
        return {
          value: d.code,
          label: unavailable ? `${d.name} — ${t('wizard.noEligibleDestinationShort')}` : d.name,
          disabled: unavailable,
        }
      })

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
                <CmxSelect
                  label={t('wizard.countMethod')}
                  value={countMode}
                  onChange={(event) => setCountMode(event.target.value as 'TOTAL_ONLY' | 'DENOMINATION')}
                  options={[
                    { value: 'TOTAL_ONLY', label: t('wizard.countMethodTotal') },
                    { value: 'DENOMINATION', label: t('wizard.countMethodDenomination') },
                  ]}
                />
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
            {balances.map((balance) => {
              const row = dispositions[balance.currencyCode]
              const disp = (catalogsQuery.data?.dispositions ?? []).find((d) => d.code === row?.dispositionCode)
              const variance = balance.closingVariance != null ? Number(balance.closingVariance) : 0

              return (
                <div key={balance.currencyCode} className="space-y-3 rounded-xl border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-semibold">{balance.currencyCode}</span>
                    {balance.closingVariance != null ? (
                      <CmxMoneyVariance
                        amount={variance}
                        formattedAmount={formatMoneyWithCode(Math.abs(variance), balance.currencyCode)}
                        labels={{ over: t('over'), short: t('short'), balanced: t('balanced') }}
                      />
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <ResultMetric label={t('expectedCash')} value={formatMoneyWithCode(Number(balance.closingExpected ?? 0), balance.currencyCode)} />
                    <ResultMetric
                      label={t('wizard.countedAmount')}
                      value={balance.closingCounted != null ? formatMoneyWithCode(Number(balance.closingCounted), balance.currencyCode) : t('wizard.notCountedYet')}
                    />
                    <ResultMetric
                      label={t('variance')}
                      value={balance.closingVariance != null ? formatMoneyWithCode(Number(balance.closingVariance), balance.currencyCode) : '—'}
                    />
                  </div>

                  <CmxSelect
                    label={t('wizard.disposition')}
                    value={row?.dispositionCode ?? ''}
                    onChange={(event) => updateDisposition(balance.currencyCode, { dispositionCode: event.target.value, destDrawerId: '' })}
                    options={dispositionOptions(balance.currencyCode)}
                    placeholder={t('wizard.selectDisposition')}
                  />
                  {dispositionOptions(balance.currencyCode).some((o) => o.disabled) ? (
                    <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                      {t('wizard.unavailableDispositionsHint')}
                    </p>
                  ) : null}

                  {disp && disp.cashMoveMode !== 'NONE' ? (
                    <CmxSelect
                      label={t('wizard.destinationDrawer')}
                      value={row?.destDrawerId ?? ''}
                      onChange={(event) => updateDisposition(balance.currencyCode, { destDrawerId: event.target.value })}
                      options={siblingDrawerOptions(balance.currencyCode, row?.dispositionCode ?? '')}
                      placeholder={t('wizard.selectDestination')}
                    />
                  ) : null}

                  {disp?.requiresKeptAmount ? (
                    <CmxInput
                      label={t('wizard.keptAmount')}
                      type="number"
                      min="0"
                      step="0.001"
                      value={row?.keptAmount ?? ''}
                      onChange={(event) => updateDisposition(balance.currencyCode, { keptAmount: event.target.value })}
                    />
                  ) : null}

                  {disp?.requiresNotes || disp?.code === 'OTHER' ? (
                    <CmxTextarea
                      placeholder={t('wizard.dispositionNotesPlaceholder')}
                      value={row?.dispositionNotes ?? ''}
                      onChange={(event) => updateDisposition(balance.currencyCode, { dispositionNotes: event.target.value })}
                    />
                  ) : null}
                </div>
              )
            })}

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

function ResultMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-muted-rgb,248_250_252))] p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  )
}
