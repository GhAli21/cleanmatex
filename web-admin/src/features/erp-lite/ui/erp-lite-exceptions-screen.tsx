'use client'

import * as React from 'react'
import Link from 'next/link'
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

  const grouped = React.useMemo(() => {
    const map = new Map<string, ErpLiteOpenExceptionRow[]>()
    for (const r of rows) {
      const k = r.exception_type_code
      const cur = map.get(k) ?? []
      cur.push(r)
      map.set(k, cur)
    }
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }, [rows])

  const columns: ColumnDef<ErpLiteOpenExceptionRow>[] = [
    {
      accessorKey: 'created_at',
      header: t('columns.date'),
      cell: ({ row }) => new Date(row.original.created_at).toLocaleDateString(),
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
        <span className="text-xs font-medium text-muted-foreground">{row.original.exception_type_code}</span>
      ),
    },
    {
      accessorKey: 'status_code',
      header: t('columns.status'),
      cell: ({ row }) => <ExcStatusBadge status={row.original.status_code} />,
    },
    {
      accessorKey: 'attempt_no',
      header: t('columns.attempt'),
      cell: ({ row }) =>
        row.original.attempt_no != null ? String(row.original.attempt_no) : '—',
    },
    {
      id: 'links',
      header: t('columns.links'),
      cell: ({ row }) => {
        const j = row.original.journal_id
        return (
          <div className="flex flex-col gap-1 text-xs">
            {j ? (
              <Link
                href={`/dashboard/erp-lite/gl?journalId=${encodeURIComponent(j)}`}
                className="text-primary hover:underline"
              >
                {t('links.gl')}
              </Link>
            ) : null}
            <Link href="/dashboard/erp-lite/usage-maps" className="text-primary hover:underline">
              {t('links.usageMaps')}
            </Link>
            <Link href="/dashboard/erp-lite/periods" className="text-primary hover:underline">
              {t('links.periods')}
            </Link>
          </div>
        )
      },
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

      {grouped.map(([type, groupRows]) => (
        <CmxCard key={type}>
          <CmxCardHeader>
            <CmxCardTitle>{t('groupHeading', { type, count: groupRows.length })}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent>
            <CmxDataTable
              columns={columns}
              data={groupRows}
              page={0}
              pageSize={Math.max(groupRows.length, 1)}
              total={groupRows.length}
              emptyMessage={t('empty')}
            />
          </CmxCardContent>
        </CmxCard>
      ))}

      {rows.length === 0 ? (
        <CmxCard>
          <CmxCardContent className="py-8 text-center text-sm text-muted-foreground">{t('empty')}</CmxCardContent>
        </CmxCard>
      ) : null}
    </div>
  )
}
