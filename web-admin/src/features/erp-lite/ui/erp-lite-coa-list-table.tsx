'use client'

import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { ErpLiteCoaDashboardSnapshot } from '@/lib/types/erp-lite-coa'
import { CmxDataTable } from '@ui/data-display'

interface ErpLiteCoaListTableProps {
  items: ErpLiteCoaDashboardSnapshot['account_list']
}

export function ErpLiteCoaListTable({ items }: ErpLiteCoaListTableProps) {
  const t = useTranslations('erpLite.coa')

  const columns: ColumnDef<ErpLiteCoaDashboardSnapshot['account_list'][number]>[] = [
    { accessorKey: 'account_code', header: t('lists.accounts.columns.code'), cell: ({ row }) => <div className="font-medium">{row.original.account_code}</div> },
    { accessorKey: 'account_name', header: t('lists.accounts.columns.name') },
    { accessorKey: 'account_type_name', header: t('lists.accounts.columns.type') },
    { accessorKey: 'account_group_name', header: t('lists.accounts.columns.group'), cell: ({ row }) => row.original.account_group_name ?? '—' },
    { accessorKey: 'parent_account_name', header: t('lists.accounts.columns.parent'), cell: ({ row }) => row.original.parent_account_name ?? '—' },
    { accessorKey: 'branch_name', header: t('lists.accounts.columns.branch'), cell: ({ row }) => row.original.branch_name ?? '—' },
    {
      id: 'flags',
      header: t('lists.accounts.columns.flags'),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <span className="rounded-full bg-muted px-2 py-1 text-xs">
            {row.original.is_postable ? t('flags.postable') : t('flags.headerOnly')}
          </span>
          {row.original.is_control_account ? (
            <span className="rounded-full bg-muted px-2 py-1 text-xs">{t('flags.control')}</span>
          ) : null}
          {row.original.is_system_linked ? (
            <span className="rounded-full bg-muted px-2 py-1 text-xs">{t('flags.system')}</span>
          ) : null}
          {!row.original.manual_post_allowed ? (
            <span className="rounded-full bg-muted px-2 py-1 text-xs">{t('flags.manualLocked')}</span>
          ) : null}
          {!row.original.is_active ? (
            <span className="rounded-full bg-muted px-2 py-1 text-xs">{t('flags.inactive')}</span>
          ) : null}
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
      emptyMessage={t('lists.accounts.empty')}
    />
  )
}
