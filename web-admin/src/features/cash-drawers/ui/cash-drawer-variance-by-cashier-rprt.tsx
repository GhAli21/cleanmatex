'use client'

import { useTranslations } from 'next-intl'

import type { VarianceByCashierEntry } from '@features/cash-drawers/api/cash-drawer-variance-report-api'
import { useCashDrawerMoneyFormatter } from '@features/cash-drawers/ui/cash-drawer-ui-parts'

/** Share of variance sessions that were shortages, as a whole percent; null when nothing varied. */
export function shortageSharePercent(share: number | null): number | null {
  return share === null ? null : Math.round(share * 100)
}

/**
 * Printable cash-variance-by-cashier table (A4). Variances of different currencies are separate
 * rows — never summed — and every figure is the exact fixed-point string from the database.
 */
export function CashDrawerVarianceByCashierRprt({
  rows,
  dateFrom,
  dateTo,
  branchLabel,
  generatedAt,
}: {
  rows: VarianceByCashierEntry[]
  dateFrom: string
  dateTo: string
  branchLabel: string | null
  generatedAt: string
}) {
  const t = useTranslations('cashVarianceReport')
  const money = useCashDrawerMoneyFormatter()

  return (
    <article className="mx-auto max-w-5xl bg-white p-6 text-sm text-gray-900">
      <header className="mb-4 border-b border-gray-300 pb-3">
        <h1 className="text-xl font-bold">{t('title')}</h1>
        <p className="text-gray-600">
          {t('period', { from: dateFrom, to: dateTo })} · {branchLabel ?? t('allBranches')}
        </p>
        <p className="text-gray-500">{t('generatedAt', { when: generatedAt })}</p>
      </header>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-gray-500">{t('emptyDescription')}</p>
      ) : (
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-300 text-gray-600">
              <th className="py-1 text-start font-medium">{t('columns.cashier')}</th>
              <th className="py-1 text-start font-medium">{t('columns.currency')}</th>
              <th className="py-1 text-end font-medium">{t('columns.sessions')}</th>
              <th className="py-1 text-end font-medium">{t('columns.shortOver')}</th>
              <th className="py-1 text-end font-medium">{t('columns.total')}</th>
              <th className="py-1 text-end font-medium">{t('columns.mean')}</th>
              <th className="py-1 text-end font-medium">{t('columns.absolute')}</th>
              <th className="py-1 text-end font-medium">{t('columns.shortageShare')}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const percent = shortageSharePercent(r.shortageShare)
              return (
                <tr key={`${r.cashierId}-${r.currencyCode}`} className="border-b border-gray-100">
                  <td className="py-1">{r.cashierName ?? r.cashierId ?? '—'}</td>
                  <td className="py-1">{r.currencyCode}</td>
                  <td className="py-1 text-end tabular-nums">{r.sessionCount}</td>
                  <td className="py-1 text-end tabular-nums">
                    {r.shortageCount} / {r.overageCount}
                  </td>
                  <td className="py-1 text-end tabular-nums">{money(r.totalVariance, r.currencyCode)}</td>
                  <td className="py-1 text-end tabular-nums">{money(r.meanVariance, r.currencyCode)}</td>
                  <td className="py-1 text-end tabular-nums">{money(r.absoluteVariance, r.currencyCode)}</td>
                  <td className="py-1 text-end tabular-nums">{percent === null ? '—' : `${percent}%`}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      <p className="mt-3 text-xs text-gray-500">{t('footnote')}</p>
    </article>
  )
}
