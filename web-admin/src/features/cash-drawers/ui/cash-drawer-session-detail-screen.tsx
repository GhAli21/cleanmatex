'use client'

import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'
import { ArrowLeft, Printer, ReceiptText, ShieldAlert, ShieldCheck, WalletCards } from 'lucide-react'
import { useTranslations } from 'next-intl'

import {
  CashDrawerInfoTile,
  CashDrawerMovementBadge,
  CashDrawerStatusBadge,
  CashDrawerTypeBadge,
  useCashDrawerDateFormatter,
  useCashDrawerMoneyFormatter,
} from '@features/cash-drawers/ui/cash-drawer-ui-parts'
import { CashDrawerVarianceApprovalDialog } from '@features/cash-drawers/ui/cash-drawer-variance-approval-dialog'
import type { CashDrawerSessionDetail } from '@lib/types/cash-drawer'
import { CmxDataTable } from '@ui/data-display'
import { CmxButton } from '@ui/primitives'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'

/**
 * Canonical session truth screen.
 *
 * Why:
 * session reconciliation is the most audit-sensitive cash-drawer surface, so
 * this route keeps lifecycle, totals, movements, and linked payments together
 * behind one stable contract.
 */
export function CashDrawerSessionDetailScreen({
  drawerId,
  sessionId,
  detail,
}: {
  drawerId: string
  sessionId: string
  detail: CashDrawerSessionDetail
}) {
  const t = useTranslations('billing.cashDrawers')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const searchParams = useSearchParams()
  const [, startTransition] = useTransition()

  const money = useCashDrawerMoneyFormatter()
  const fmtDateTime = useCashDrawerDateFormatter()
  const canApproveVariance = useHasPermissionCode('cash_drawer:approve_variance')
  const [approvalDialogOpen, setApprovalDialogOpen] = useState(false)

  const varianceApproval = detail.session.varianceApproval

  const replaceSearchParams = (mutator: (params: URLSearchParams) => void) => {
    const nextParams = new URLSearchParams(searchParams.toString())
    mutator(nextParams)
    const query = nextParams.toString()

    startTransition(() => {
      router.replace(query ? `?${query}` : '?')
    })
  }

  const movementColumns = [
    {
      key: 'performedAt',
      header: t('performedAt'),
      render: (row: CashDrawerSessionDetail['movements']['items'][number]) => fmtDateTime(row.performedAt),
    },
    {
      key: 'movementType',
      header: t('movementType'),
      render: (row: CashDrawerSessionDetail['movements']['items'][number]) => (
        <CashDrawerMovementBadge movement={row} />
      ),
    },
    {
      key: 'direction',
      header: t('direction'),
      render: (row: CashDrawerSessionDetail['movements']['items'][number]) => row.direction,
    },
    {
      key: 'amount',
      header: t('amount'),
      render: (row: CashDrawerSessionDetail['movements']['items'][number]) => money(row.amount, row.currencyCode),
      align: 'right' as const,
    },
    {
      key: 'reason',
      header: t('reason'),
      render: (row: CashDrawerSessionDetail['movements']['items'][number]) => row.reason ?? '—',
    },
    {
      key: 'referenceNo',
      header: t('referenceNo'),
      render: (row: CashDrawerSessionDetail['movements']['items'][number]) => row.referenceNo ?? '—',
    },
    {
      key: 'orderId',
      header: t('orderId'),
      render: (row: CashDrawerSessionDetail['movements']['items'][number]) => row.orderId ?? '—',
    },
    {
      key: 'orderPaymentId',
      header: t('orderPaymentId'),
      render: (row: CashDrawerSessionDetail['movements']['items'][number]) => row.orderPaymentId ?? '—',
    },
    {
      key: 'refundId',
      header: t('refundId'),
      render: (row: CashDrawerSessionDetail['movements']['items'][number]) => row.refundId ?? '—',
    },
    {
      key: 'performedBy',
      header: t('performedBy'),
      render: (row: CashDrawerSessionDetail['movements']['items'][number]) =>
        row.performedBy?.displayName ?? row.performedBy?.id ?? '—',
    },
  ]

  const paymentColumns = [
    {
      key: 'paidAt',
      header: t('paidAt'),
      render: (row: CashDrawerSessionDetail['linkedPayments']['items'][number]) => fmtDateTime(row.paidAt),
    },
    {
      key: 'orderId',
      header: t('orderId'),
      render: (row: CashDrawerSessionDetail['linkedPayments']['items'][number]) => (
        <span className="font-mono text-xs">{row.orderId}</span>
      ),
    },
    {
      key: 'paymentMethodCode',
      header: t('paymentMethod'),
      render: (row: CashDrawerSessionDetail['linkedPayments']['items'][number]) =>
        row.paymentMethodNameSnapshot ?? row.paymentMethodCode,
    },
    {
      key: 'paymentStatus',
      header: t('paymentStatus'),
      render: (row: CashDrawerSessionDetail['linkedPayments']['items'][number]) => row.paymentStatus ?? '—',
    },
    {
      key: 'amount',
      header: t('amount'),
      render: (row: CashDrawerSessionDetail['linkedPayments']['items'][number]) => money(row.amount, row.currencyCode),
      align: 'right' as const,
    },
    {
      key: 'tenderedAmount',
      header: t('tenderedAmount'),
      render: (row: CashDrawerSessionDetail['linkedPayments']['items'][number]) =>
        money(row.tenderedAmount, row.currencyCode),
      align: 'right' as const,
    },
    {
      key: 'changeReturnedAmount',
      header: t('changeReturnedAmount'),
      render: (row: CashDrawerSessionDetail['linkedPayments']['items'][number]) =>
        money(row.changeReturnedAmount, row.currencyCode),
      align: 'right' as const,
    },
    {
      key: 'terminal',
      header: t('terminal'),
      render: (row: CashDrawerSessionDetail['linkedPayments']['items'][number]) =>
        row.terminalName
          ? row.terminalCode
            ? `${row.terminalName} (${row.terminalCode})`
            : row.terminalName
          : '—',
    },
    {
      key: 'receivedBy',
      header: t('receivedBy'),
      render: (row: CashDrawerSessionDetail['linkedPayments']['items'][number]) =>
        row.receivedBy?.displayName ?? row.receivedBy?.id ?? '—',
    },
  ]

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <CmxButton asChild variant="ghost" size="sm">
              <Link href={`/dashboard/internal_fin/cash-drawers/${drawerId}`}>
                <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" aria-hidden />
                {t('backToDrawer')}
              </Link>
            </CmxButton>
            <CmxButton asChild variant="ghost" size="sm">
              <Link href="/dashboard/internal_fin/cash-drawers">
                <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" aria-hidden />
                {t('backToHub')}
              </Link>
            </CmxButton>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
              {detail.drawer.drawerName}
            </h1>
            <CashDrawerTypeBadge drawerType={detail.drawer.drawerType} />
            <CashDrawerStatusBadge status={detail.session.status} />
          </div>
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t('sessionDetailDescription', { sessionNo: detail.session.sessionNo })}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <CmxButton asChild variant="outline" size="sm">
            <Link href={`/dashboard/internal_fin/cash-drawers/${drawerId}/session/${sessionId}/print`}>
              <Printer className="me-2 h-4 w-4" aria-hidden />
              {tCommon('print')}
            </Link>
          </CmxButton>
        </div>
      </div>

      {varianceApproval.pending ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
            <span>{t('varianceApprovalPendingBanner')}</span>
          </div>
          <CmxButton
            variant="primary"
            size="sm"
            disabled={!canApproveVariance}
            onClick={() => setApprovalDialogOpen(true)}
          >
            {t('approveVariance')}
          </CmxButton>
        </div>
      ) : varianceApproval.approved ? (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
          <ShieldCheck className="h-4 w-4 shrink-0" aria-hidden />
          <span>
            {t('varianceApprovedBanner', {
              approver: varianceApproval.approvedBy?.displayName ?? varianceApproval.approvedBy?.id ?? '—',
              date: fmtDateTime(varianceApproval.approvedAt),
            })}
          </span>
          {varianceApproval.reason ? (
            <span className="italic text-emerald-800">— {varianceApproval.reason}</span>
          ) : null}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CashDrawerInfoTile
          label={tCommon('branch')}
          value={detail.drawer.branchName ?? detail.drawer.branchId ?? '—'}
        />
        <CashDrawerInfoTile label={t('drawerCode')} value={detail.drawer.drawerCode} />
        <CashDrawerInfoTile
          label={t('terminal')}
          value={
            detail.drawer.assignedTerminalName
              ? detail.drawer.assignedTerminalCode
                ? `${detail.drawer.assignedTerminalName} (${detail.drawer.assignedTerminalCode})`
                : detail.drawer.assignedTerminalName
              : '—'
          }
        />
        <CashDrawerInfoTile label={tCommon('currency')} value={detail.drawer.currencyCode} />
        <CashDrawerInfoTile label={t('sessionNo')} value={detail.session.sessionNo} />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('sessionLifecycleTitle')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="grid gap-3 sm:grid-cols-2">
            <CashDrawerInfoTile label={t('sessionStatus')} value={detail.session.status} />
            <CashDrawerInfoTile label={t('openedAt')} value={fmtDateTime(detail.session.openedAt)} />
            <CashDrawerInfoTile label={t('drawerType')} value={detail.drawer.drawerType} />
            <CashDrawerInfoTile
              label={t('openedBy')}
              value={detail.session.openedBy?.displayName ?? detail.session.openedBy?.id ?? '—'}
            />
            <CashDrawerInfoTile label={t('closedAt')} value={fmtDateTime(detail.session.closedAt)} />
            <CashDrawerInfoTile
              label={t('closedBy')}
              value={detail.session.closedBy?.displayName ?? detail.session.closedBy?.id ?? '—'}
            />
            <CashDrawerInfoTile
              label={t('openingBalance')}
              value={money(detail.session.openingFloatAmount, detail.session.currencyCode)}
            />
            <CashDrawerInfoTile
              label={t('expectedCash')}
              value={money(detail.session.expectedCashAmount, detail.session.currencyCode)}
            />
            <CashDrawerInfoTile
              label={t('physicalCount')}
              value={money(detail.session.countedCashAmount, detail.session.currencyCode)}
            />
            <CashDrawerInfoTile
              label={t('variance')}
              value={money(detail.session.differenceAmount, detail.session.currencyCode)}
            />
            {varianceApproval.required ? (
              <CashDrawerInfoTile
                label={t('varianceThreshold')}
                value={money(varianceApproval.thresholdSnapshot, detail.session.currencyCode)}
              />
            ) : null}
            <CashDrawerInfoTile
              label={t('closeNotes')}
              value={detail.session.closeNotes ?? '—'}
            />
            <CashDrawerInfoTile
              label={t('forceCloseReason')}
              value={detail.session.forceCloseReason ?? '—'}
            />
          </CmxCardContent>
        </CmxCard>

        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('reconciliationSummaryTitle')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="grid gap-3 sm:grid-cols-2">
            <CashDrawerInfoTile
              label={t('openingBalance')}
              value={money(detail.reconciliation.openingFloat, detail.reconciliation.currencyCode)}
            />
            <CashDrawerInfoTile
              label={t('cashCollected')}
              value={money(detail.reconciliation.cashCollected, detail.reconciliation.currencyCode)}
            />
            <CashDrawerInfoTile
              label={t('movementCashIn')}
              value={money(detail.reconciliation.movementCashIn, detail.reconciliation.currencyCode)}
            />
            <CashDrawerInfoTile
              label={t('movementCashOut')}
              value={money(detail.reconciliation.movementCashOut, detail.reconciliation.currencyCode)}
            />
            <CashDrawerInfoTile
              label={t('movementNet')}
              value={money(detail.reconciliation.movementNet, detail.reconciliation.currencyCode)}
            />
            <CashDrawerInfoTile
              label={t('expectedCash')}
              value={money(detail.reconciliation.expectedCash, detail.reconciliation.currencyCode)}
            />
            <CashDrawerInfoTile
              label={t('physicalCount')}
              value={money(detail.reconciliation.countedCash, detail.reconciliation.currencyCode)}
            />
            <CashDrawerInfoTile
              label={t('variance')}
              value={money(detail.reconciliation.variance, detail.reconciliation.currencyCode)}
            />
            <CashDrawerInfoTile
              label={t('paymentCount')}
              value={String(detail.reconciliation.paymentCount)}
            />
            <CashDrawerInfoTile
              label={t('movementCount')}
              value={String(detail.reconciliation.movementCount)}
            />
          </CmxCardContent>
        </CmxCard>
      </div>

      <CmxCard>
        <CmxCardHeader>
          <div className="flex items-center gap-2">
            <WalletCards className="h-4 w-4" aria-hidden />
            <CmxCardTitle>{t('movements')}</CmxCardTitle>
          </div>
        </CmxCardHeader>
        <CmxCardContent>
          <CmxDataTable
            columns={movementColumns}
            data={detail.movements.items}
            currentPage={detail.movements.page}
            pageSize={detail.movements.pageSize}
            totalCount={detail.movements.total}
            onPageChange={(page) =>
              replaceSearchParams((params) => {
                params.set('movementPage', String(page))
              })
            }
            onPageSizeChange={() => undefined}
            pageSizeOptions={[detail.movements.pageSize]}
            showPageSizeSelector={false}
            emptyStateTitle={t('noMovementsTitle')}
            emptyStateDescription={t('noMovementsDescription')}
          />
        </CmxCardContent>
      </CmxCard>

      <CmxCard>
        <CmxCardHeader>
          <div className="flex items-center gap-2">
            <ReceiptText className="h-4 w-4" aria-hidden />
            <CmxCardTitle>{t('linkedPaymentsTitle')}</CmxCardTitle>
          </div>
        </CmxCardHeader>
        <CmxCardContent>
          <CmxDataTable
            columns={paymentColumns}
            data={detail.linkedPayments.items}
            currentPage={detail.linkedPayments.page}
            pageSize={detail.linkedPayments.pageSize}
            totalCount={detail.linkedPayments.total}
            onPageChange={(page) =>
              replaceSearchParams((params) => {
                params.set('paymentPage', String(page))
              })
            }
            onPageSizeChange={() => undefined}
            pageSizeOptions={[detail.linkedPayments.pageSize]}
            showPageSizeSelector={false}
            emptyStateTitle={t('noLinkedPaymentsTitle')}
            emptyStateDescription={t('noLinkedPaymentsDescription')}
          />
        </CmxCardContent>
      </CmxCard>

      <CashDrawerVarianceApprovalDialog
        open={approvalDialogOpen}
        onOpenChange={setApprovalDialogOpen}
        drawerId={drawerId}
        sessionId={sessionId}
        onApproved={() => router.refresh()}
      />
    </div>
  )
}
