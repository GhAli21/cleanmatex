'use client'

import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { ErpLitePostActionAuditRow } from '@/lib/types/erp-lite-ops'
import { CmxDataTable } from '@ui/data-display'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives'

interface ErpLiteFinanceActionsAuditScreenProps {
  rows: ErpLitePostActionAuditRow[]
}

export function ErpLiteFinanceActionsAuditScreen({ rows }: ErpLiteFinanceActionsAuditScreenProps) {
  const t = useTranslations('erpLite.financeActions')

  const columns: ColumnDef<ErpLitePostActionAuditRow>[] = [
    {
      accessorKey: 'created_at',
      header: t('columns.when'),
      cell: ({ row }) => new Date(row.original.created_at).toLocaleString(),
    },
    {
      accessorKey: 'action_domain',
      header: t('columns.domain'),
    },
    {
      accessorKey: 'action_code',
      header: t('columns.action'),
    },
    {
      accessorKey: 'result_code',
      header: t('columns.result'),
    },
    {
      accessorKey: 'prev_status_code',
      header: t('columns.prev'),
      cell: ({ row }) => row.original.prev_status_code ?? '—',
    },
    {
      accessorKey: 'new_status_code',
      header: t('columns.next'),
      cell: ({ row }) => row.original.new_status_code ?? '—',
    },
    {
      accessorKey: 'action_notes',
      header: t('columns.notes'),
      cell: ({ row }) => (
        <div className="max-w-xs truncate text-xs text-muted-foreground" title={row.original.action_notes ?? ''}>
          {row.original.action_notes ?? '—'}
        </div>
      ),
    },
  ]

  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">ERP-Lite</p>
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
