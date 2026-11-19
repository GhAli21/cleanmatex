'use client'

import { CmxSummaryMessage } from '@ui/feedback/cmx-summary-message'
import * as React from 'react'
import Link from 'next/link'
import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { ErpLiteUsageMapRow } from '@/lib/types/erp-lite-ops'
import { CmxDataTable } from '@ui/data-display'
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives'
interface ErpLiteUsageMapsScreenProps {
  rows: ErpLiteUsageMapRow[]
}

type FilterMode = 'all' | 'unresolved' | 'requiredIssues'

function StatusBadge({ status }: { status: ErpLiteUsageMapRow['status_code'] }) {
  const palette: Record<string, string> = {
    ACTIVE: 'bg-success/10 text-success-text',
    DRAFT: 'bg-primary/10 text-primary-text',
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
    MISSING: 'bg-destructive/10 text-danger-text',
    ACCOUNT_INACTIVE: 'bg-warning/10 text-warning-text',
    ACCOUNT_NOT_POSTABLE: 'bg-warning/10 text-warning-text',
    TYPE_MISMATCH: 'bg-warning/10 text-warning-text',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${palette[issue] ?? 'bg-muted text-muted-foreground'}`}
    >
      {issue}
    </span>
  )
}

/**
 *
 * @param root0
 * @param root0.rows
 */
export function ErpLiteUsageMapsScreen({ rows }: ErpLiteUsageMapsScreenProps) {
  const t = useTranslations('erpLite.usageMaps')
  const [mode, setMode] = React.useState<FilterMode>('all')

  const filtered = React.useMemo(() => {
    if (mode === 'unresolved') return rows.filter((r) => r.mapping_issue !== 'OK')
    if (mode === 'requiredIssues')
      return rows.filter((r) => r.is_required && r.mapping_issue !== 'OK')
    return rows
  }, [rows, mode])

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
          <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-danger-text">
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

      <CmxSummaryMessage type="info">
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <span>{t('banner')}</span>
          <span className="flex flex-wrap gap-3 text-sm">
            <Link href="/dashboard/erp-lite" className="font-medium text-primary-text hover:underline">
              {t('linkHome')}
            </Link>
            <Link href="/dashboard/erp-lite/readiness" className="font-medium text-primary-text hover:underline">
              {t('linkReadiness')}
            </Link>
          </span>
        </div>
      </CmxSummaryMessage>

      <div className="flex flex-wrap gap-2">
        <CmxButton
          type="button"
          size="sm"
          variant={mode === 'all' ? 'primary' : 'outline'}
          onClick={() => setMode('all')}
        >
          {t('filters.showAll')}
        </CmxButton>
        <CmxButton
          type="button"
          size="sm"
          variant={mode === 'unresolved' ? 'primary' : 'outline'}
          onClick={() => setMode('unresolved')}
        >
          {t('filters.unresolvedOnly')}
        </CmxButton>
        <CmxButton
          type="button"
          size="sm"
          variant={mode === 'requiredIssues' ? 'primary' : 'outline'}
          onClick={() => setMode('requiredIssues')}
        >
          {t('filters.requiredIssues')}
        </CmxButton>
      </div>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('table.title', { count: filtered.length })}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          <CmxDataTable
            columns={columns}
            data={filtered}
            page={0}
            pageSize={Math.max(filtered.length, 1)}
            total={filtered.length}
            emptyMessage={t('empty')}
          />
        </CmxCardContent>
      </CmxCard>
    </div>
  )
}
