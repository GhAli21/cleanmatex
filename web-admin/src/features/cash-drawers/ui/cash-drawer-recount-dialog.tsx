'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { cmxMessage } from '@ui/feedback'
import { CmxButton, CmxInput, CmxSelect, CmxTextarea, Label } from '@ui/primitives'
import { CmxDenominationCounter } from '@ui/patterns'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import { useCSRFToken } from '@lib/hooks/use-csrf-token'
import { useTenantCurrency } from '@lib/context/tenant-currency-context'
import { useCashDrawerErrorMessage } from '@features/cash-drawers/hooks/use-cash-drawer-error-message'
import { useDrawerCountMethod, type CountMethod } from '@features/cash-drawers/hooks/use-drawer-count-method'
import { CashCountMethodField } from '@features/cash-drawers/ui/cash-count-method-field'
import {
  fetchCurrencyDenominations,
  recountCashDrawerClose,
  type SessionClosureBalanceView,
  type SessionClosureCountView,
} from '@features/cash-drawers/api/cash-drawer-api'
import { findRecountTarget } from '@features/cash-drawers/model/cash-drawer-recount'

interface CashDrawerRecountDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  drawerId: string
  sessionId: string
  /** The session's per-currency balances and counts (closure view). */
  balances: SessionClosureBalanceView[]
  counts: SessionClosureCountView[]
  onRecounted: () => void
}

/**
 * Supervisor recount of a session that is in the count step (`CLOSING`). The new physical count
 * supersedes the latest closing count of one currency against the same frozen cut; the previous
 * count stays in the history. The typed amount is never altered - the server returns the new
 * expected / counted / variance and the page reloads to show them.
 *
 * Gated by `cash_drawer:approve_variance` at the API; the caller only renders the entry point for
 * holders of it. No maker-checker: the supervisor may be the person who took the first count.
 */
export function CashDrawerRecountDialog({
  open,
  onOpenChange,
  drawerId,
  sessionId,
  balances,
  counts,
  onRecounted,
}: CashDrawerRecountDialogProps) {
  const t = useTranslations('billing.cashDrawers')
  const tCommon = useTranslations('common')
  const errorMessage = useCashDrawerErrorMessage()
  const { token: csrfToken } = useCSRFToken()
  const { formatMoneyWithCode, decimalPlaces } = useTenantCurrency()

  const recountable = balances.filter((b) => findRecountTarget(counts, b.currencyCode))
  const [currencyCode, setCurrencyCode] = useState('')
  const [countChoice, setCountMode] = useState<CountMethod>('TOTAL_ONLY')
  const countPolicy = useDrawerCountMethod(drawerId, 'closing', open)
  const countMode = countPolicy.resolve(countChoice)
  const [totalAmount, setTotalAmount] = useState('')
  const [denomQuantities, setDenomQuantities] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const activeCurrency = currencyCode || recountable[0]?.currencyCode || ''
  const target = activeCurrency ? findRecountTarget(counts, activeCurrency) : null
  const balance = balances.find((b) => b.currencyCode === activeCurrency)

  const denominationsQuery = useQuery({
    queryKey: ['cash-drawers', 'currencies', activeCurrency || 'none', 'denominations'],
    enabled: open && countMode === 'DENOMINATION' && !!activeCurrency,
    queryFn: () => fetchCurrencyDenominations(activeCurrency),
  })

  const reset = () => {
    setCurrencyCode('')
    setCountMode('TOTAL_ONLY')
    setTotalAmount('')
    setDenomQuantities({})
    setNotes('')
  }

  const submit = async () => {
    if (!target) return
    if (countMode === 'TOTAL_ONLY') {
      // A blank field is not a zero count: Number('') is 0, which would silently book a full shortage.
      const numeric = Number(totalAmount)
      if (totalAmount.trim() === '' || !Number.isFinite(numeric) || numeric < 0) {
        cmxMessage.error(t('wizard.countedAmountRequired'))
        return
      }
    }
    const denominations = (denominationsQuery.data ?? [])
      .filter((d) => (denomQuantities[d.id] ?? 0) > 0)
      .map((d) => ({ denominationId: d.id, quantity: denomQuantities[d.id] }))
    if (countMode === 'DENOMINATION' && denominations.length === 0) {
      cmxMessage.error(t('wizard.countedAmountRequired'))
      return
    }

    setSubmitting(true)
    try {
      const result = await recountCashDrawerClose({
        drawerId,
        sessionId,
        currencyCode: activeCurrency,
        count:
          countMode === 'TOTAL_ONLY'
            ? { countMode, totalAmount: Number(totalAmount) }
            : { countMode, denominations },
        supersedesCountId: target.countId,
        notes: notes.trim() || undefined,
        csrfToken,
      })
      cmxMessage.success(
        t('recount.recorded', {
          counted: formatMoneyWithCode(Number(result.closingCounted), result.currencyCode),
          variance: formatMoneyWithCode(Number(result.closingVariance), result.currencyCode),
        }),
      )
      reset()
      onOpenChange(false)
      onRecounted()
    } catch (error) {
      cmxMessage.error(errorMessage(error, t('recount.failed')))
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
      <CmxDialogContent className="max-w-xl">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('recount.title')}</CmxDialogTitle>
        </CmxDialogHeader>

        {recountable.length === 0 ? (
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('recount.nothingToRecount')}</p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('recount.description')}</p>

            {recountable.length > 1 ? (
              <CmxSelect
                label={t('recount.currency')}
                value={activeCurrency}
                onChange={(event) => {
                  setCurrencyCode(event.target.value)
                  setDenomQuantities({})
                }}
                options={recountable.map((b) => ({ value: b.currencyCode, label: b.currencyCode }))}
              />
            ) : null}

            {balance ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <Metric
                  label={t('expectedCash')}
                  value={balance.closingExpected != null ? formatMoneyWithCode(Number(balance.closingExpected), balance.currencyCode) : '—'}
                />
                <Metric
                  label={t('recount.previousCount')}
                  value={balance.closingCounted != null ? formatMoneyWithCode(Number(balance.closingCounted), balance.currencyCode) : '—'}
                />
                <Metric
                  label={t('variance')}
                  value={balance.closingVariance != null ? formatMoneyWithCode(Number(balance.closingVariance), balance.currencyCode) : '—'}
                />
              </div>
            ) : null}

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
                  formatTotal={(totalMajor) => formatMoneyWithCode(totalMajor, activeCurrency)}
                  quantityLabel={t('wizard.denominationBreakdown')}
                  totalLabel={t('wizard.countedAmount')}
                  disabled={submitting}
                />
              )}
            </div>

            <div className="space-y-2">
              <Label>{t('notesOptional')}</Label>
              <CmxTextarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>
        )}

        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tCommon('cancel')}
          </CmxButton>
          {recountable.length > 0 ? (
            <CmxButton loading={submitting} onClick={submit}>
              {t('recount.confirm')}
            </CmxButton>
          ) : null}
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-muted-rgb,248_250_252))] p-3">
      <div className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{label}</div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  )
}
