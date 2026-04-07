'use client'

import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { ErpLiteOpenExceptionRow } from '@/lib/types/erp-lite-ops'
import { CmxDataTable } from '@ui/data-display'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives'

interface ErpLiteExceptionsScreenProps {
  rows: ErpLiteOpenExceptionRow[]
}

function ExcStatusBadge({ status }: { status: ErpLiteOpenExceptionRow['status_code'] }) {
  const palette: Record<string, string> = {
    NEW: 'bg-red-500/10 text-red-700',
    OPEN: 'bg-orange-500/10 text-orange-700',
    RETRY_PENDING: 'bg-blue-500/10 text-blue-700',
    RETRIED: 'bg-blue-500/10 text-blue-700',
    REPOST_PENDING: 'bg-purple-500/10 text-purple-700',
    REPOSTED: 'bg-purple-500/10 text-purple-700',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${palette[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      {status}
    </span>
  )
}

export function ErpLiteExceptionsScreen({ rows }: ErpLiteExceptionsScreenProps) {
  const t = useTranslations('erpLite.exceptions')

  const columns: ColumnDef<ErpLiteOpenExceptionRow>[] = [
    {
      accessorKey: 'created_at',
      header: t('columns.date'),
      cell: ({ row }) =>
        new Date(row.original.created_at).toLocaleDateString(),
    },
    {
      accessorKey: 'source_doc_type_code',
      header: t('columns.docType'),
    },
    {
      accessorKey: 'source_doc_no',
      header: t('columns.docNo'),
      cell: ({ row }) => row.original.source_doc_no ?? '—',
    },
    {
      accessorKey: 'txn_event_code',
      header: t('columns.event'),
    },
    {
      accessorKey: 'exception_type_code',
      header: t('columns.type'),
      cell: ({ row }) => (
        <span className="text-xs font-medium text-muted-foreground">
          {row.original.exception_type_code}
        </span>
      ),
    },
    {
      accessorKey: 'status_code',
      header: t('columns.status'),
      cell: ({ row }) => <ExcStatusBadge status={row.original.status_code} />,
    },
    {
      accessorKey: 'error_message',
      header: t('columns.error'),
      cell: ({ row }) => (
        <div
          className="max-w-xs truncate text-xs text-muted-foreground"
          title={row.original.error_message ?? ''}
        >
          {row.original.error_message ?? '—'}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div>
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
