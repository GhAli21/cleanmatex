'use client'

import { useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'
import { Truck } from 'lucide-react'

import {
  fetchTransits,
  postCancelTransit,
  postReceiveTransit,
  transitListKey,
  type TransitEntry,
  type TransitStatus,
  type TransitStatusFilter,
} from '@features/cash-drawers/api/cash-transit-api'
import { useCashDrawerErrorMessage } from '@features/cash-drawers/hooks/use-cash-drawer-error-message'
import {
  useCashDrawerDateFormatter,
  useCashDrawerMoneyFormatter,
} from '@features/cash-drawers/ui/cash-drawer-ui-parts'
import { CashTransitSendDialog } from '@features/cash-drawers/ui/cash-transit-send-dialog'
import { useCSRFToken } from '@lib/hooks/use-csrf-token'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { cmxMessage, CmxStatusBadge } from '@ui/feedback'
import { CmxDataTable } from '@ui/data-display'
import { CmxButton, CmxSelect, CmxTextarea, Label } from '@ui/primitives'
import { CmxDialog, CmxDialogContent, CmxDialogFooter, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'

const PAGE_SIZE = 20
const FILTERS: TransitStatusFilter[] = ['IN_TRANSIT', 'RECEIVED', 'CANCELLED', 'ALL']

const statusVariant = (status: TransitStatus): 'warning' | 'success' | 'outline' =>
  status === 'IN_TRANSIT' ? 'warning' : status === 'RECEIVED' ? 'success' : 'outline'

type Pending = { row: TransitEntry; action: 'receive' | 'cancel' }

/**
 * Cash in transit (D1-4): cash that left one drawer and has not reached its destination. Send opens a
 * transfer; the destination's user receives it, or it is cancelled back to the source with a reason.
 * Each transfer settles exactly once. Actions follow permissions: sending and cancelling need
 * `cash_drawer:transfer`, receiving needs `cash_drawer:receive_transfer`; the sender may receive
 * their own transfer.
 */
export function CashTransitScreen() {
  const t = useTranslations('billing.cashDrawers.transit')
  const tCommon = useTranslations('common')
  const errorMessage = useCashDrawerErrorMessage()
  const money = useCashDrawerMoneyFormatter()
  const fmtDateTime = useCashDrawerDateFormatter()
  const queryClient = useQueryClient()
  const { token: csrfToken } = useCSRFToken()
  const canTransfer = useHasPermissionCode('cash_drawer:transfer')
  const canReceive = useHasPermissionCode('cash_drawer:receive_transfer')

  const [page, setPage] = useState(1)
  const [status, setStatus] = useState<TransitStatusFilter>('IN_TRANSIT')
  const [sendOpen, setSendOpen] = useState(false)
  const [pending, setPending] = useState<Pending | null>(null)
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)

  const listQuery = useQuery({
    queryKey: transitListKey(status, page),
    queryFn: () => fetchTransits({ status, page, pageSize: PAGE_SIZE }),
    placeholderData: keepPreviousData,
  })

  const refresh = () => queryClient.invalidateQueries({ queryKey: ['cash-drawers'] })

  const close = () => {
    setPending(null)
    setReason('')
  }

  const confirm = async () => {
    if (!pending) return
    if (pending.action === 'cancel' && !reason.trim()) return
    setBusy(true)
    try {
      if (pending.action === 'receive') {
        await postReceiveTransit({ transitId: pending.row.id, csrfToken })
        cmxMessage.success(t('received', { no: pending.row.transitNo }))
      } else {
        await postCancelTransit({ transitId: pending.row.id, reason: reason.trim(), csrfToken })
        cmxMessage.success(t('cancelled', { no: pending.row.transitNo }))
      }
      close()
      await refresh()
    } catch (error) {
      cmxMessage.error(errorMessage(error, pending.action === 'receive' ? t('receiveFailed') : t('cancelFailed')))
      // The transfer may have been settled by someone else meanwhile — show the current state.
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  const rows = listQuery.data?.rows ?? []

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <h1 className="flex items-center gap-2 text-3xl font-bold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
            <Truck className="h-7 w-7" aria-hidden />
            {t('title')}
          </h1>
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('description')}</p>
        </div>
        {canTransfer ? <CmxButton onClick={() => setSendOpen(true)}>{t('sendCash')}</CmxButton> : null}
      </div>

      <div className="max-w-xs">
        <CmxSelect
          label={t('filterStatus')}
          value={status}
          onChange={(event) => {
            setStatus(event.target.value as TransitStatusFilter)
            setPage(1)
          }}
          options={FILTERS.map((value) => ({ value, label: t(`statuses.${value}`) }))}
        />
      </div>

      {listQuery.isError ? (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-lg border border-destructive/40 p-4 text-sm">
          <span>{t('loadFailed')}</span>
          <CmxButton size="sm" variant="outline" onClick={() => listQuery.refetch()}>
            {tCommon('retry')}
          </CmxButton>
        </div>
      ) : (
        <CmxDataTable
          columns={[
            {
              key: 'transitNo',
              header: t('columns.no'),
              render: (r: TransitEntry) => <span className="font-mono text-xs font-semibold">{r.transitNo}</span>,
            },
            { key: 'branch', header: t('columns.branch'), render: (r: TransitEntry) => r.branchName ?? '—' },
            {
              key: 'route',
              header: t('columns.route'),
              render: (r: TransitEntry) => (
                <span>
                  {r.sourceDrawerName ?? '—'} <span aria-hidden>→</span> {r.destDrawerName ?? '—'}
                </span>
              ),
            },
            {
              key: 'amount',
              header: t('columns.amount'),
              align: 'right' as const,
              render: (r: TransitEntry) => <span className="font-semibold tabular-nums">{money(r.amount, r.currencyCode)}</span>,
            },
            {
              key: 'sent',
              header: t('columns.sent'),
              render: (r: TransitEntry) => (
                <div>
                  <div>{r.sentByName ?? '—'}</div>
                  <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{fmtDateTime(r.sentAt)}</div>
                </div>
              ),
            },
            {
              key: 'status',
              header: t('columns.status'),
              render: (r: TransitEntry) => (
                <CmxStatusBadge label={t(`statuses.${r.status}`)} variant={statusVariant(r.status)} size="sm" />
              ),
            },
            {
              key: 'settled',
              header: t('columns.settled'),
              render: (r: TransitEntry) =>
                r.status === 'IN_TRANSIT' ? (
                  '—'
                ) : (
                  <div>
                    <div>
                      {r.settledByName ?? '—'} · {fmtDateTime(r.settledAt)}
                    </div>
                    {r.cancelReason ? <div className="text-xs italic">{r.cancelReason}</div> : null}
                  </div>
                ),
            },
            {
              key: 'actions',
              header: tCommon('actions'),
              sortable: false,
              align: 'right' as const,
              render: (r: TransitEntry) =>
                r.status === 'IN_TRANSIT' ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    {canTransfer ? (
                      <CmxButton size="sm" variant="outline" onClick={() => setPending({ row: r, action: 'cancel' })}>
                        {t('cancel')}
                      </CmxButton>
                    ) : null}
                    {canReceive ? (
                      <CmxButton size="sm" onClick={() => setPending({ row: r, action: 'receive' })}>
                        {t('receive')}
                      </CmxButton>
                    ) : null}
                  </div>
                ) : null,
            },
          ]}
          data={rows}
          loading={listQuery.isLoading}
          currentPage={page}
          pageSize={PAGE_SIZE}
          totalCount={listQuery.data?.totalCount ?? 0}
          onPageChange={setPage}
          showPageSizeSelector={false}
          emptyStateTitle={t('emptyTitle')}
          emptyStateDescription={t('emptyDescription')}
        />
      )}

      <CashTransitSendDialog open={sendOpen} onOpenChange={setSendOpen} onSent={() => void refresh()} />

      <CmxDialog open={pending !== null} onOpenChange={(next) => { if (!next) close() }}>
        <CmxDialogContent className="max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>
              {pending?.action === 'cancel' ? t('cancelTitle') : t('receiveTitle')} — {pending?.row.transitNo}
            </CmxDialogTitle>
          </CmxDialogHeader>
          {pending ? (
            <div className="space-y-4">
              <p className="text-sm">
                {pending.action === 'cancel'
                  ? t('cancelBody', {
                      amount: money(pending.row.amount, pending.row.currencyCode),
                      drawer: pending.row.sourceDrawerName ?? '—',
                    })
                  : t('receiveBody', {
                      amount: money(pending.row.amount, pending.row.currencyCode),
                      drawer: pending.row.destDrawerName ?? '—',
                    })}
              </p>
              {pending.action === 'cancel' ? (
                <div className="space-y-2">
                  <Label>{t('reason')}</Label>
                  <CmxTextarea value={reason} onChange={(event) => setReason(event.target.value)} />
                </div>
              ) : null}
            </div>
          ) : null}
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={close} disabled={busy}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton
              variant={pending?.action === 'cancel' ? 'destructive' : 'primary'}
              loading={busy}
              disabled={pending?.action === 'cancel' && !reason.trim()}
              onClick={confirm}
            >
              {pending?.action === 'cancel' ? t('confirmCancel') : t('confirmReceive')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  )
}
