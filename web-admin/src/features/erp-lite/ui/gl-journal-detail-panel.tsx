'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { X, FileText, ArrowUpRight, ArrowDownLeft, Hash, Calendar, Globe } from 'lucide-react'
import { Badge } from '@ui/primitives/badge'
import type { ErpLiteGlJournalDetail } from '@/lib/services/erp-lite-reporting.service'
import {
  formatErpLiteExchangeRate,
  formatErpLiteMoney,
  type ErpLiteDisplayConfig,
} from '@features/erp-lite/lib/display-format'

interface GlJournalDetailPanelProps {
  journal: ErpLiteGlJournalDetail
  displayConfig: ErpLiteDisplayConfig
}

/**
 * Slide-over detail panel for a single GL journal.
 * Rendered server-side; close button navigates back via search params.
 */
export function GlJournalDetailPanel({ journal, displayConfig }: GlJournalDetailPanelProps) {
  const t = useTranslations('erpLite.reports')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const closeDetail = () => {
    const params = new URLSearchParams(searchParams.toString())
    params.delete('journalId')
    router.push(`${pathname}?${params.toString()}`)
  }

  const totalDebit = journal.lines.reduce(
    (s, l) => (l.entry_side === 'DEBIT' ? s + l.amount_txn_currency : s),
    0,
  )
  const totalCredit = journal.lines.reduce(
    (s, l) => (l.entry_side === 'CREDIT' ? s + l.amount_txn_currency : s),
  0,
  )
  const isBalanced = Math.abs(totalDebit - totalCredit) < 0.0001

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={closeDetail}
        aria-hidden="true"
      />

      {/* Panel */}
      <aside
        role="complementary"
        aria-label={t('gl.detail.panelLabel')}
        className="fixed inset-y-0 end-0 z-50 flex w-full max-w-lg flex-col bg-[rgb(var(--cmx-surface-rgb,255_255_255))] shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-start justify-between border-b border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] p-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium uppercase tracking-widest text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('gl.detail.eyebrow')}
            </p>
            <h2 className="truncate text-xl font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
              {journal.journal_no}
            </h2>
            <div className="mt-1 flex flex-wrap items-center gap-2">
              <StatusBadge status={journal.status_code} />
              <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {journal.txn_event_code}
              </span>
            </div>
          </div>
          <button
            onClick={closeDetail}
            aria-label={t('gl.detail.close')}
            className="ms-4 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] transition hover:bg-[rgb(var(--cmx-muted-rgb,241_245_249))] hover:text-[rgb(var(--cmx-foreground-rgb,15_23_42))]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto">
          {/* Meta fields */}
          <div className="grid grid-cols-2 gap-px border-b border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]">
            <MetaField
              icon={<Calendar className="h-3.5 w-3.5" />}
              label={t('columns.postingDate')}
              value={journal.posting_date}
            />
            <MetaField
              icon={<Calendar className="h-3.5 w-3.5" />}
              label={t('gl.detail.journalDate')}
              value={journal.journal_date}
            />
            <MetaField
              icon={<FileText className="h-3.5 w-3.5" />}
              label={t('gl.detail.sourceDoc')}
              value={`${journal.source_doc_type_code}${journal.source_doc_no ? ' · ' + journal.source_doc_no : ''}`}
            />
            <MetaField
              icon={<Globe className="h-3.5 w-3.5" />}
              label={t('gl.detail.currency')}
              value={`${journal.currency_code} @ ${formatErpLiteExchangeRate(Number(journal.exchange_rate), displayConfig)}`}
            />
            {journal.posted_at && (
              <MetaField
                icon={<Hash className="h-3.5 w-3.5" />}
                label={t('gl.detail.postedAt')}
                value={journal.posted_at}
              />
            )}
            {journal.posted_by && (
              <MetaField
                icon={<Hash className="h-3.5 w-3.5" />}
                label={t('gl.detail.postedBy')}
                value={journal.posted_by}
              />
            )}
          </div>

          {/* Narration */}
          {journal.narration && (
            <div className="border-b border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] px-5 py-3">
              <p className="text-xs font-medium uppercase tracking-wider text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {t('gl.detail.narration')}
              </p>
              <p className="mt-1 text-sm text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{journal.narration}</p>
            </div>
          )}

          {/* Journal lines table */}
          <div className="px-5 py-4">
            <p className="mb-3 text-xs font-medium uppercase tracking-wider text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('gl.detail.lines')} ({journal.lines.length})
            </p>
            <div className="overflow-x-auto rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]">
              <table className="min-w-full text-sm">
                <thead className="bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                  <tr>
                    <th className="px-3 py-2 text-start font-medium">#</th>
                    <th className="px-3 py-2 text-start font-medium">{t('columns.account')}</th>
                    <th className="px-3 py-2 text-start font-medium">{t('columns.side')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('gl.detail.amountTxn')}</th>
                    <th className="px-3 py-2 text-end font-medium">{t('gl.detail.amountBase')}</th>
                  </tr>
                </thead>
                <tbody>
                  {journal.lines.map((line) => (
                    <tr
                      key={line.line_no}
                      className="border-t border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]"
                    >
                      <td className="px-3 py-2 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                        {line.line_no}
                      </td>
                      <td className="px-3 py-2">
                        <div className="font-medium">{line.account_code}</div>
                        <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                          {line.account_name}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <SideChip side={line.entry_side} />
                      </td>
                      <td className="px-3 py-2 text-end font-mono text-xs">
                        {formatErpLiteMoney(line.amount_txn_currency, {
                          ...displayConfig,
                          currencyCode: journal.currency_code || displayConfig.currencyCode,
                        })}
                      </td>
                      <td className="px-3 py-2 text-end font-mono text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                        {formatErpLiteMoney(line.amount_base_currency, displayConfig)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Totals footer */}
            <div className="mt-3 flex justify-end gap-6 rounded-lg bg-[rgb(var(--cmx-muted-rgb,241_245_249))] px-4 py-3 text-sm">
              <span className="flex items-center gap-1 font-medium text-[rgb(var(--cmx-debit-rgb,239_68_68,239_68_68))]">
                <ArrowUpRight className="h-3.5 w-3.5" />
                {t('columns.debit')}: {formatErpLiteMoney(totalDebit, {
                  ...displayConfig,
                  currencyCode: journal.currency_code || displayConfig.currencyCode,
                })}
              </span>
              <span className="flex items-center gap-1 font-medium text-[rgb(var(--cmx-credit-rgb,34_197_94,34_197_94))]">
                <ArrowDownLeft className="h-3.5 w-3.5" />
                {t('columns.credit')}: {formatErpLiteMoney(totalCredit, {
                  ...displayConfig,
                  currencyCode: journal.currency_code || displayConfig.currencyCode,
                })}
              </span>
              {!isBalanced && (
                <span className="font-semibold text-[rgb(var(--cmx-destructive-rgb,239_68_68))]">
                  ⚠ {t('gl.detail.unbalanced')}
                </span>
              )}
            </div>
          </div>
        </div>
      </aside>
    </>
  )
}

// ---------------------------------------------------------------------------
// Internal sub-components
// ---------------------------------------------------------------------------

function MetaField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex flex-col gap-0.5 bg-[rgb(var(--cmx-surface-rgb,255_255_255))] px-5 py-3">
      <span className="flex items-center gap-1 text-[10px] font-medium uppercase tracking-widest text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
        {icon}
        {label}
      </span>
      <span className="text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{value}</span>
    </div>
  )
}

function SideChip({ side }: { side: string }) {
  if (side === 'DEBIT') {
    return (
      <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
        <ArrowUpRight className="h-3 w-3" />
        DR
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
      <ArrowDownLeft className="h-3 w-3" />
      CR
    </span>
  )
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    POSTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    DRAFT: 'bg-amber-50 text-amber-700 border-amber-200',
    REVERSED: 'bg-slate-100 text-slate-600 border-slate-200',
    FAILED: 'bg-red-50 text-red-700 border-red-200',
  }
  const cls = colors[status] ?? 'bg-slate-100 text-slate-600 border-slate-200'
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${cls}`}>
      {status}
    </span>
  )
}
