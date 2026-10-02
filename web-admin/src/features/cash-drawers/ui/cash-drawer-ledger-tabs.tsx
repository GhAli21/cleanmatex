'use client'

import { useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Plus } from 'lucide-react'

import {
  fetchDrawerCounts,
  fetchDrawerLedger,
  fetchDrawerTransactions,
  recordDrawerSpotCount,
  fetchCurrencyDenominations,
  type DrawerCountEntry,
  type DrawerLedgerEntry,
  type DrawerTrxEntry,
} from '@features/cash-drawers/api/cash-drawer-api'
import {
  useCashDrawerDateFormatter,
  useCashDrawerMoneyFormatter,
} from '@features/cash-drawers/ui/cash-drawer-ui-parts'
import { useCSRFToken } from '@lib/hooks/use-csrf-token'
import { useTenantCurrency } from '@lib/context/tenant-currency-context'
import { cmxMessage } from '@ui/feedback'
import { CmxDataTable, CmxMoneyVariance } from '@ui/data-display'
import { CmxButton, CmxInput, CmxSelect, CmxTextarea, Label } from '@ui/primitives'
import { Badge } from '@ui/primitives/badge'
import { CmxDenominationCounter } from '@ui/patterns'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'

const PAGE_SIZE = 20

/** Shared server-paged state for the three history tabs. */
function usePagedTab<T>(
  key: string,
  drawerId: string,
  fetcher: (input: { drawerId: string; page: number; pageSize: number }) => Promise<{ rows: T[]; totalCount: number }>,
) {
  const [page, setPage] = useState(1)
  const query = useQuery({
    queryKey: ['cash-drawers', drawerId, key, page],
    queryFn: () => fetcher({ drawerId, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })
  return { page, setPage, query }
}

function TabError({ message, onRetry, retryLabel }: { message: string; onRetry: () => void; retryLabel: string }) {
  return (
    <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
      <span>{message}</span>
      <CmxButton size="sm" variant="outline" onClick={onRetry}>
        {retryLabel}
      </CmxButton>
    </div>
  )
}

/**
 * Ledger tab (CLF-8-7) — paginated unified drawer ledger, finance cash
 * recognitions and custody transactions interleaved in posting order.
 * @param props component props
 * @param props.drawerId drawer whose ledger is shown
 */
export function CashDrawerLedgerTab({ drawerId }: { drawerId: string }) {
  const t = useTranslations('billing.cashDrawers')
  const tCommon = useTranslations('common')
  const money = useCashDrawerMoneyFormatter()
  const fmtDateTime = useCashDrawerDateFormatter()
  const { page, setPage, query } = usePagedTab<DrawerLedgerEntry>('ledger', drawerId, fetchDrawerLedger)

  if (query.isError) {
    return <TabError message={t('tabs.loadFailed')} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />
  }

  return (
    <CmxDataTable
      columns={[
        { key: 'ledgerSeq', header: t('tabs.ledger.seq'), render: (r: DrawerLedgerEntry) => <span className="font-mono text-xs">{r.ledgerSeq}</span> },
        { key: 'occurredAt', header: t('performedAt'), render: (r: DrawerLedgerEntry) => fmtDateTime(r.occurredAt) },
        {
          key: 'domain',
          header: t('tabs.ledger.source'),
          render: (r: DrawerLedgerEntry) => <Badge variant="outline">{t(`tabs.ledger.domain.${r.domain}`)}</Badge>,
        },
        { key: 'description', header: t('reason'), render: (r: DrawerLedgerEntry) => r.description ?? '—' },
        {
          key: 'direction',
          header: t('direction'),
          render: (r: DrawerLedgerEntry) => (r.direction === 'IN' ? t('cashIn') : t('cashOut')),
        },
        {
          key: 'amount',
          header: t('amount'),
          align: 'right' as const,
          render: (r: DrawerLedgerEntry) => (
            <span className={r.direction === 'IN' ? '' : 'text-destructive'}>
              {r.direction === 'IN' ? '+' : '−'}
              {money(r.amount, r.currencyCode)}
            </span>
          ),
        },
      ]}
      data={query.data?.rows ?? []}
      loading={query.isLoading}
      currentPage={page}
      pageSize={PAGE_SIZE}
      totalCount={query.data?.totalCount ?? 0}
      onPageChange={setPage}
      showPageSizeSelector={false}
      emptyStateTitle={t('tabs.ledger.emptyTitle')}
      emptyStateDescription={t('tabs.ledger.emptyDescription')}
    />
  )
}

/**
 * Transactions tab (CLF-8-7) — custody transactions touching this drawer.
 * @param props component props
 * @param props.drawerId drawer whose custody transactions are shown
 */
export function CashDrawerTransactionsTab({ drawerId }: { drawerId: string }) {
  const t = useTranslations('billing.cashDrawers')
  const tCommon = useTranslations('common')
  const money = useCashDrawerMoneyFormatter()
  const fmtDateTime = useCashDrawerDateFormatter()
  const { page, setPage, query } = usePagedTab<DrawerTrxEntry>('trx', drawerId, fetchDrawerTransactions)

  if (query.isError) {
    return <TabError message={t('tabs.loadFailed')} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />
  }

  return (
    <CmxDataTable
      columns={[
        { key: 'trxNo', header: t('tabs.trx.trxNo'), render: (r: DrawerTrxEntry) => <span className="font-mono text-xs">{r.trxNo}</span> },
        { key: 'occurredAt', header: t('performedAt'), render: (r: DrawerTrxEntry) => fmtDateTime(r.occurredAt) },
        {
          key: 'trxTypeCode',
          header: t('tabs.trx.type'),
          render: (r: DrawerTrxEntry) => (
            <div className="flex items-center gap-2">
              <span>{t(`tabs.trx.types.${r.trxTypeCode}` as Parameters<typeof t>[0])}</span>
              {r.reversesTrxId ? <Badge variant="outline">{t('tabs.trx.reversal')}</Badge> : null}
            </div>
          ),
        },
        {
          key: 'lines',
          header: t('amount'),
          align: 'right' as const,
          render: (r: DrawerTrxEntry) => {
            // Net effect on THIS drawer is not derivable from the row alone, so
            // show each leg (direction + amount) the transaction posted.
            return (
              <div className="space-y-0.5">
                {r.lines.map((l, i) => (
                  <div key={`${r.trxId}-${i}`} className={l.drawerId === drawerId ? 'font-semibold' : 'text-muted-foreground'}>
                    {l.direction === 'IN' ? '+' : '−'}
                    {money(l.amount, l.currencyCode)}
                  </div>
                ))}
              </div>
            )
          },
        },
        { key: 'notes', header: t('notes'), render: (r: DrawerTrxEntry) => r.notes ?? r.reasonCode ?? '—' },
      ]}
      data={query.data?.rows ?? []}
      loading={query.isLoading}
      currentPage={page}
      pageSize={PAGE_SIZE}
      totalCount={query.data?.totalCount ?? 0}
      onPageChange={setPage}
      showPageSizeSelector={false}
      emptyStateTitle={t('tabs.trx.emptyTitle')}
      emptyStateDescription={t('tabs.trx.emptyDescription')}
    />
  )
}

/**
 * Counts tab (CLF-8-7) — count history plus a spot-count entry dialog
 * (total-only or per-denomination; falls back to total-only when the
 * currency has no denomination catalog).
 * @param props component props
 * @param props.drawerId drawer whose counts are shown
 * @param props.currencyCode drawer currency
 * @param props.currentSessionId open session the spot count is taken against, if any
 * @param props.canCount whether the user may record a count
 */
export function CashDrawerCountsTab({
  drawerId,
  currencyCode,
  currentSessionId,
  canCount,
}: {
  drawerId: string
  currencyCode: string
  currentSessionId: string | null
  canCount: boolean
}) {
  const t = useTranslations('billing.cashDrawers')
  const tCommon = useTranslations('common')
  const money = useCashDrawerMoneyFormatter()
  const fmtDateTime = useCashDrawerDateFormatter()
  const queryClient = useQueryClient()
  const { token: csrfToken } = useCSRFToken()
  const { formatMoneyWithCode, decimalPlaces } = useTenantCurrency()
  const { page, setPage, query } = usePagedTab<DrawerCountEntry>('counts', drawerId, fetchDrawerCounts)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [countMode, setCountMode] = useState<'TOTAL_ONLY' | 'DENOMINATION'>('TOTAL_ONLY')
  const [totalAmount, setTotalAmount] = useState('')
  const [quantities, setQuantities] = useState<Record<string, number>>({})
  const [notes, setNotes] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const denominationsQuery = useQuery({
    queryKey: ['cash-drawers', 'currencies', currencyCode, 'denominations'],
    enabled: dialogOpen && countMode === 'DENOMINATION',
    queryFn: () => fetchCurrencyDenominations(currencyCode),
  })
  const denominations = denominationsQuery.data ?? []

  const reset = () => {
    setCountMode('TOTAL_ONLY')
    setTotalAmount('')
    setQuantities({})
    setNotes('')
  }

  const submit = async () => {
    if (countMode === 'TOTAL_ONLY' && !(Number(totalAmount) >= 0 && totalAmount.trim() !== '')) {
      cmxMessage.error(t('wizard.countedAmountRequired'))
      return
    }
    const lines = denominations
      .filter((d) => (quantities[d.id] ?? 0) > 0)
      .map((d) => ({ denominationId: d.id, quantity: quantities[d.id] }))
    if (countMode === 'DENOMINATION' && lines.length === 0) {
      cmxMessage.error(t('wizard.denominationBreakdownRequired'))
      return
    }
    setSubmitting(true)
    try {
      await recordDrawerSpotCount({
        drawerId,
        currencyCode,
        cashDrawerSessionId: currentSessionId ?? undefined,
        count:
          countMode === 'TOTAL_ONLY'
            ? { countMode, totalAmount: Number(totalAmount) }
            : { countMode, denominations: lines },
        notes: notes.trim() || undefined,
        csrfToken,
      })
      cmxMessage.success(t('tabs.counts.recorded'))
      reset()
      setDialogOpen(false)
      await queryClient.invalidateQueries({ queryKey: ['cash-drawers', drawerId, 'counts'] })
    } catch (error) {
      cmxMessage.error(error instanceof Error ? error.message : t('tabs.counts.recordFailed'))
    } finally {
      setSubmitting(false)
    }
  }

  if (query.isError) {
    return <TabError message={t('tabs.loadFailed')} onRetry={() => query.refetch()} retryLabel={tCommon('retry')} />
  }

  return (
    <div className="space-y-4">
      {canCount ? (
        <div className="flex justify-end">
          <CmxButton onClick={() => setDialogOpen(true)}>
            <Plus className="me-2 h-4 w-4" aria-hidden />
            {t('tabs.counts.record')}
          </CmxButton>
        </div>
      ) : null}

      <CmxDataTable
        columns={[
          { key: 'createdAt', header: t('performedAt'), render: (r: DrawerCountEntry) => fmtDateTime(r.createdAt) },
          {
            key: 'countType',
            header: t('tabs.counts.type'),
            render: (r: DrawerCountEntry) => (
              <Badge variant="outline">{t(`tabs.counts.types.${r.countType}` as Parameters<typeof t>[0])}</Badge>
            ),
          },
          { key: 'expected', header: t('expectedCash'), align: 'right' as const, render: (r: DrawerCountEntry) => money(r.expectedAmount, r.currencyCode) },
          { key: 'counted', header: t('tabs.counts.counted'), align: 'right' as const, render: (r: DrawerCountEntry) => money(r.countedAmount, r.currencyCode) },
          {
            key: 'variance',
            header: t('variance'),
            align: 'right' as const,
            render: (r: DrawerCountEntry) => <CmxMoneyVariance
                amount={Number(r.varianceAmount)}
                formattedAmount={money(Math.abs(Number(r.varianceAmount)), r.currencyCode)}
                labels={{ over: t('over'), short: t('short'), balanced: t('balanced') }}
                size="sm"
              />,
          },
          { key: 'notes', header: t('notes'), render: (r: DrawerCountEntry) => r.notes ?? '—' },
        ]}
        data={query.data?.rows ?? []}
        loading={query.isLoading}
        currentPage={page}
        pageSize={PAGE_SIZE}
        totalCount={query.data?.totalCount ?? 0}
        onPageChange={setPage}
        showPageSizeSelector={false}
        emptyStateTitle={t('tabs.counts.emptyTitle')}
        emptyStateDescription={t('tabs.counts.emptyDescription')}
      />

      <CmxDialog
        open={dialogOpen}
        onOpenChange={(next) => {
          if (!next) reset()
          setDialogOpen(next)
        }}
      >
        <CmxDialogContent className="max-w-lg">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('tabs.counts.record')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {currentSessionId ? t('tabs.counts.dialogDescriptionSession') : t('tabs.counts.dialogDescriptionNoSession')}
            </p>
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
            ) : denominations.length === 0 ? (
              <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('wizard.noDenominationCatalog')}</p>
            ) : (
              <CmxDenominationCounter
                denominations={denominations.map((d) => ({ id: d.id, label: d.name, valueMinor: d.denominationMinor }))}
                value={quantities}
                onChange={setQuantities}
                minorUnit={decimalPlaces}
                formatTotal={(totalMajor) => formatMoneyWithCode(totalMajor, currencyCode)}
                quantityLabel={t('wizard.denominationBreakdown')}
                totalLabel={t('wizard.countedAmount')}
                disabled={submitting}
              />
            )}
            <div className="space-y-2">
              <Label>{t('notesOptional')}</Label>
              <CmxTextarea value={notes} onChange={(event) => setNotes(event.target.value)} />
            </div>
          </div>
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton loading={submitting} onClick={submit}>
              {t('tabs.counts.record')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  )
}
