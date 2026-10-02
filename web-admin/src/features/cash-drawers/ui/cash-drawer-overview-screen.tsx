'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { useState, useTransition } from 'react'
import { useTranslations } from 'next-intl'
import { ArrowLeft, ArrowLeftRight, CircleDollarSign, WalletCards } from 'lucide-react'

import { postDrawerCashInOut } from '@/app/actions/billing/cash-drawer-actions'
import {
  CashDrawerInfoTile,
  CashDrawerStatusBadge,
  CashDrawerTypeBadge,
  useCashDrawerDateFormatter,
  useCashDrawerMoneyFormatter,
} from '@features/cash-drawers/ui/cash-drawer-ui-parts'
import { CashDrawerOpenSessionDialog } from '@features/cash-drawers/ui/cash-drawer-open-session-dialog'
import { CashDrawerCloseWizard } from '@features/cash-drawers/ui/cash-drawer-close-wizard'
import {
  CashDrawerCountsTab,
  CashDrawerLedgerTab,
  CashDrawerTransactionsTab,
} from '@features/cash-drawers/ui/cash-drawer-ledger-tabs'
import { CashDrawerTransactionDialog } from '@features/cash-drawers/ui/cash-drawer-transaction-dialog'
import { CashDrawerPolicyTab } from '@features/cash-drawers/ui/cash-drawer-policy-tab'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import type {
  CashDrawerOverviewDetail,
  CashDrawerSessionListRow,
} from '@lib/types/cash-drawer'
import { DRAWER_CASH_IN_OUT_ROLES } from '@lib/constants/cash-drawer'
import { LINE_ROLE, LINE_ROLE_REQUIREMENTS } from '@lib/constants/voucher'

type DrawerCashMovementRole =
  (typeof DRAWER_CASH_IN_OUT_ROLES.OUT)[number] | (typeof DRAWER_CASH_IN_OUT_ROLES.IN)[number]
