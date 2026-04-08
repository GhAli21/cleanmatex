'use client'

import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { ErpLiteCoaAccountListItem } from '@/lib/types/erp-lite-coa'
import { CmxDataTable } from '@ui/data-display'
import { Badge } from '@ui/primitives'

interface ErpLiteCoaListTableProps {
  items: ErpLiteCoaAccountListItem[]
  total: number
  page: number
  pageSize: number
}

export function ErpLiteCoaListTable({ items, total, page, pageSize }: ErpLiteCoaListTableProps) {
  const t = useTranslations('erpLite.coa')

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)

  const columns: ColumnDef<ErpLiteCoaAccountListItem>[] = [
    {
      accessorKey: 'account_code',
      header: t('lists.accounts.columns.code'),
      cell: ({ row }) => (
        <div className="space-y-1">
          <div className="font-medium">{row.original.account_code}</div>
          <div className="text-xs text-muted-foreground">
            {t('lists.accounts.levelLabel', { level: row.original.account_level })}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'account_name',
      header: t('lists.accounts.columns.name'),
      cell: ({ row }) => (
        <div
          className="space-y-1"
          style={{ paddingInlineStart: `${Math.max(row.original.account_level - 1, 0) * 1.25}rem` }}
        >
          <div className="font-medium">{row.original.account_name}</div>
          {row.original.parent_account_name ? (
            <div className="text-xs text-muted-foreground">
              {row.original.parent_account_code
                ? `${row.original.parent_account_code} · ${row.original.parent_account_name}`
                : row.original.parent_account_name}
            </div>
          ) : null}
        </div>
      ),
    },
    { accessorKey: 'account_type_name', header: t('lists.accounts.columns.type') },
    { accessorKey: 'account_group_name', header: t('lists.accounts.columns.group'), cell: ({ row }) => row.original.account_group_name ?? '—' },
    { accessorKey: 'parent_account_name', header: t('lists.accounts.columns.parent'), cell: ({ row }) => row.original.parent_account_name ?? '—' },
    { accessorKey: 'branch_name', header: t('lists.accounts.columns.branch'), cell: ({ row }) => row.original.branch_name ?? '—' },
    {
      id: 'flags',
      header: t('lists.accounts.columns.flags'),
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          <Badge variant="secondary">
            {row.original.is_postable ? t('flags.postable') : t('flags.headerOnly')}
          </Badge>
          {row.original.is_control_account ? (
            <Badge variant="secondary">{t('flags.control')}</Badge>
          ) : null}
          {row.original.is_system_linked ? (
            <Badge variant="secondary">{t('flags.system')}</Badge>
          ) : null}
          {row.original.is_system_seeded ? (
            <Badge variant="secondary">{t('flags.seeded')}</Badge>
          ) : null}
          {row.original.is_locked ? (
            <Badge variant="secondary">{t('flags.locked')}</Badge>
          ) : null}
          {row.original.allow_tenant_children ? (
            <Badge variant="secondary">{t('flags.tenantChildren')}</Badge>
          ) : null}
          {!row.original.manual_post_allowed ? (
            <Badge variant="secondary">{t('flags.manualLocked')}</Badge>
          ) : null}
          {!row.original.is_active ? (
            <Badge variant="secondary">{t('flags.inactive')}</Badge>
          ) : null}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-2">
      {total > 0 ? (
        <p className="text-xs text-muted-foreground">
          {t('lists.accounts.pagination.showing', { from, to, total })}
        </p>
      ) : null}
      <CmxDataTable
        columns={columns}
        data={items}
        page={page - 1}
        pageSize={pageSize}
        total={total}
        emptyMessage={t('lists.accounts.empty')}
      />
    </div>
  )
}
