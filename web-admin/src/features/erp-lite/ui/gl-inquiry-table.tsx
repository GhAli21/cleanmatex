'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowUpRight, ArrowDownLeft, ChevronRight } from 'lucide-react'
import type { ErpLiteGlInquiryRow } from '@/lib/services/erp-lite-reporting.service'
import { formatErpLiteMoney, type ErpLiteDisplayConfig } from '@features/erp-lite/lib/display-format'
import { CmxDataTable, type CmxDataTableSimpleColumn } from '@ui/data-display/cmx-datatable'
import { CmxStatusBadge } from '@ui/feedback/cmx-status-badge'

interface GlInquiryTableProps {
  rows: ErpLiteGlInquiryRow[]
  selectedJournalId?: string
  displayConfig: ErpLiteDisplayConfig
}

/**
 * Clickable GL inquiry table.
 * Selecting a row sets ?journalId= in the URL to open the detail panel.
 * @param root0
 * @param root0.rows
 * @param root0.selectedJournalId
 * @param root0.displayConfig
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

  const columns: CmxDataTableSimpleColumn<ErpLiteGlInquiryRow>[] = [
    {
      key: 'journal_no',
      header: t('columns.journal'),
      sortable: false,
      render: (line) => (
        <>
          <div className="font-medium text-foreground">
            <bdi dir="ltr">{line.journal_no}</bdi>
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            {line.source_doc_type_code}
            {line.source_doc_no ? (
              <>
                {' · '}
                <bdi dir="ltr">{line.source_doc_no}</bdi>
              </>
            ) : null}
          </div>
        </>
      ),
    },
    {
      key: 'posting_date',
      header: t('columns.postingDate'),
      sortable: false,
      render: (line) => (
        <span className="text-foreground tabular-nums">
          <bdi dir="ltr">{line.posting_date}</bdi>
        </span>
      ),
    },
    {
      key: 'txn_event_code',
      header: t('columns.event'),
      sortable: false,
      render: (line) => (
        <CmxStatusBadge size="sm" tone="neutral" label={line.txn_event_code} />
      ),
    },
    {
      key: 'account',
      header: t('columns.account'),
      sortable: false,
      render: (line) => (
        <>
          <bdi dir="ltr" className="font-mono text-xs text-muted-foreground">
            {line.account_code}
          </bdi>
          <span className="ms-1.5 text-foreground">
            {line.account_name}
          </span>
        </>
      ),
    },
    {
      key: 'entry_side',
      header: t('columns.side'),
      sortable: false,
      render: (line) =>
        line.entry_side === 'DEBIT' ? (
          <CmxStatusBadge size="sm" tone="danger" icon={ArrowUpRight} label="DR" />
        ) : (
          <CmxStatusBadge size="sm" tone="success" icon={ArrowDownLeft} label="CR" />
        ),
    },
    {
      key: 'amount',
      header: t('columns.amount'),
      align: 'end',
      sortable: false,
      render: (line) => (
        <bdi dir="ltr" className="font-mono text-sm font-medium text-foreground tabular-nums">
          {formatErpLiteMoney(line.amount_txn_currency, {
            ...displayConfig,
            currencyCode: line.currency_code || displayConfig.currencyCode,
          })}
        </bdi>
      ),
    },
    {
      key: 'actions',
      header: '',
      align: 'end',
      sortable: false,
      render: (line) => {
        const isSelected = line.journal_id === selectedJournalId
        return (
          <ChevronRight
            className={`h-4 w-4 text-muted-foreground transition-transform rtl:rotate-180 ${isSelected ? 'rotate-90' : ''}`}
            aria-hidden="true"
          />
        )
      },
    },
  ]

  return (
    <CmxDataTable<ErpLiteGlInquiryRow>
      columns={columns}
      data={rows}
      auditConfig={false}
      scrollable={false}
      paginationFooter="never"
      onRowClick={(line) => openDetail(line.journal_id)}
      getRowClassName={(line) =>
        line.journal_id === selectedJournalId
          ? 'bg-primary/5 ring-1 ring-inset ring-ring/30'
          : undefined
      }
      emptyStateIcon={<ArrowUpRight className="h-6 w-6 text-muted-foreground" />}
      emptyStateTitle={t('gl.empty')}
      emptyStateDescription={t('gl.emptyHint')}
    />
  )
}
