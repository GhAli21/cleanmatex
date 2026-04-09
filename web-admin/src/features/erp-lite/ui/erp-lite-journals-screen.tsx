'use client'

import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { ErpLiteJournalListRow } from '@/lib/types/erp-lite-ops'
import { CmxDataTable } from '@ui/data-display'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives'

interface ErpLiteJournalsScreenProps {
  rows: ErpLiteJournalListRow[]
}

export function ErpLiteJournalsScreen({ rows }: ErpLiteJournalsScreenProps) {
  const t = useTranslations('erpLite.journals')

  const columns: ColumnDef<ErpLiteJournalListRow>[] = [
    {
      accessorKey: 'journal_no',
      header: t('columns.journalNo'),
      cell: ({ row }) => (
        <Link
          href={`/dashboard/erp-lite/gl?journalId=${encodeURIComponent(row.original.id)}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.journal_no}
        </Link>
      ),
    },
    {
      accessorKey: 'posting_date',
      header: t('columns.postingDate'),
    },
    {
      accessorKey: 'status_code',
      header: t('columns.status'),
    },
    {
      accessorKey: 'txn_event_code',
      header: t('columns.event'),
    },
    {
      accessorKey: 'source_doc_no',
      header: t('columns.docNo'),
      cell: ({ row }) => row.original.source_doc_no ?? '—',
    },
    {
      accessorKey: 'total_debit',
      header: t('columns.debit'),
      cell: ({ row }) => row.original.total_debit,
    },
    {
      accessorKey: 'total_credit',
      header: t('columns.credit'),
      cell: ({ row }) => row.original.total_credit,
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">ERP-Lite</p>
        <h1 className="text-2xl font-semibold">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </div>
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('table.title', { count: rows.length })}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          <CmxDataTable
            columns={columns}
            data={rows}
            page={0}
            pageSize={Math.max(rows.length, 1)}
            total={rows.length}
            emptyMessage={t('empty')}
          />
        </CmxCardContent>
      </CmxCard>
    </div>
  )
}
