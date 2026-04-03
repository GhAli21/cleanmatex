'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowUpRight, ArrowDownLeft, ChevronRight } from 'lucide-react'
import type { ErpLiteGlInquiryRow } from '@/lib/services/erp-lite-reporting.service'
import { formatErpLiteMoney, type ErpLiteDisplayConfig } from '@features/erp-lite/lib/display-format'

interface GlInquiryTableProps {
  rows: ErpLiteGlInquiryRow[]
  selectedJournalId?: string
  displayConfig: ErpLiteDisplayConfig
}

/**
 * Clickable GL inquiry table.
 * Selecting a row sets ?journalId= in the URL to open the detail panel.
 */
export function GlInquiryTable({ rows, selectedJournalId, displayConfig }: GlInquiryTableProps) {
  const t = useTranslations('erpLite.reports')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const openDetail = (journalId: string) => {
    const params = new URLSearchParams(searchParams.toString())
    if (params.get('journalId') === journalId) {
      params.delete('journalId')
    } else {
      params.set('journalId', journalId)
    }
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`)
    })
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-surface-rgb,255_255_255))] py-16 text-center">
        <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[rgb(var(--cmx-muted-rgb,241_245_249))]">
          <ArrowUpRight className="h-6 w-6 text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]" />
        </div>
        <p className="text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
          {t('gl.empty')}
        </p>
        <p className="mt-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
          {t('gl.emptyHint')}
        </p>
      </div>
    )
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-surface-rgb,255_255_255))]">
      <table className="min-w-full text-sm">
        <thead className="bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
          <tr>
            <th className="px-4 py-3 text-start font-medium">{t('columns.journal')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('columns.postingDate')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('columns.event')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('columns.account')}</th>
            <th className="px-4 py-3 text-start font-medium">{t('columns.side')}</th>
            <th className="px-4 py-3 text-end font-medium">{t('columns.amount')}</th>
            <th className="w-8 px-2 py-3" />
          </tr>
        </thead>
        <tbody>
          {rows.map((line) => {
            const isSelected = line.journal_id === selectedJournalId
            return (
              <tr
                key={`${line.journal_id}-${line.line_no}`}
                onClick={() => openDetail(line.journal_id)}
                className={`cursor-pointer border-t border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] transition-colors ${
                  isSelected
                    ? 'bg-[rgb(var(--cmx-primary-rgb,14_165_233))]/5 ring-1 ring-inset ring-[rgb(var(--cmx-primary-rgb,14_165_233))]/30'
                    : 'hover:bg-[rgb(var(--cmx-table-row-hover-bg-rgb,248_250_252))]'
                }`}
                aria-selected={isSelected}
              >
                {/* Journal column */}
                <td className="px-4 py-3">
                  <div className="font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                    {line.journal_no}
                  </div>
                  <div className="mt-0.5 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                    {line.source_doc_type_code}
                    {line.source_doc_no ? ` · ${line.source_doc_no}` : ''}
                  </div>
                </td>

                {/* Posting date */}
                <td className="px-4 py-3 text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                  {line.posting_date}
                </td>

                {/* Event */}
                <td className="px-4 py-3">
                  <span className="inline-flex rounded-full bg-[rgb(var(--cmx-muted-rgb,241_245_249))] px-2 py-0.5 text-xs font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                    {line.txn_event_code}
                  </span>
                </td>

                {/* Account */}
                <td className="px-4 py-3">
                  <span className="font-mono text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                    {line.account_code}
                  </span>
                  <span className="ms-1.5 text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                    {line.account_name}
                  </span>
                </td>

                {/* Side */}
                <td className="px-4 py-3">
                  {line.entry_side === 'DEBIT' ? (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600">
                      <ArrowUpRight className="h-3 w-3" />
                      DR
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600">
                      <ArrowDownLeft className="h-3 w-3" />
                      CR
                    </span>
                  )}
                </td>

                {/* Amount */}
                <td className="px-4 py-3 text-end">
                  <span className="font-mono text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
                    {formatErpLiteMoney(line.amount_txn_currency, {
                      ...displayConfig,
                      currencyCode: line.currency_code || displayConfig.currencyCode,
                    })}
                  </span>
                </td>

                {/* Chevron indicator */}
                <td className="px-2 py-3 text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
                  <ChevronRight
                    className={`h-4 w-4 transition-transform rtl:rotate-180 ${isSelected ? 'rotate-90' : ''}`}
                  />
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
