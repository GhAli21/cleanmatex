'use client'

import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { cmxMessage } from '@ui/feedback'
import { CmxButton, CmxInput, CmxSwitch } from '@ui/primitives'
import { CmxDenominationCounter } from '@ui/patterns'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import { useTenantCurrency } from '@lib/context/tenant-currency-context'
import { useCashDrawerErrorMessage } from '@features/cash-drawers/hooks/use-cash-drawer-error-message'
import { useDrawerCountMethod, type CountMethod } from '@features/cash-drawers/hooks/use-drawer-count-method'
import { CashCountMethodField } from '@features/cash-drawers/ui/cash-count-method-field'
import {
  fetchCurrencyDenominations,
  recordMissingOpeningCount,
  type CashDrawerOpeningDenomination,
  type OpeningCountInput,
} from '@features/cash-drawers/api/cash-drawer-api'
import { useCSRFToken } from '@/lib/hooks/use-csrf-token'

interface PosSessionConnectDrawerDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  drawerId: string
  sessionId: string
  sessionNo: string
  currencyCode: string
  /** Counted opening total when the session has a count that is not a denomination breakdown. */
  openingCountedAmount: number | null
  denominations: CashDrawerOpeningDenomination[]
  /** Links the POS session after an optional new opening count is saved. False keeps the dialog open. */
  onConnected: () => Promise<boolean>
}

/**
 * Confirms connecting a POS session to the cashier's own open drawer session.
 * A session with no denomination count offers the same count step as opening;
 * a session that already has one shows that count to verify.
 */
