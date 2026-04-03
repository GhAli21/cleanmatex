'use client'

import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { ErpLiteArAgingRow } from '@/lib/services/erp-lite-reporting.service'
import { formatErpLiteMoney, type ErpLiteDisplayConfig } from '@features/erp-lite/lib/display-format'
import { CmxDataTable } from '@ui/data-display'
import { CmxCard, CmxCardContent, CmxCardDescription, CmxCardHeader, CmxCardTitle } from '@ui/primitives'

const BUCKET_ORDER = ['CURRENT', 'DUE_1_30', 'DUE_31_60', 'DUE_61_90', 'DUE_91_PLUS'] as const

interface ErpLiteArAgingGridProps {
  rows: ErpLiteArAgingRow[]
  displayConfig: ErpLiteDisplayConfig
}

export function ErpLiteArAgingGrid({ rows, displayConfig }: ErpLiteArAgingGridProps) {
  const t = useTranslations('erpLite.reports.arAging')
  const grouped = new Map<string, ErpLiteArAgingRow[]>()

  for (const row of rows) {
    const current = grouped.get(row.bucket_code) ?? []
    current.push(row)
    grouped.set(row.bucket_code, current)
  }

  const columns: ColumnDef<ErpLiteArAgingRow>[] = [
    {
      accessorKey: 'customer_name',
      header: t('columns.customer'),
      cell: ({ row }) => <div className="font-medium">{row.original.customer_name}</div>,
    },
    {
      accessorKey: 'invoice_no',
      header: t('columns.invoice'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.invoice_no}</div>
          <div className="text-xs text-muted-foreground">{row.original.invoice_date ?? '-'}</div>
        </div>
      ),
    },
    {
      accessorKey: 'due_date',
      header: t('columns.dueDate'),
      cell: ({ row }) => row.original.due_date ?? '-',
    },
    {
      id: 'days_overdue',
      header: () => <div className="text-right">{t('columns.daysOverdue')}</div>,
      cell: ({ row }) => <div className="text-right">{row.original.days_overdue}</div>,
    },
    {
      id: 'outstanding_amount',
      header: () => <div className="text-right">{t('columns.outstanding')}</div>,
      cell: ({ row }) => (
        <div className="text-right">
          {formatErpLiteMoney(row.original.outstanding_amount, {
            ...displayConfig,
            currencyCode: row.original.currency_code || displayConfig.currencyCode,
          })}
        </div>
      ),
    },
  ]

  return (
    <div className="grid gap-4 xl:grid-cols-3">
      {BUCKET_ORDER.map((bucketCode) => {
        const bucketRows = grouped.get(bucketCode) ?? []
        const bucketTotal = bucketRows.reduce((sum, row) => sum + row.outstanding_amount, 0)

        return (
          <CmxCard key={bucketCode}>
            <CmxCardHeader>
              <CmxCardTitle>{t(`buckets.${bucketCode}`)}</CmxCardTitle>
              <CmxCardDescription>{formatErpLiteMoney(bucketTotal, displayConfig)}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent>
              <CmxDataTable
                columns={columns}
                data={bucketRows}
                page={0}
                pageSize={Math.max(bucketRows.length, 1)}
                total={bucketRows.length}
                emptyMessage={t('empty')}
              />
            </CmxCardContent>
          </CmxCard>
        )
      })}
    </div>
  )
}
