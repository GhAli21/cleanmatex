'use client'

import { useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslations } from 'next-intl'
import { CmxButton, CmxInput, CmxTextarea } from '@ui/primitives'
import { CmxDataTable } from '@ui/data-display'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import { CmxConfirmDialog, CmxStatusBadge, cmxMessage } from '@ui/feedback'
import { taxApi } from '../api/tax-api'
import { useTaxMutation, useTaxPeriods } from '../hooks/use-tax'
import type { TaxPeriodRow } from '../model/tax-types'

function AddPeriodDialog({ onClose }: { onClose: () => void }) {
  const t = useTranslations('taxSetup.engine.periods')
  const tCommon = useTranslations('common')
  const [periodStart, setStart] = useState('')
  const [periodEnd, setEnd] = useState('')
  const save = useTaxMutation(taxApi.createPeriod, () => {
    cmxMessage.success(t('added'))
    onClose()
  })
  const valid = !!periodStart && !!periodEnd && periodEnd >= periodStart
  return (
    <CmxDialog open onOpenChange={(open) => { if (!open && !save.isPending) onClose() }}>
      <CmxDialogContent className="sm:max-w-[420px]">
        <CmxDialogHeader><CmxDialogTitle>{t('addTitle')}</CmxDialogTitle></CmxDialogHeader>
        <div className="space-y-3">
          <CmxInput type="date" label={t('start')} value={periodStart} onChange={(e) => setStart(e.target.value)} />
          <CmxInput
            type="date"
            label={t('end')}
            value={periodEnd}
            min={periodStart || undefined}
            onChange={(e) => setEnd(e.target.value)}
            error={periodStart && periodEnd && periodEnd < periodStart ? t('endBeforeStart') : undefined}
          />
          <p className="text-xs text-muted-foreground">{t('addHelp')}</p>
        </div>
        <CmxDialogFooter>
          <CmxButton variant="outline" onClick={onClose} disabled={save.isPending}>{tCommon('cancel')}</CmxButton>
          <CmxButton onClick={() => save.mutate({ periodStart, periodEnd })} disabled={!valid || save.isPending}>{tCommon('save')}</CmxButton>
        </CmxDialogFooter>
      </CmxDialogContent>
    </CmxDialog>
  )
}

/** Tax return periods: closing one stops new final tax lines dated inside it; reopening needs a reason. */
export function TaxPeriodsTab({ canManage }: { canManage: boolean }) {
  const t = useTranslations('taxSetup.engine.periods')
  const [adding, setAdding] = useState(false)
  const [closing, setClosing] = useState<TaxPeriodRow | null>(null)
  const [reopening, setReopening] = useState<TaxPeriodRow | null>(null)
  const [reason, setReason] = useState('')
  const { data = [], isLoading, isError } = useTaxPeriods()
  const change = useTaxMutation(
    (v: { id: string; body: { action: 'close' } | { action: 'reopen'; reason: string } }) => taxApi.changePeriod(v.id, v.body),
    (p) => {
      cmxMessage.success(p.status === 'CLOSED' ? t('closed') : t('reopened'))
      setClosing(null)
      setReopening(null)
      setReason('')
    },
  )

  const columns: ColumnDef<TaxPeriodRow, unknown>[] = [
    { id: 'start', header: t('start'), cell: ({ row }) => <span dir="ltr">{row.original.periodStart}</span> },
    { id: 'end', header: t('end'), cell: ({ row }) => <span dir="ltr">{row.original.periodEnd}</span> },
    {
      id: 'status',
      header: t('status'),
      cell: ({ row }) => (
        <CmxStatusBadge size="sm" variant={row.original.status === 'CLOSED' ? 'warning' : 'success'} label={t(`statuses.${row.original.status}`)} />
      ),
    },
    { id: 'reason', header: t('reopenReason'), cell: ({ row }) => row.original.reopenReason ?? '—' },
    ...(canManage
      ? ([
          {
            id: 'actions',
            header: t('actions'),
            cell: ({ row }) =>
              row.original.status === 'OPEN' ? (
                <CmxButton size="sm" variant="ghost" onClick={() => setClosing(row.original)}>{t('close')}</CmxButton>
              ) : (
                <CmxButton size="sm" variant="ghost" onClick={() => setReopening(row.original)}>{t('reopen')}</CmxButton>
              ),
          },
        ] satisfies ColumnDef<TaxPeriodRow, unknown>[])
      : []),
  ]

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{t('description')}</p>
        {canManage && <CmxButton onClick={() => setAdding(true)}>{t('add')}</CmxButton>}
      </div>
      {isError && <p className="text-sm text-destructive">{t('loadError')}</p>}
      <CmxDataTable columns={columns} data={data} loading={isLoading} page={0} pageSize={Math.max(data.length, 1)} total={data.length} showPageSizeSelector={false} emptyStateTitle={t('empty')} />
      {adding && <AddPeriodDialog onClose={() => setAdding(false)} />}
      {closing && (
        <CmxConfirmDialog
          open
          title={t('closeTitle', { start: closing.periodStart, end: closing.periodEnd })}
          description={t('closeHelp')}
          confirmLabel={t('close')}
          confirmDisabled={change.isPending}
          onCancel={() => setClosing(null)}
          onConfirm={() => change.mutate({ id: closing.id, body: { action: 'close' } })}
        />
      )}
      {reopening && (
        <CmxConfirmDialog
          open
          title={t('reopenTitle', { start: reopening.periodStart, end: reopening.periodEnd })}
          description={t('reopenHelp')}
          confirmLabel={t('reopen')}
          confirmDisabled={change.isPending || reason.trim().length < 3}
          onCancel={() => { setReopening(null); setReason('') }}
          onConfirm={() => change.mutate({ id: reopening.id, body: { action: 'reopen', reason: reason.trim() } })}
        >
          <CmxTextarea aria-label={t('reopenReason')} placeholder={t('reopenReason')} value={reason} maxLength={500} onChange={(e) => setReason(e.target.value)} />
        </CmxConfirmDialog>
      )}
    </div>
  )
}