export function PosSessionConnectDrawerDialog({
  open,
  onOpenChange,
  drawerId,
  sessionId,
  sessionNo,
  currencyCode,
  openingCountedAmount,
  denominations,
  onConnected,
}: PosSessionConnectDrawerDialogProps) {
  const t = useTranslations('posSessions')
  const tDrawers = useTranslations('billing.cashDrawers')
  const tCommon = useTranslations('common')
  const errorMessage = useCashDrawerErrorMessage()
  const { token: csrfToken } = useCSRFToken()
  const { formatMoneyWithCode, decimalPlaces } = useTenantCurrency()

  const hasDenominationCount = denominations.length > 0
  const hasRegisteredTotal = !hasDenominationCount && openingCountedAmount != null

  const [countNow, setCountNow] = useState(false)
  const [countChoice, setCountMode] = useState<CountMethod>('DENOMINATION')
  const countPolicy = useDrawerCountMethod(drawerId, 'opening', open && !hasDenominationCount && !hasRegisteredTotal)
  const countMode = countPolicy.resolve(countChoice)
  const [totalAmount, setTotalAmount] = useState('')
  const [denomQuantities, setDenomQuantities] = useState<Record<string, number>>({})
  const [submitting, setSubmitting] = useState(false)

  const denominationsQuery = useQuery({
    queryKey: ['cash-drawers', 'currencies', currencyCode, 'denominations'],
    enabled: open && countNow && countMode === 'DENOMINATION' && !hasDenominationCount && !hasRegisteredTotal,
    queryFn: () => fetchCurrencyDenominations(currencyCode),
  })
  const catalog = denominationsQuery.data ?? []

  const reset = () => {
    setCountNow(false)
    setCountMode('DENOMINATION')
    setTotalAmount('')
    setDenomQuantities({})
  }

  const buildCount = (): OpeningCountInput | null => {
    if (!countNow) return null
    if (countMode === 'TOTAL_ONLY') {
      const numeric = Number(totalAmount)
      if (totalAmount.trim() === '' || !Number.isFinite(numeric) || numeric < 0) {
        cmxMessage.error(tDrawers('wizard.countedAmountRequired'))
        return null
      }
      return { countMode, totalAmount: numeric }
    }
    const lines = catalog
      .filter((row) => (denomQuantities[row.id] ?? 0) > 0)
      .map((row) => ({ denominationId: row.id, quantity: denomQuantities[row.id] }))
    if (lines.length === 0) {
      cmxMessage.error(tDrawers('wizard.denominationBreakdownRequired'))
      return null
    }
    return { countMode, denominations: lines }
  }

  const handleConfirm = async () => {
    const openingCount = hasDenominationCount || hasRegisteredTotal ? null : buildCount()
    if (!hasDenominationCount && !hasRegisteredTotal && countNow && !openingCount) return

    setSubmitting(true)
    try {
      if (openingCount) {
        try {
          await recordMissingOpeningCount({
            drawerId,
            sessionId,
            openingCount,
            csrfToken,
          })
        } catch (error) {
          if (!(error instanceof Error) || error.message !== 'OPENING_COUNT_ALREADY_RECORDED') throw error
        }
      }
      const linked = await onConnected()
      if (!linked) return
      reset()
      onOpenChange(false)
    } catch (error) {
      cmxMessage.error(errorMessage(error, t('messages.drawerLinkFailed')))
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
      <CmxDialogContent className="max-w-lg">
        <CmxDialogHeader>
          <CmxDialogTitle>{t('hub.connectOpenDrawerTitle')}</CmxDialogTitle>
        </CmxDialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t('hub.connectOpenDrawerDescription', { sessionNo })}
          </p>

          {hasDenominationCount ? (
            <RegisteredDenominationCount
              denominations={denominations}
              currencyCode={currencyCode}
              formatMoney={formatMoneyWithCode}
            />
          ) : hasRegisteredTotal ? (
            <div className="rounded-xl border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
              <p className="text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                {t('hub.registeredCount')}
              </p>
              <p className="mt-2 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {formatMoneyWithCode(openingCountedAmount, currencyCode)}
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {t('hub.noDenominationYet')}
              </p>
              <CmxSwitch
                checked={countNow}
                onCheckedChange={setCountNow}
                label={tDrawers('wizard.countNow')}
                description={tDrawers('wizard.countNowDescription')}
              />
              {countNow ? (
                <div className="space-y-4 rounded-xl border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
                  <CashCountMethodField methods={countPolicy.methods} value={countMode} onChange={setCountMode} />
                  {countMode === 'TOTAL_ONLY' ? (
                    <CmxInput
                      label={tDrawers('wizard.countedAmount')}
                      type="number"
                      min="0"
                      step="0.001"
                      value={totalAmount}
                      onChange={(event) => setTotalAmount(event.target.value)}
                    />
                  ) : denominationsQuery.isLoading ? (
                    <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{tCommon('loading')}</p>
                  ) : catalog.length === 0 ? (
                    <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                      {tDrawers('wizard.noDenominationCatalog')}
                    </p>
                  ) : (
                    <CmxDenominationCounter
                      denominations={catalog.map((row) => ({ id: row.id, label: row.name, valueMinor: row.denominationMinor }))}
                      value={denomQuantities}
                      onChange={setDenomQuantities}
                      minorUnit={decimalPlaces}
                      formatTotal={(totalMajor) => formatMoneyWithCode(totalMajor, currencyCode)}
                      quantityLabel={tDrawers('wizard.denominationBreakdown')}
                      totalLabel={tDrawers('wizard.countedAmount')}
                      disabled={submitting}
                    />
                  )}
                </div>
              ) : null}
            </>
          )}
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
            {tCommon('cancel')}
          </CmxButton>
          <CmxButton loading={submitting} onClick={() => void handleConfirm()}>
            {tCommon('confirm')}
          </CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}

function RegisteredDenominationCount({
  denominations,
  currencyCode,
  formatMoney,
}: {
  denominations: CashDrawerOpeningDenomination[]
  currencyCode: string
  formatMoney: (amount: number, currencyCode: string) => string
}) {
  const t = useTranslations('posSessions')
  const total = denominations.reduce((sum, line) => sum + line.lineAmount, 0)

  return (
    <div className="space-y-2 rounded-xl border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4">
      <p className="text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{t('hub.registeredCount')}</p>
      <ul className="space-y-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
        {denominations.map((line) => (
          <li key={`${line.name}-${line.valueMinor}`} className="flex items-center justify-between gap-3">
            <span>{line.name}</span>
            <span>{t('hub.registeredCountLine', { quantity: line.quantity, amount: formatMoney(line.lineAmount, currencyCode) })}</span>
          </li>
        ))}
      </ul>
      <div className="flex items-center justify-between border-t border-[rgb(var(--cmx-border-rgb,226_232_240))] pt-2 text-sm font-medium">
        <span>{t('hub.registeredCountTotal')}</span>
        <span>{formatMoney(total, currencyCode)}</span>
      </div>
    </div>
  )
}
