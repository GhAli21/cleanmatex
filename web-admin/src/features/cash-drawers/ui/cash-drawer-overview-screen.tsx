'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQuery } from '@tanstack/react-query'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, CircleDollarSign, WalletCards } from 'lucide-react'

import {
  addDrawerMovement,
  closeDrawerSession,
  openDrawerSession,
} from '@/app/actions/billing/cash-drawer-actions'
import {
  buildCashDrawerClosePreview,
  fetchCashDrawerSessionCloseSummary,
} from '@features/cash-drawers/api/cash-drawer-api'
import {
  CashDrawerInfoTile,
  CashDrawerMovementBadge,
  CashDrawerStatusBadge,
  CashDrawerTypeBadge,
  useCashDrawerDateFormatter,
  useCashDrawerMoneyFormatter,
} from '@features/cash-drawers/ui/cash-drawer-ui-parts'
import type {
  CashDrawerOverviewDetail,
  CashDrawerSessionListRow,
} from '@lib/types/cash-drawer'
import { cmxMessage } from '@ui/feedback'
import { CmxDataTable } from '@ui/data-display'
import { CmxButton, CmxInput, CmxSelect, CmxTextarea, Label } from '@ui/primitives'
import { Badge } from '@ui/primitives/badge'
import {
  CmxCard,
  CmxCardContent,
  CmxCardHeader,
  CmxCardTitle,
} from '@ui/primitives/cmx-card'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '@ui/overlays'

/**
 * Drawer-level operational overview screen.
 *
 * Why:
 * this route stays focused on one drawer's daily operations, while the master
 * hub above it handles cross-drawer selection and paging.
 */
