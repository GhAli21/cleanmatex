/**
 * Cash variance by cashier — print preview
 * Route: /dashboard/reports/cash-variance/print?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD[&branchId=...]
 */

'use client'

import { useSearchParams } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import {
  fetchVarianceByCashier,
  varianceReportKey,
  type VarianceReportQuery,
} from '@features/cash-drawers/api/cash-drawer-variance-report-api'
import { CashDrawerVarianceByCashierRprt } from '@features/cash-drawers/ui/cash-drawer-variance-by-cashier-rprt'
import { useCashDrawerDateFormatter } from '@features/cash-drawers/ui/cash-drawer-ui-parts'

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

export default function CashVarianceReportPrintPage() {
  const searchParams = useSearchParams()
  const t = useTranslations('cashVarianceReport')
  const tCommon = useTranslations('common')
  const fmtDateTime = useCashDrawerDateFormatter()

  const dateFrom = searchParams.get('dateFrom') ?? ''
  const dateTo = searchParams.get('dateTo') ?? ''
  const branchId = searchParams.get('branchId') ?? undefined
  const valid = DATE_ONLY.test(dateFrom) && DATE_ONLY.test(dateTo) && dateFrom <= dateTo

  const branchesQuery = useQuery({
    queryKey: ['branches', 'options'],
    staleTime: 5 * 60_000,
    enabled: Boolean(branchId),
    queryFn: async (): Promise<Array<{ id: string; name: string; name2: string | null }>> => {
      const res = await fetch('/api/v1/branches', { credentials: 'include' })
      const json = await res.json()
      return res.ok ? (json.data ?? []) : []
    },
  })
  const branch = branchesQuery.data?.find((b) => b.id === branchId)

  const query: VarianceReportQuery = { dateFrom, dateTo, ...(branchId ? { branchId } : {}) }
  const reportQuery = useQuery({
    queryKey: varianceReportKey(query),
    queryFn: () => fetchVarianceByCashier(query),
    enabled: valid,
  })

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-5xl items-center justify-between px-4 print:hidden">
        <h1 className="text-lg font-semibold">{t('title')}</h1>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!reportQuery.data}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {tCommon('print')}
        </button>
      </div>

      {!valid ? (
        <div className="mx-auto max-w-lg rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t('rangeInvalid')}
        </div>
      ) : null}
      {valid && reportQuery.isLoading ? (
        <div className="flex h-40 items-center justify-center text-gray-500">{tCommon('loading')}</div>
      ) : null}
      {valid && reportQuery.isError ? (
        <div className="mx-auto max-w-lg rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {t('loadFailed')}
        </div>
      ) : null}
      {valid && reportQuery.data ? (
        <div className="print-document px-4">
          <CashDrawerVarianceByCashierRprt
            rows={reportQuery.data.rows}
            dateFrom={dateFrom}
            dateTo={dateTo}
            branchLabel={branch ? (branch.name2 ?? branch.name) : null}
            generatedAt={fmtDateTime(new Date().toISOString())}
          />
        </div>
      ) : null}
    </div>
  )
}
