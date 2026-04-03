'use client'

import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { ErpLitePhase10DashboardSnapshot } from '@/lib/types/erp-lite-phase10'
import { formatErpLiteMoney, type ErpLiteDisplayConfig } from '@features/erp-lite/lib/display-format'
import { CmxDataTable } from '@ui/data-display'

interface ErpLiteBranchPlProfitabilityTableProps {
  rows: ErpLitePhase10DashboardSnapshot['profitability_rows']
  displayConfig: ErpLiteDisplayConfig
}

export function ErpLiteBranchPlProfitabilityTable({
  rows,
  displayConfig,
}: ErpLiteBranchPlProfitabilityTableProps) {
  const t = useTranslations('erpLite.branchPl')

  const columns: ColumnDef<ErpLitePhase10DashboardSnapshot['profitability_rows'][number]>[] = [
    { accessorKey: 'branch_name', header: t('list.columns.branch'), cell: ({ row }) => <div className="font-medium">{row.original.branch_name}</div> },
    { id: 'direct_revenue', header: () => <div className="text-right">{t('list.columns.revenue')}</div>, cell: ({ row }) => <div className="text-right">{formatErpLiteMoney(row.original.direct_revenue, displayConfig)}</div> },
    { id: 'direct_expense', header: () => <div className="text-right">{t('list.columns.expense')}</div>, cell: ({ row }) => <div className="text-right">{formatErpLiteMoney(row.original.direct_expense, displayConfig)}</div> },
    { id: 'direct_profit', header: () => <div className="text-right">{t('list.columns.directProfit')}</div>, cell: ({ row }) => <div className="text-right">{formatErpLiteMoney(row.original.direct_profit, displayConfig)}</div> },
    { id: 'allocated_in', header: () => <div className="text-right">{t('list.columns.allocatedIn')}</div>, cell: ({ row }) => <div className="text-right">{formatErpLiteMoney(row.original.allocated_in, displayConfig)}</div> },
    { id: 'allocated_out', header: () => <div className="text-right">{t('list.columns.allocatedOut')}</div>, cell: ({ row }) => <div className="text-right">{formatErpLiteMoney(row.original.allocated_out, displayConfig)}</div> },
    { id: 'allocated_profit', header: () => <div className="text-right">{t('list.columns.finalProfit')}</div>, cell: ({ row }) => <div className="text-right">{formatErpLiteMoney(row.original.allocated_profit, displayConfig)}</div> },
  ]

  return (
    <CmxDataTable
      columns={columns}
      data={rows}
      page={0}
      pageSize={Math.max(rows.length, 1)}
      total={rows.length}
      emptyMessage={t('list.empty')}
    />
  )
}