export function CashDrawerOverviewScreen({
  drawerId,
  overview,
}: {
  drawerId: string
  overview: CashDrawerOverviewDetail
}) {
  const t = useTranslations('billing.cashDrawers')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const [isPending, startTransition] = useTransition()

  const money = useCashDrawerMoneyFormatter()
  const fmtDateTime = useCashDrawerDateFormatter()

  const [openDialogOpen, setOpenDialogOpen] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)

  const [openingBalance, setOpeningBalance] = useState('0')
  const [openNotes, setOpenNotes] = useState('')
  const [movementType, setMovementType] = useState<'CASH_IN' | 'CASH_OUT' | 'PETTY_CASH'>('CASH_IN')
  const [moveAmount, setMoveAmount] = useState('0')
  const [moveReason, setMoveReason] = useState('')
  const [physicalCount, setPhysicalCount] = useState('')
  const [closeNotes, setCloseNotes] = useState('')

  const closeSummaryQuery = useQuery({
    queryKey: ['cash-drawers', drawerId, 'close-summary', overview.currentSession?.id ?? 'none'],
    enabled: closeDialogOpen && !!overview.currentSession?.id,
    queryFn: () =>
      fetchCashDrawerSessionCloseSummary(drawerId, overview.currentSession!.id),
  })

  const closePreview = closeSummaryQuery.data
    ? buildCashDrawerClosePreview(closeSummaryQuery.data, physicalCount)
    : null

  const handleOpenSession = () => {
    startTransition(async () => {
      const result = await openDrawerSession(drawerId, {
        openingBalance: Number(openingBalance) || 0,
        notes: openNotes.trim() || undefined,
      })

      if (!result.success) {
        cmxMessage.error(result.error ?? t('messages.openFailed'))
        return
      }

      cmxMessage.success(t('messages.sessionOpened'))
      setOpenDialogOpen(false)
      setOpeningBalance('0')
      setOpenNotes('')
      router.refresh()
    })
  }

  const handleRecordMovement = () => {
    startTransition(async () => {
      const result = await addDrawerMovement(drawerId, {
        movementType,
        amount: Number(moveAmount) || 0,
        reason: moveReason.trim(),
      })

      if (!result.success) {
        cmxMessage.error(result.error ?? t('messages.movementFailed'))
        return
      }

      cmxMessage.success(t('messages.movementRecorded'))
      setMoveDialogOpen(false)
      setMoveAmount('0')
      setMoveReason('')
      setMovementType('CASH_IN')
      router.refresh()
    })
  }

  const handleCloseSession = () => {
    if (!overview.currentSession) return

    startTransition(async () => {
      const result = await closeDrawerSession(overview.currentSession!.id, {
        physicalCount: Number(physicalCount) || 0,
        notes: closeNotes.trim() || undefined,
      })

      if (!result.success) {
        cmxMessage.error(result.error ?? t('messages.closeFailed'))
        return
      }

      cmxMessage.success(t('messages.sessionClosed'))
      setCloseDialogOpen(false)
      setPhysicalCount('')
      setCloseNotes('')
      router.refresh()
    })
  }

  const sessionColumns = [
    {
      key: 'sessionNo',
      header: t('columns.sessionNo'),
      render: (row: CashDrawerSessionListRow) => (
        <span className="font-mono text-xs font-semibold">{row.sessionNo}</span>
      ),
    },
    {
      key: 'status',
      header: t('columns.status'),
      render: (row: CashDrawerSessionListRow) => <CashDrawerStatusBadge status={row.status} />,
    },
    {
      key: 'openedAt',
      header: t('openedAt'),
      render: (row: CashDrawerSessionListRow) => fmtDateTime(row.openedAt),
    },
    {
      key: 'closedAt',
      header: t('closedAt'),
      render: (row: CashDrawerSessionListRow) => fmtDateTime(row.closedAt),
    },
    {
      key: 'openingFloatAmount',
      header: t('openingBalance'),
      render: (row: CashDrawerSessionListRow) => money(row.openingFloatAmount, overview.drawer.currencyCode),
      align: 'right' as const,
    },
    {
      key: 'expectedCashAmount',
      header: t('expectedCash'),
      render: (row: CashDrawerSessionListRow) => money(row.expectedCashAmount, overview.drawer.currencyCode),
      align: 'right' as const,
    },
    {
      key: 'differenceAmount',
      header: t('variance'),
      render: (row: CashDrawerSessionListRow) => money(row.differenceAmount, overview.drawer.currencyCode),
      align: 'right' as const,
    },
    {
      key: 'actions',
      header: tCommon('actions'),
      render: (row: CashDrawerSessionListRow) => (
        <div className="flex justify-end gap-2">
          <CmxButton asChild variant="outline" size="sm">
            <Link href={`/dashboard/internal_fin/cash-drawers/${drawerId}/session/${row.id}`}>
              {tCommon('view')}
            </Link>
          </CmxButton>
        </div>
      ),
      sortable: false,
      align: 'right' as const,
    },
  ]

  const movementColumns = [
    {
      key: 'performedAt',
      header: t('performedAt'),
      render: (row: CashDrawerOverviewDetail['recentMovements'][number]) => fmtDateTime(row.performedAt),
    },
    {
      key: 'movementType',
      header: t('movementType'),
      render: (row: CashDrawerOverviewDetail['recentMovements'][number]) => (
        <CashDrawerMovementBadge movement={row} />
      ),
    },
    {
      key: 'amount',
      header: t('amount'),
      render: (row: CashDrawerOverviewDetail['recentMovements'][number]) => money(row.amount, row.currencyCode),
      align: 'right' as const,
    },
    {
      key: 'reason',
      header: t('reason'),
      render: (row: CashDrawerOverviewDetail['recentMovements'][number]) => row.reason ?? '—',
    },
    {
      key: 'performedBy',
      header: t('performedBy'),
      render: (row: CashDrawerOverviewDetail['recentMovements'][number]) =>
        row.performedBy?.displayName ?? row.performedBy?.id ?? '—',
    },
  ]

  const currentSession = overview.currentSession
  const latestSession = overview.latestSession

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-3">
          <CmxButton asChild variant="ghost" size="sm">
            <Link href="/dashboard/internal_fin/cash-drawers">
              <ArrowLeft className="me-2 h-4 w-4 rtl:rotate-180" aria-hidden />
              {t('backToHub')}
            </Link>
          </CmxButton>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
              {overview.drawer.drawerName}
            </h1>
            <CashDrawerTypeBadge drawerType={overview.drawer.drawerType} />
            <CashDrawerStatusBadge status={currentSession ? 'OPEN' : 'CLOSED'} />
            <Badge variant="outline" className="font-mono">
              {overview.drawer.drawerCode}
            </Badge>
          </div>
          {overview.drawer.drawerName2 ? (
            <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {overview.drawer.drawerName2}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-2">
          {!currentSession ? (
            <CmxButton onClick={() => setOpenDialogOpen(true)} disabled={isPending}>
              <WalletCards className="me-2 h-4 w-4" aria-hidden />
              {t('openSession')}
            </CmxButton>
          ) : null}
          {currentSession ? (
            <>
              <CmxButton variant="outline" onClick={() => setMoveDialogOpen(true)} disabled={isPending}>
                <CircleDollarSign className="me-2 h-4 w-4" aria-hidden />
                {t('addMovement')}
              </CmxButton>
              <CmxButton variant="destructive" onClick={() => setCloseDialogOpen(true)} disabled={isPending}>
                {t('closeSession')}
              </CmxButton>
            </>
          ) : null}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <CashDrawerInfoTile
          label={tCommon('branch')}
          value={overview.drawer.branchName ?? overview.drawer.branchId ?? '—'}
        />
        <CashDrawerInfoTile
          label={t('terminal')}
          value={
            overview.drawer.assignedTerminalName
              ? overview.drawer.assignedTerminalCode
                ? `${overview.drawer.assignedTerminalName} (${overview.drawer.assignedTerminalCode})`
                : overview.drawer.assignedTerminalName
              : '—'
          }
        />
        <CashDrawerInfoTile label={tCommon('currency')} value={overview.drawer.currencyCode} />
        <CashDrawerInfoTile
          label={t('requiresSession')}
          value={overview.drawer.requiresSession ? t('yesValue') : t('noValue')}
        />
        <CashDrawerInfoTile
          label={t('openingFloatRequired')}
          value={overview.drawer.openingFloatRequired ? t('yesValue') : t('noValue')}
        />
        <CashDrawerInfoTile
          label={t('maxCashLimit')}
          value={money(overview.drawer.maxCashLimit, overview.drawer.currencyCode)}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('currentSessionCardTitle')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="space-y-3">
            {currentSession ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <CashDrawerInfoTile label={t('sessionNo')} value={currentSession.sessionNo} />
                <CashDrawerInfoTile label={t('sessionStatus')} value={currentSession.status} />
                <CashDrawerInfoTile label={t('openedAt')} value={fmtDateTime(currentSession.openedAt)} />
                <CashDrawerInfoTile
                  label={t('openingBalance')}
                  value={money(currentSession.openingFloatAmount, overview.drawer.currencyCode)}
                />
                <CashDrawerInfoTile
                  label={t('expectedCash')}
                  value={money(currentSession.expectedCashAmount, overview.drawer.currencyCode)}
                />
                <CashDrawerInfoTile
                  label={t('paymentCount')}
                  value={String(currentSession.paymentCount)}
                />
                <CashDrawerInfoTile
                  label={t('movementCount')}
                  value={String(currentSession.movementCount)}
                />
              </div>
            ) : latestSession ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <CashDrawerInfoTile label={t('lastSessionNo')} value={latestSession.sessionNo} />
                <CashDrawerInfoTile label={t('sessionStatus')} value={latestSession.status} />
                <CashDrawerInfoTile label={t('closedAt')} value={fmtDateTime(latestSession.closedAt)} />
                <CashDrawerInfoTile
                  label={t('expectedCash')}
                  value={money(latestSession.expectedCashAmount, overview.drawer.currencyCode)}
                />
                <CashDrawerInfoTile
                  label={t('paymentCount')}
                  value={String(latestSession.paymentCount)}
                />
                <CashDrawerInfoTile
                  label={t('movementCount')}
                  value={String(latestSession.movementCount)}
                />
                <CashDrawerInfoTile
                  label={t('variance')}
                  value={money(latestSession.differenceAmount, overview.drawer.currencyCode)}
                />
              </div>
            ) : (
              <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {t('noSessionsYet')}
              </p>
            )}
          </CmxCardContent>
        </CmxCard>

        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('operationalSummaryTitle')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent className="grid gap-3 sm:grid-cols-3">
            <CashDrawerInfoTile
              label={t('sessionCount')}
              value={String(overview.recentSessions.length)}
            />
            <CashDrawerInfoTile
              label={t('movementCount')}
              value={String(overview.recentMovements.length)}
            />
            <CashDrawerInfoTile
              label={t('statusLabelsLabel')}
              value={currentSession ? t('statusLabels.OPEN') : t('statusLabels.CLOSED')}
            />
          </CmxCardContent>
        </CmxCard>
      </div>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('recentSessionsTitle')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          <CmxDataTable
            columns={sessionColumns}
            data={overview.recentSessions}
            currentPage={1}
            pageSize={overview.recentSessions.length || 5}
            totalCount={overview.recentSessions.length}
            showPageSizeSelector={false}
            paginationFooter="never"
            emptyStateTitle={t('hub.noSessionsTitle')}
            emptyStateDescription={t('hub.noSessionsDescription')}
          />
        </CmxCardContent>
      </CmxCard>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('recentMovementsTitle')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          <CmxDataTable
            columns={movementColumns}
            data={overview.recentMovements}
            currentPage={1}
            pageSize={overview.recentMovements.length || 10}
            totalCount={overview.recentMovements.length}
            showPageSizeSelector={false}
            paginationFooter="never"
            emptyStateTitle={t('noMovementsTitle')}
            emptyStateDescription={t('noMovementsDescription')}
          />
        </CmxCardContent>
      </CmxCard>

      <CmxDialog open={openDialogOpen} onOpenChange={setOpenDialogOpen}>
        <CmxDialogContent className="max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('openSessionConfirm')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            <CmxInput
              label={t('openingBalance')}
              type="number"
              min="0"
              step="0.001"
              value={openingBalance}
              onChange={(event) => setOpeningBalance(event.target.value)}
            />
            <div className="space-y-2">
              <Label>
                {t('notesOptional')}
              </Label>
              <CmxTextarea
                value={openNotes}
                onChange={(event) => setOpenNotes(event.target.value)}
              />
            </div>
          </div>
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setOpenDialogOpen(false)}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton loading={isPending} onClick={handleOpenSession}>
              {t('openSession')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <CmxDialogContent className="max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('addMovement')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            <CmxSelect
              label={t('movementType')}
              value={movementType}
              onChange={(event) =>
                setMovementType(event.target.value as 'CASH_IN' | 'CASH_OUT' | 'PETTY_CASH')
              }
              options={[
                { value: 'CASH_IN', label: t('cashIn') },
                { value: 'CASH_OUT', label: t('cashOut') },
                { value: 'PETTY_CASH', label: t('pettyCash') },
              ]}
            />
            <CmxInput
              label={t('amount')}
              type="number"
              min="0.001"
              step="0.001"
              value={moveAmount}
              onChange={(event) => setMoveAmount(event.target.value)}
            />
            <CmxInput
              label={t('reason')}
              value={moveReason}
              onChange={(event) => setMoveReason(event.target.value)}
            />
          </div>
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setMoveDialogOpen(false)}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton loading={isPending} onClick={handleRecordMovement}>
              {t('addMovement')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      <CmxDialog open={closeDialogOpen} onOpenChange={setCloseDialogOpen}>
        <CmxDialogContent className="max-w-2xl">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('closeSessionConfirm')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {t('closeSessionDesc')}
            </p>

            {closePreview ? (
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <CashDrawerInfoTile
                  label={t('openingBalance')}
                  value={money(closePreview.openingFloat, closePreview.currencyCode)}
                />
                <CashDrawerInfoTile
                  label={t('cashCollected')}
                  value={money(closePreview.cashCollected, closePreview.currencyCode)}
                />
                <CashDrawerInfoTile
                  label={t('expectedCash')}
                  value={money(closePreview.expectedCash, closePreview.currencyCode)}
                />
                <CashDrawerInfoTile
                  label={t('movementCashIn')}
                  value={money(closePreview.movementCashIn, closePreview.currencyCode)}
                />
                <CashDrawerInfoTile
                  label={t('movementCashOut')}
                  value={money(closePreview.movementCashOut, closePreview.currencyCode)}
                />
                <CashDrawerInfoTile
                  label={t('movementNet')}
                  value={money(closePreview.movementNet, closePreview.currencyCode)}
                />
              </div>
            ) : closeSummaryQuery.isLoading ? (
              <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {t('messages.summaryLoading')}
              </p>
            ) : null}

            <CmxInput
              label={t('physicalCount')}
              type="number"
              min="0"
              step="0.001"
              value={physicalCount}
              onChange={(event) => setPhysicalCount(event.target.value)}
            />
            <div className="space-y-2">
              <Label>
                {t('notesOptional')}
              </Label>
              <CmxTextarea
                value={closeNotes}
                onChange={(event) => setCloseNotes(event.target.value)}
              />
            </div>
          </div>
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setCloseDialogOpen(false)}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton
              variant="destructive"
              loading={isPending}
              onClick={handleCloseSession}
            >
              {t('confirmClose')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  )
}
