'use client'

import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Printer, RefreshCw } from 'lucide-react'
import { useReportsClock } from '@features/reports/ui/reports-clock'
import { shiftCivilDate } from '@/lib/utils/operational-time'

import {
  fetchVarianceByCashier,
  varianceReportKey,
  type VarianceByCashierEntry,
} from '@features/cash-drawers/api/cash-drawer-variance-report-api'
import { shortageSharePercent } from '@features/cash-drawers/ui/cash-drawer-variance-by-cashier-rprt'
import { useCashDrawerMoneyFormatter } from '@features/cash-drawers/ui/cash-drawer-ui-parts'
import { CmxDataTable } from '@ui/data-display'
import { CmxButton, CmxInput, CmxSelect } from '@ui/primitives'

import { CmxSummaryMessage, CmxStatusBadge } from '@ui/feedback'

interface BranchOption {
  id: string
  name: string
  name2: string | null
}

/**
 * Cash variance by cashier (C4): per cashier and currency, how the closed drawer sessions of a
 * date range came out — count, total / mean / absolute variance and the shortage-versus-overage
 * skew. Limited server-side to the viewer's branches. A cashier who is persistently short shows
 * up as a high shortage share, not just a large single miss.
 */
export function CashDrawerVarianceReportScreen() {
  const t = useTranslations('cashVarianceReport')
  const tCommon = useTranslations('common')
  const tReports = useTranslations('reports')
  const money = useCashDrawerMoneyFormatter()
  const { today } = useReportsClock()

  const [dateFrom, setDateFrom] = useState(() => (today ? shiftCivilDate(today, -30) : ''))
  const [dateTo, setDateTo] = useState(() => today)
  const [branchId, setBranchId] = useState('')

  const rangeInvalid = dateFrom > dateTo
  const query = useMemo(
    () => ({ dateFrom, dateTo, ...(branchId ? { branchId } : {}) }),
    [dateFrom, dateTo, branchId],
  )

  const branchesQuery = useQuery({
    queryKey: ['branches', 'options'],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<BranchOption[]> => {
      const res = await fetch('/api/v1/branches', { credentials: 'include' })
      const json = await res.json()
      if (!res.ok) throw new Error(json?.error ?? 'Failed to load branches')
      return json.data ?? []
    },
  })

  const reportQuery = useQuery({
    queryKey: varianceReportKey(query),
    queryFn: () => fetchVarianceByCashier(query),
    enabled: Boolean(dateFrom && dateTo) && !rangeInvalid,
  })

  const printHref = `/dashboard/reports/cash-variance/print?${new URLSearchParams(query).toString()}`
  const rows = reportQuery.data?.rows ?? []

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-foreground">{t('title')}</h1>
          <p className="text-sm text-muted-foreground">{t('description')}</p>
        </div>
        <div className="flex gap-2">
          <CmxButton variant="outline" size="sm" loading={reportQuery.isFetching} onClick={() => reportQuery.refetch()}>
            <RefreshCw className="me-2 h-4 w-4" aria-hidden />
            {tCommon('refresh')}
          </CmxButton>
          <CmxButton
            variant="outline"
            size="sm"
            disabled={rangeInvalid || rows.length === 0}
            onClick={() => window.open(printHref, '_blank', 'noopener')}
          >
            <Printer className="me-2 h-4 w-4" aria-hidden />
            {tCommon('print')}
          </CmxButton>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <CmxInput label={t('dateFrom')} type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <CmxInput label={t('dateTo')} type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        <CmxSelect
          label={t('branch')}
          value={branchId}
          onChange={(e) => setBranchId(e.target.value)}
          options={[
            { value: '', label: t('allBranches') },
            ...(branchesQuery.data ?? []).map((b) => ({ value: b.id, label: b.name2 ?? b.name })),
          ]}
        />
      </div>

      {!today ? <CmxSummaryMessage type="warning" message={tReports('timezoneNotConfigured')} /> : null}
      {rangeInvalid ? <CmxSummaryMessage type="warning" title={t('rangeInvalidTitle')} items={[t('rangeInvalid')]} /> : null}

      {reportQuery.isError ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
          <span>{t('loadFailed')}</span>
          <CmxButton size="sm" variant="outline" onClick={() => reportQuery.refetch()}>
            {tCommon('retry')}
          </CmxButton>
        </div>
      ) : (
        <CmxDataTable
          columns={[
            {
              key: 'cashier',
              header: t('columns.cashier'),
              render: (r: VarianceByCashierEntry) => r.cashierName ?? r.cashierId ?? '—',
            },
            { key: 'currency', header: t('columns.currency'), render: (r: VarianceByCashierEntry) => r.currencyCode },
            {
              key: 'sessions',
              header: t('columns.sessions'),
              align: 'right' as const,
              render: (r: VarianceByCashierEntry) => r.sessionCount,
            },
            {
              key: 'shortOver',
              header: t('columns.shortOver'),
              align: 'right' as const,
              render: (r: VarianceByCashierEntry) => (
                <span className="tabular-nums">
                  {r.shortageCount} / {r.overageCount}
                </span>
              ),
            },
            {
              key: 'total',
              header: t('columns.total'),
              align: 'right' as const,
              render: (r: VarianceByCashierEntry) => (
                <span className={`tabular-nums font-semibold ${Number(r.totalVariance) < 0 ? 'text-danger-text' : ''}`}>
                  {money(r.totalVariance, r.currencyCode)}
                </span>
              ),
            },
            {
              key: 'mean',
              header: t('columns.mean'),
              align: 'right' as const,
              render: (r: VarianceByCashierEntry) => <span className="tabular-nums">{money(r.meanVariance, r.currencyCode)}</span>,
            },
            {
              key: 'absolute',
              header: t('columns.absolute'),
              align: 'right' as const,
              render: (r: VarianceByCashierEntry) => <span className="tabular-nums">{money(r.absoluteVariance, r.currencyCode)}</span>,
            },
            {
              key: 'shortageShare',
              header: t('columns.shortageShare'),
              align: 'right' as const,
              render: (r: VarianceByCashierEntry) => {
                const percent = shortageSharePercent(r.shortageShare)
                if (percent === null) return <CmxStatusBadge size="sm" tone="success">{t('balanced')}</CmxStatusBadge>
                return <CmxStatusBadge size="sm" tone={percent >= 75 ? 'danger' : percent >= 50 ? 'warning' : 'neutral'}>{percent}%</CmxStatusBadge>
              },
            },
            {
              key: 'decisions',
              header: t('columns.decisions'),
              render: (r: VarianceByCashierEntry) => (
                <span className="flex flex-wrap gap-1">
                  {r.pendingDecisionCount > 0 ? (
                    <CmxStatusBadge size="sm" tone="warning">{t('pending', { count: r.pendingDecisionCount })}</CmxStatusBadge>
                  ) : null}
                  {r.rejectedCount > 0 ? (
                    <CmxStatusBadge size="sm" tone="danger" appearance="solid">{t('rejected', { count: r.rejectedCount })}</CmxStatusBadge>
                  ) : null}
                  {r.pendingDecisionCount === 0 && r.rejectedCount === 0 ? '—' : null}
                </span>
              ),
            },
          ]}
          data={rows}
          loading={reportQuery.isLoading && !rangeInvalid}
          currentPage={1}
          pageSize={Math.max(rows.length, 1)}
          totalCount={rows.length}
          onPageChange={() => undefined}
          showPageSizeSelector={false}
          emptyStateTitle={t('emptyTitle')}
          emptyStateDescription={t('emptyDescription')}
        />
      )}

      <p className="text-xs text-muted-foreground">{t('footnote')}</p>
    </div>
  )
}
