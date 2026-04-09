'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import type { ColumnDef } from '@tanstack/react-table'
import type { ErpLitePeriodRow, PeriodClosePrecheckResult } from '@/lib/types/erp-lite-ops'
import {
  closePeriodFromUiAction,
  precheckPeriodCloseForAction,
} from '@/app/actions/erp-lite/ops-actions'
import { CmxDataTable } from '@ui/data-display'
import { CmxButton } from '@ui/primitives/cmx-button'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives'
import { CmxAlertDialog, cmxMessage } from '@ui/feedback'

interface ErpLitePeriodsScreenProps {
  rows: ErpLitePeriodRow[]
}

function PeriodStatusBadge({ status }: { status: ErpLitePeriodRow['status_code'] }) {
  const palette: Record<string, string> = {
    OPEN: 'bg-green-500/10 text-green-700',
    SOFT_LOCKED: 'bg-amber-500/10 text-amber-700',
    CLOSED: 'bg-muted text-muted-foreground',
  }
  return (
    <span
      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${palette[status] ?? 'bg-muted text-muted-foreground'}`}
    >
      {status}
    </span>
  )
}

export function ErpLitePeriodsScreen({ rows }: ErpLitePeriodsScreenProps) {
  const t = useTranslations('erpLite.periods')
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = React.useState(false)
  const [closeTarget, setCloseTarget] = React.useState<ErpLitePeriodRow | null>(null)
  const [precheckResult, setPrecheckResult] = React.useState<PeriodClosePrecheckResult | null>(null)
  const [busy, setBusy] = React.useState(false)

  const resetDialog = () => {
    setDialogOpen(false)
    setCloseTarget(null)
    setPrecheckResult(null)
  }

  const openCloseFlow = async (row: ErpLitePeriodRow) => {
    setBusy(true)
    try {
      const res = await precheckPeriodCloseForAction(row.id)
      if (!res.ok) {
        cmxMessage.error(res.message)
        return
      }
      setCloseTarget(row)
      setPrecheckResult(res.data)
      setDialogOpen(true)
      if (!res.data.canClose) {
        cmxMessage.error(t('precheck.blocked'))
      }
    } catch (e) {
      cmxMessage.error(e instanceof Error ? e.message : t('precheck.error'))
    } finally {
      setBusy(false)
    }
  }

  const handleConfirmClose = () => {
    if (!precheckResult?.canClose || !closeTarget) {
      resetDialog()
      return
    }
    setBusy(true)
    void (async () => {
      try {
        const res = await closePeriodFromUiAction(closeTarget.id, null)
        if (!res.ok) {
          cmxMessage.error(res.message)
          return
        }
        cmxMessage.success(t('close.success'))
        resetDialog()
        router.refresh()
      } catch (e) {
        cmxMessage.error(e instanceof Error ? e.message : t('close.error'))
      } finally {
        setBusy(false)
      }
    })()
  }

  const blockerMessage = precheckResult ? (
    <div className="space-y-2">
      <p>{t('close.confirmBody')}</p>
      {precheckResult.blockers.length > 0 ? (
        <ul className="list-inside list-disc space-y-1 text-xs">
          {precheckResult.blockers.map((b, i) => (
            <li key={i}>
              <span
                className={
                  b.severity === 'error' ? 'text-destructive' : 'text-amber-700 dark:text-amber-400'
                }
              >
                {b.message}
              </span>
              {b.href ? (
                <>
                  {' '}
                  <Link href={b.href} className="text-primary underline-offset-2 hover:underline">
                    {t('close.openLink')}
                  </Link>
                </>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  ) : null

  const columns: ColumnDef<ErpLitePeriodRow>[] = [
    {
      accessorKey: 'period_code',
      header: t('columns.code'),
      cell: ({ row }) => <div className="font-medium">{row.original.period_code}</div>,
    },
    {
      accessorKey: 'name',
      header: t('columns.name'),
    },
    {
      accessorKey: 'start_date',
      header: t('columns.startDate'),
    },
    {
      accessorKey: 'end_date',
      header: t('columns.endDate'),
    },
    {
      accessorKey: 'status_code',
      header: t('columns.status'),
      cell: ({ row }) => <PeriodStatusBadge status={row.original.status_code} />,
    },
    {
      accessorKey: 'closed_at',
      header: t('columns.closedAt'),
      cell: ({ row }) =>
        row.original.closed_at ? new Date(row.original.closed_at).toLocaleDateString() : '—',
    },
    {
      accessorKey: 'closed_by',
      header: t('columns.closedBy'),
      cell: ({ row }) => row.original.closed_by ?? '—',
    },
    {
      id: 'actions',
      header: t('columns.actions'),
      cell: ({ row }) =>
        row.original.status_code === 'OPEN' ? (
          <CmxButton
            type="button"
            variant="outline"
            size="sm"
            disabled={busy}
            onClick={() => void openCloseFlow(row.original)}
          >
            {t('close.action')}
          </CmxButton>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        ),
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

      <CmxAlertDialog
        open={dialogOpen}
        variant={precheckResult && !precheckResult.canClose ? 'destructive' : 'warning'}
        title={
          closeTarget ? t('close.confirmTitle', { code: closeTarget.period_code }) : t('close.dialogTitle')
        }
        message={blockerMessage}
        confirmLabel={
          precheckResult?.canClose ? t('close.confirm') : t('close.acknowledge')
        }
        cancelLabel={t('close.cancel')}
        showCancel={Boolean(precheckResult?.canClose)}
        onCancel={resetDialog}
        onConfirm={handleConfirmClose}
      />
    </div>
  )
}
