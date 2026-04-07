'use client'

import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { ErpLiteUsageMapRow } from '@/lib/types/erp-lite-ops'
import { CmxDataTable } from '@ui/data-display'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives'

interface ErpLiteUsageMapsScreenProps {
  rows: ErpLiteUsageMapRow[]
}

function StatusBadge({ status }: { status: ErpLiteUsageMapRow['status_code'] }) {
  const palette: Record<string, string> = {
    ACTIVE: 'bg-green-500/10 text-green-700',
    DRAFT: 'bg-blue-500/10 text-blue-700',
    INACTIVE: 'bg-muted text-muted-foreground',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${palette[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      {status}
    </span>
  )
}

function IssueBadge({ issue }: { issue: ErpLiteUsageMapRow['mapping_issue'] }) {
  if (issue === 'OK') return null
  const palette: Record<string, string> = {
    MISSING: 'bg-red-500/10 text-red-700',
    ACCOUNT_INACTIVE: 'bg-amber-500/10 text-amber-700',
    ACCOUNT_NOT_POSTABLE: 'bg-amber-500/10 text-amber-700',
    TYPE_MISMATCH: 'bg-orange-500/10 text-orange-700',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${palette[issue] ?? 'bg-muted text-muted-foreground'}`}
    >
      {issue}
    </span>
  )
}

export function ErpLiteUsageMapsScreen({ rows }: ErpLiteUsageMapsScreenProps) {
  const t = useTranslations('erpLite.usageMaps')

  const columns: ColumnDef<ErpLiteUsageMapRow>[] = [
    {
      accessorKey: 'usage_code',
      header: t('columns.usageCode'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.usage_code}</div>
          <div className="text-xs text-muted-foreground">{row.original.usage_code_name}</div>
        </div>
      ),
    },
    {
      id: 'required',
      header: t('columns.required'),
      cell: ({ row }) =>
        row.original.is_required ? (
          <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs font-medium text-red-700">
            {t('required')}
          </span>
        ) : (
          <span className="text-xs text-muted-foreground">{t('optional')}</span>
        ),
    },
    {
      accessorKey: 'account_code',
      header: t('columns.account'),
      cell: ({ row }) => (
        <div>
          <div className="font-medium">{row.original.account_code}</div>
          <div className="text-xs text-muted-foreground">{row.original.account_name}</div>
        </div>
      ),
    },
    {
      accessorKey: 'acc_type_code',
      header: t('columns.accType'),
      cell: ({ row }) => row.original.acc_type_code ?? '—',
    },
    {
      accessorKey: 'required_acc_type_code',
      header: t('columns.requiredType'),
      cell: ({ row }) => row.original.required_acc_type_code ?? '—',
    },
    {
      accessorKey: 'status_code',
      header: t('columns.status'),
      cell: ({ row }) => <StatusBadge status={row.original.status_code} />,
    },
    {
      id: 'issue',
      header: t('columns.issue'),
      cell: ({ row }) => <IssueBadge issue={row.original.mapping_issue} />,
    },
    {
      accessorKey: 'effective_from',
      header: t('columns.effectiveFrom'),
      cell: ({ row }) => row.original.effective_from ?? '—',
    },
    {
      accessorKey: 'effective_to',
      header: t('columns.effectiveTo'),
      cell: ({ row }) => row.original.effective_to ?? '—',
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
