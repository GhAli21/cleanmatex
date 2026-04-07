'use client'

import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { ErpLitePostLogRow } from '@/lib/types/erp-lite-ops'
import { CmxDataTable } from '@ui/data-display'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives'

interface ErpLitePostAuditScreenProps {
  rows: ErpLitePostLogRow[]
  total: number
  page: number
  pageSize: number
}

function LogStatusBadge({ status }: { status: string }) {
  const palette: Record<string, string> = {
    POSTED: 'bg-green-500/10 text-green-700',
    FAILED: 'bg-red-500/10 text-red-700',
    REVERSED: 'bg-amber-500/10 text-amber-700',
    PENDING: 'bg-blue-500/10 text-blue-700',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${palette[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      {status}
    </span>
  )
}

export function ErpLitePostAuditScreen({
  rows,
  total,
  page,
  pageSize,
}: ErpLitePostAuditScreenProps) {
  const t = useTranslations('erpLite.postAudit')

  const columns: ColumnDef<ErpLitePostLogRow>[] = [
    {
      accessorKey: 'created_at',
      header: t('columns.date'),
      cell: ({ row }) =>
        new Date(row.original.created_at).toLocaleString(),
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
      accessorKey: 'attempt_no',
      header: t('columns.attempt'),
      cell: ({ row }) => (
        <div className="text-center">{row.original.attempt_no}</div>
      ),
    },
    {
      accessorKey: 'log_status_code',
      header: t('columns.status'),
      cell: ({ row }) => <LogStatusBadge status={row.original.log_status_code} />,
    },
    {
      accessorKey: 'journal_id',
      header: t('columns.journal'),
      cell: ({ row }) =>
        row.original.journal_id ? (
          <span className="font-mono text-xs">
            {row.original.journal_id.slice(0, 8)}…
          </span>
        ) : (
          '—'
        ),
    },
    {
      accessorKey: 'error_code',
      header: t('columns.errorCode'),
      cell: ({ row }) =>
        row.original.error_code ? (
          <span className="text-xs text-red-700">{row.original.error_code}</span>
        ) : (
          '—'
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
          <CmxCardTitle>{t('table.title', { total })}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          <CmxDataTable
            columns={columns}
            data={rows}
            page={page - 1}
            pageSize={pageSize}
            total={total}
            emptyMessage={t('empty')}
          />
        </CmxCardContent>
      </CmxCard>
    </div>
  )
}
