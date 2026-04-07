'use client'

import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { ErpLitePeriodRow } from '@/lib/types/erp-lite-ops'
import { CmxDataTable } from '@ui/data-display'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives'

interface ErpLitePeriodsScreenProps {
  rows: ErpLitePeriodRow[]
}

function PeriodStatusBadge({ status }: { status: ErpLitePeriodRow['status_code'] }) {
  const palette: Record<string, string> = {
    OPEN: 'bg-green-500/10 text-green-700',
    SOFT_LOCKED: 'bg-amber-500/10 text-amber-700',
    CLOSED: 'bg-muted text-muted-foreground',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${palette[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      {status}
    </span>
  )
}

export function ErpLitePeriodsScreen({ rows }: ErpLitePeriodsScreenProps) {
  const t = useTranslations('erpLite.periods')

  const columns: ColumnDef<ErpLitePeriodRow>[] = [
    {
      accessorKey: 'period_code',
      header: t('columns.code'),
      cell: ({ row }) => (
        <div className="font-medium">{row.original.period_code}</div>
      ),
    },
    {
      accessorKey: 'name',
      header: t('columns.name'),
    },
    {
      accessorKey: 'start_date',
      header: t('columns.startDate'),
    },
    {
      accessorKey: 'end_date',
      header: t('columns.endDate'),
    },
    {
      accessorKey: 'status_code',
      header: t('columns.status'),
      cell: ({ row }) => <PeriodStatusBadge status={row.original.status_code} />,
    },
    {
      accessorKey: 'closed_at',
      header: t('columns.closedAt'),
      cell: ({ row }) =>
        row.original.closed_at
          ? new Date(row.original.closed_at).toLocaleDateString()
          : '—',
    },
    {
      accessorKey: 'closed_by',
      header: t('columns.closedBy'),
      cell: ({ row }) => row.original.closed_by ?? '—',
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
