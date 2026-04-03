'use client'

import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { ErpLiteExpensesDashboardSnapshot } from '@/lib/types/erp-lite-expenses'
import { formatErpLiteMoney, type ErpLiteDisplayConfig } from '@features/erp-lite/lib/display-format'
import { CmxDataTable } from '@ui/data-display'

interface ErpLiteExpensesTableProps {
  items: ErpLiteExpensesDashboardSnapshot['expense_list']
  displayConfig: ErpLiteDisplayConfig
}

export function ErpLiteExpensesTable({ items, displayConfig }: ErpLiteExpensesTableProps) {
  const t = useTranslations('erpLite.expenses')

  const columns: ColumnDef<ErpLiteExpensesDashboardSnapshot['expense_list'][number]>[] = [
    { accessorKey: 'expense_no', header: t('lists.expenses.columns.no'), cell: ({ row }) => <div className="font-medium">{row.original.expense_no}</div> },
    { accessorKey: 'expense_date', header: t('lists.expenses.columns.date') },
    { accessorKey: 'payee_name', header: t('lists.expenses.columns.payee'), cell: ({ row }) => row.original.payee_name ?? '—' },
    { accessorKey: 'branch_name', header: t('lists.expenses.columns.branch'), cell: ({ row }) => row.original.branch_name ?? '—' },
    { id: 'settlement_code', header: t('lists.expenses.columns.settlement'), cell: ({ row }) => t(`settlement.${row.original.settlement_code.toLowerCase()}`) },
    {
      id: 'total_amount',
      header: () => <div className="text-right">{t('lists.expenses.columns.amount')}</div>,
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
      emptyMessage={t('lists.expenses.empty')}
    />
  )
}
