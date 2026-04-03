'use client'

import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { ErpLitePhase10DashboardSnapshot } from '@/lib/types/erp-lite-phase10'
import { formatErpLiteMoney, type ErpLiteDisplayConfig } from '@features/erp-lite/lib/display-format'
import { CmxDataTable } from '@ui/data-display'

interface ErpLiteBranchPlCostSummaryTableProps {
  rows: ErpLitePhase10DashboardSnapshot['cost_summary_rows']
  displayConfig: ErpLiteDisplayConfig
}

export function ErpLiteBranchPlCostSummaryTable({
  rows,
  displayConfig,
}: ErpLiteBranchPlCostSummaryTableProps) {
  const t = useTranslations('erpLite.branchPl')

  const columns: ColumnDef<ErpLitePhase10DashboardSnapshot['cost_summary_rows'][number]>[] = [
    { accessorKey: 'branch_name', header: t('lists.costSummary.columns.branch') },
    { id: 'total_cost', header: () => <div className="text-right">{t('lists.costSummary.columns.totalCost')}</div>, cell: ({ row }) => <div className="text-right">{formatErpLiteMoney(row.original.total_cost, displayConfig)}</div> },
  ]

  return (
    <CmxDataTable
      columns={columns}
      data={rows}
      page={0}
      pageSize={Math.max(rows.length, 1)}
      total={rows.length}
      emptyMessage={t('lists.costSummary.empty')}
    />
  )
}
