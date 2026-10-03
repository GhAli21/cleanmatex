'use client'

import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import { CmxInput, CmxSelect, CmxTextarea } from '@ui/primitives'
import { CmxMoneyVariance } from '@ui/data-display'
import { useTenantCurrency } from '@lib/context/tenant-currency-context'
import {
  fetchCashDrawerCatalogs,
  fetchCashDrawersWithCurrentSession,
  type CurrencyBalancePreview,
} from '@features/cash-drawers/api/cash-drawer-api'
import type { DispositionFormRow } from '@features/cash-drawers/model/cash-drawer-disposition'

interface CashDrawerDispositionFieldsProps {
  /** The drawer being closed — never offered as its own destination. */
  drawerId: string
  /** Branch whose other drawers can receive cash; destinations stay within the branch. */
  branchId: string | null
  /** One card per currency, showing the result and asking for its disposition. */
  balances: CurrencyBalancePreview[]
  rows: Record<string, DispositionFormRow>
  onRowChange: (currencyCode: string, patch: Partial<DispositionFormRow>) => void
}

/**
 * The result-and-disposition step of closing a drawer session: per currency, the expected /
 * counted / variance figures and the disposition of the closing cash (left in the drawer, moved to
 * a safe, ...) with its destination, kept amount and notes. Shared by the close wizard and the
 * supervisor force-close dialog; validation lives in `buildDispositionPayload`.
 *
 * A cash-moving disposition is disabled - with the reason in its label and a hint under the
 * select - when the branch has no active drawer that can receive it, instead of letting the user
 * pick it and fail later with an empty destination list.
 */
export function CashDrawerDispositionFields({
  drawerId,
  branchId,
  balances,
  rows,
  onRowChange,
}: CashDrawerDispositionFieldsProps) {
  const t = useTranslations('billing.cashDrawers')
  const { formatMoneyWithCode } = useTenantCurrency()

  const catalogsQuery = useQuery({
    queryKey: ['cash-drawers', 'catalogs'],
    queryFn: () => fetchCashDrawerCatalogs(),
  })
  const siblingDrawersQuery = useQuery({
    queryKey: ['cash-drawers', 'with-current-session', branchId ?? 'none', 'close-wizard'],
    enabled: !!branchId,
    queryFn: () => fetchCashDrawersWithCurrentSession(branchId),
  })

  const drawerTypeCanReceive = useMemo(() => {
    const map = new Map<string, boolean>()
    for (const dt of catalogsQuery.data?.drawerTypes ?? []) map.set(dt.code, dt.canReceiveDisposition)
    return map
  }, [catalogsQuery.data])

  const siblingDrawerOptions = (currencyCode: string, dispositionCode: string) => {
    const disp = (catalogsQuery.data?.dispositions ?? []).find((d) => d.code === dispositionCode)
    return (siblingDrawersQuery.data ?? [])
      .filter((d) => d.id !== drawerId && d.is_active && d.currency_code === currencyCode)
      .filter((d) =>
        disp?.destDrawerTypeCode ? d.drawer_type === disp.destDrawerTypeCode : (drawerTypeCanReceive.get(d.drawer_type) ?? false)
      )
      .map((d) => ({ value: d.id, label: `${d.drawer_name} (${d.drawer_code})` }))
  }

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
    <div className="space-y-5">
      {balances.map((balance) => {
        const row = rows[balance.currencyCode]
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
              <ResultMetric
                label={t('expectedCash')}
                value={balance.closingExpected != null ? formatMoneyWithCode(Number(balance.closingExpected), balance.currencyCode) : '—'}
              />
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
              onChange={(event) => onRowChange(balance.currencyCode, { dispositionCode: event.target.value, destDrawerId: '' })}
              options={dispositionOptions(balance.currencyCode)}
              placeholder={t('wizard.selectDisposition')}
            />
            {dispositionOptions(balance.currencyCode).some((o) => o.disabled) ? (
              <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('wizard.unavailableDispositionsHint')}</p>
            ) : null}

            {disp && disp.cashMoveMode !== 'NONE' ? (
              <CmxSelect
                label={t('wizard.destinationDrawer')}
                value={row?.destDrawerId ?? ''}
                onChange={(event) => onRowChange(balance.currencyCode, { destDrawerId: event.target.value })}
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
                onChange={(event) => onRowChange(balance.currencyCode, { keptAmount: event.target.value })}
              />
            ) : null}

            {disp?.requiresNotes || disp?.code === 'OTHER' ? (
              <CmxTextarea
                placeholder={t('wizard.dispositionNotesPlaceholder')}
                value={row?.dispositionNotes ?? ''}
                onChange={(event) => onRowChange(balance.currencyCode, { dispositionNotes: event.target.value })}
              />
            ) : null}
          </div>
        )
      })}
    </div>
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
