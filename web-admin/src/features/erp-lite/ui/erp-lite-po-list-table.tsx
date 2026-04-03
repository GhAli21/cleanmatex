'use client'

import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { ErpLitePoDashboardSnapshot } from '@/lib/types/erp-lite-v2'
import { formatErpLiteMoney, type ErpLiteDisplayConfig } from '@features/erp-lite/lib/display-format'
import { CmxDataTable } from '@ui/data-display'

interface ErpLitePoListTableProps {
  items: ErpLitePoDashboardSnapshot['po_list']
  displayConfig: ErpLiteDisplayConfig
}

export function ErpLitePoListTable({ items, displayConfig }: ErpLitePoListTableProps) {
  const t = useTranslations('erpLite.po')

  const columns: ColumnDef<ErpLitePoDashboardSnapshot['po_list'][number]>[] = [
    { accessorKey: 'po_no', header: t('lists.po.columns.no'), cell: ({ row }) => <div className="font-medium">{row.original.po_no}</div> },
    { accessorKey: 'po_date', header: t('lists.po.columns.date') },
    { accessorKey: 'supplier_name', header: t('lists.po.columns.supplier') },
    { accessorKey: 'branch_name', header: t('lists.po.columns.branch'), cell: ({ row }) => row.original.branch_name ?? '—' },
    { accessorKey: 'status_code', header: t('lists.po.columns.status') },
    {
      id: 'total_amount',
      header: () => <div className="text-right">{t('lists.po.columns.amount')}</div>,
      cell: ({ row }) => (
        <div className="text-right">
          {formatErpLiteMoney(row.original.total_amount, {
            ...displayConfig,
            currencyCode: row.original.currency_code || displayConfig.currencyCode,
          })}
        </div>
      ),
    },
  ]

  return (
    <CmxDataTable
      columns={columns}
      data={items}
      page={0}
      pageSize={Math.max(items.length, 1)}
      total={items.length}
      emptyMessage={t('lists.po.empty')}
    />
  )
}