import { cmxMessage } from '@ui/feedback'
import { CmxDataTable } from '@ui/data-display'
import { CmxTabsPanel } from '@ui/navigation'
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
  const tLedger = useTranslations('cashControl.ledgerErrors')
  const tTrx = useTranslations('billing.cashDrawers.trxDialog')
  const router = useRouter()
  const queryClient = useQueryClient()
  const [isPending, startTransition] = useTransition()

  const money = useCashDrawerMoneyFormatter()
  const fmtDateTime = useCashDrawerDateFormatter()

  const [openDialogOpen, setOpenDialogOpen] = useState(false)
  const [moveDialogOpen, setMoveDialogOpen] = useState(false)
  const [closeDialogOpen, setCloseDialogOpen] = useState(false)
  const [trxDialogOpen, setTrxDialogOpen] = useState(false)

  const [lineRole, setLineRole] = useState<DrawerCashMovementRole>(LINE_ROLE.EXPENSE_PAYMENT)
  const [moveAmount, setMoveAmount] = useState('0')
  const [moveReason, setMoveReason] = useState('')
  const [movePartyName, setMovePartyName] = useState('')
  const [moveExpenseCategoryCode, setMoveExpenseCategoryCode] = useState('')
  const [moveEmployeeId, setMoveEmployeeId] = useState('')
  // Render-time reset (Pattern A, react-effects-patterns.md §2) — a fresh
  // idempotency key each time the dialog opens; a retry of the same attempt
  // (e.g. after a ledger refusal) reuses it, same precedent as the gift-card
  // sell dialog.
  const [moveIdempotencyKey, setMoveIdempotencyKey] = useState<string>(() => crypto.randomUUID())
  const [movePrevOpen, setMovePrevOpen] = useState(moveDialogOpen)
  if (moveDialogOpen !== movePrevOpen) {
    setMovePrevOpen(moveDialogOpen)
    if (moveDialogOpen) setMoveIdempotencyKey(crypto.randomUUID())
  }
  const moveRequirements = LINE_ROLE_REQUIREMENTS[lineRole]
  const moveNeedsPartyName = moveRequirements?.requiredFields.includes('party_name') ?? false
  const moveNeedsExpenseCategory = moveRequirements?.requiredFields.includes('expense_category_code') ?? false
  const moveNeedsEmployeeId =
    lineRole === LINE_ROLE.PETTY_CASH_ISSUE || lineRole === LINE_ROLE.PETTY_CASH_RETURN

  const handleCashInOut = () => {
    if (!currentSession) return

    if (!(Number(moveAmount) > 0)) {
      cmxMessage.error(t('validation.amountMustBePositive'))
      return
    }
    if (!moveReason.trim()) {
      cmxMessage.error(t('validation.reasonRequired'))
      return
    }
    if (moveNeedsPartyName && !movePartyName.trim()) {
      cmxMessage.error(t('validation.supplierNameRequired'))
      return
    }
    if (moveNeedsExpenseCategory && !moveExpenseCategoryCode.trim()) {
      cmxMessage.error(t('validation.expenseCategoryRequired'))
      return
    }

    startTransition(async () => {
      const result = await postDrawerCashInOut(drawerId, {
        cashDrawerSessionId: currentSession.id,
        lineRole,
        amount: Number(moveAmount) || 0,
        reason: moveReason.trim(),
        partyName: moveNeedsPartyName ? movePartyName.trim() : undefined,
        expenseCategoryCode: moveNeedsExpenseCategory ? moveExpenseCategoryCode.trim() : undefined,
        employeeId: moveNeedsEmployeeId ? moveEmployeeId.trim() || undefined : undefined,
        idempotencyKey: moveIdempotencyKey,
      })

      if (!result.success) {
        cmxMessage.error(
          tLedger.has(result.error) ? tLedger(result.error as Parameters<typeof tLedger>[0]) : result.error
        )
        return
      }

      cmxMessage.success(t('messages.movementRecorded', { voucherNo: result.data.voucherNo }))
      setMoveDialogOpen(false)
      setMoveAmount('0')
      setMoveReason('')
      setMovePartyName('')
      setMoveExpenseCategoryCode('')
      setMoveEmployeeId('')
      setLineRole(LINE_ROLE.EXPENSE_PAYMENT)
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

  const canCount = useHasPermissionCode('cash_drawer:count')
  const canTransfer = useHasPermissionCode('cash_drawer:transfer')
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
          {canTransfer ? (
            <CmxButton variant="outline" onClick={() => setTrxDialogOpen(true)} disabled={isPending}>
              <ArrowLeftRight className="me-2 h-4 w-4" aria-hidden />
              {tTrx('openButton')}
            </CmxButton>
          ) : null}
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
          label={t('openingCountRequired')}
          value={overview.drawer.openingCountRequired ? t('yesValue') : t('noValue')}
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

      <CmxTabsPanel
        tabs={[
          {
            id: 'sessions',
            label: t('tabs.sessions'),
            content: (
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
            ),
          },
          { id: 'ledger', label: t('tabs.ledger.title'), content: <CashDrawerLedgerTab drawerId={drawerId} /> },
          { id: 'transactions', label: t('tabs.trx.title'), content: <CashDrawerTransactionsTab drawerId={drawerId} /> },
          {
            id: 'counts',
            label: t('tabs.counts.title'),
            content: (
              <CashDrawerCountsTab
                drawerId={drawerId}
                currencyCode={overview.drawer.currencyCode}
                currentSessionId={currentSession?.id ?? null}
                canCount={canCount}
              />
            ),
          },
          { id: 'policy', label: t('tabs.policy.title'), content: <CashDrawerPolicyTab drawerId={drawerId} /> },
        ]}
      />

      <CashDrawerTransactionDialog
        drawerId={drawerId}
        drawerType={overview.drawer.drawerType}
        drawerName={overview.drawer.drawerName}
        branchId={overview.drawer.branchId}
        currencyCode={overview.drawer.currencyCode}
        open={trxDialogOpen}
        onOpenChange={setTrxDialogOpen}
        onPosted={() => {
          void queryClient.invalidateQueries({ queryKey: ['cash-drawers', drawerId] })
          router.refresh()
        }}
      />

      <CashDrawerOpenSessionDialog
        drawerId={drawerId}
        currencyCode={overview.drawer.currencyCode}
        open={openDialogOpen}
        onOpenChange={setOpenDialogOpen}
        onOpened={() => router.refresh()}
      />

      <CmxDialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <CmxDialogContent className="max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('addMovement')}</CmxDialogTitle>
          </CmxDialogHeader>
          <div className="space-y-4">
            <CmxSelect
              label={t('lineRole')}
              value={lineRole}
              onChange={(event) => setLineRole(event.target.value as DrawerCashMovementRole)}
              options={[
                ...DRAWER_CASH_IN_OUT_ROLES.OUT.map((role) => ({ value: role, label: t(`roles.${role}`) })),
                ...DRAWER_CASH_IN_OUT_ROLES.IN.map((role) => ({ value: role, label: t(`roles.${role}`) })),
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
            {moveNeedsPartyName ? (
              <CmxInput
                label={t('supplierName')}
                value={movePartyName}
                onChange={(event) => setMovePartyName(event.target.value)}
              />
            ) : null}
            {moveNeedsExpenseCategory ? (
              <CmxInput
                label={t('expenseCategory')}
                value={moveExpenseCategoryCode}
                onChange={(event) => setMoveExpenseCategoryCode(event.target.value)}
              />
            ) : null}
            {moveNeedsEmployeeId ? (
              <CmxInput
                label={t('employeeIdOptional')}
                value={moveEmployeeId}
                onChange={(event) => setMoveEmployeeId(event.target.value)}
              />
            ) : null}
          </div>
          <CmxDialogFooter>
            <CmxButton variant="outline" onClick={() => setMoveDialogOpen(false)}>
              {tCommon('cancel')}
            </CmxButton>
            <CmxButton loading={isPending} onClick={handleCashInOut}>
              {t('addMovement')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      {currentSession ? (
        <CashDrawerCloseWizard
          drawerId={drawerId}
          sessionId={currentSession.id}
          branchId={overview.drawer.branchId}
          open={closeDialogOpen}
          onOpenChange={setCloseDialogOpen}
          onFinalized={() => router.refresh()}
        />
      ) : null}
    </div>
  )
}
