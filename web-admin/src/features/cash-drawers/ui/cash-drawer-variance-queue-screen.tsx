'use client'

import Link from 'next/link'
import { useState } from 'react'
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslations } from 'next-intl'

import {
  fetchVarianceQueue,
  type VarianceQueueDecision,
  type VarianceQueueEntry,
} from '@features/cash-drawers/api/cash-drawer-api'
import {
  useCashDrawerDateFormatter,
  useCashDrawerMoneyFormatter,
} from '@features/cash-drawers/ui/cash-drawer-ui-parts'
import {
  CashDrawerVarianceApprovalDialog,
  type CashDrawerVarianceDecisionMode,
} from '@features/cash-drawers/ui/cash-drawer-variance-approval-dialog'
import { useHasPermissionCode } from '@/lib/hooks/usePermissions'
import { CmxStatusBadge } from '@ui/feedback'
import { CmxDataTable } from '@ui/data-display'
import { CmxButton, CmxSelect } from '@ui/primitives'

const PAGE_SIZE = 20
const DECISIONS: VarianceQueueDecision[] = ['PENDING', 'REJECTED', 'APPROVED', 'ALL']

const decisionVariant = (decision: VarianceQueueEntry['decision']): 'warning' | 'error' | 'success' =>
  decision === 'PENDING' ? 'warning' : decision === 'REJECTED' ? 'error' : 'success'

/**
 * Variance decision queue (C3): closed drawer sessions whose closing variance tripped their
 * threshold. The supervisor works the PENDING list — approve to accept the variance, reject to flag
 * it for investigation — and can re-open the REJECTED list at any time. Decisions use the same
 * dialog, endpoints and `cash_drawer:approve_variance` gate as the session page.
 */
export function CashDrawerVarianceQueueScreen() {
  const t = useTranslations('billing.cashDrawers.varianceQueue')
  const tCommon = useTranslations('common')
  const money = useCashDrawerMoneyFormatter()
  const fmtDateTime = useCashDrawerDateFormatter()
  const queryClient = useQueryClient()
  const canDecide = useHasPermissionCode('cash_drawer:approve_variance')

  const [page, setPage] = useState(1)
  const [decision, setDecision] = useState<VarianceQueueDecision>('PENDING')
  const [deciding, setDeciding] = useState<{ row: VarianceQueueEntry; mode: CashDrawerVarianceDecisionMode } | null>(null)

  const listQuery = useQuery({
    queryKey: ['cash-drawers', 'variance-approvals', page, decision],
    queryFn: () => fetchVarianceQueue({ page, pageSize: PAGE_SIZE, decision }),
    placeholderData: keepPreviousData,
  })

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{t('title')}</h1>
        <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('description')}</p>
      </div>

      <div className="max-w-xs">
        <CmxSelect
          label={t('filterDecision')}
          value={decision}
          onChange={(event) => {
            setDecision(event.target.value as VarianceQueueDecision)
            setPage(1)
          }}
          options={DECISIONS.map((value) => ({ value, label: t(`decisions.${value}`) }))}
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
              key: 'sessionNo',
              header: t('columns.session'),
              render: (r: VarianceQueueEntry) => (
                <Link
                  className="font-mono text-xs font-semibold underline-offset-2 hover:underline"
                  href={`/dashboard/internal_fin/cash-drawers/${r.drawerId}/session/${r.sessionId}`}
                >
                  {r.sessionNo}
                </Link>
              ),
            },
            { key: 'drawer', header: t('columns.drawer'), render: (r: VarianceQueueEntry) => r.drawerName ?? '—' },
            { key: 'branch', header: t('columns.branch'), render: (r: VarianceQueueEntry) => r.branchName ?? '—' },
            { key: 'closedAt', header: t('columns.closedAt'), render: (r: VarianceQueueEntry) => fmtDateTime(r.closedAt) },
            { key: 'closedBy', header: t('columns.closedBy'), render: (r: VarianceQueueEntry) => r.closedByName ?? '—' },
            {
              key: 'variance',
              header: t('columns.variance'),
              align: 'right' as const,
              render: (r: VarianceQueueEntry) => (
                <div className="space-y-1">
                  {r.currencies.map((c) => (
                    <div key={c.currencyCode}>
                      <div className="font-semibold">{money(c.closingVariance, c.currencyCode)}</div>
                      <div className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                        {t('expectedCounted', {
                          expected: money(c.closingExpected, c.currencyCode),
                          counted: money(c.closingCounted, c.currencyCode),
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ),
            },
            {
              key: 'threshold',
              header: t('columns.threshold'),
              align: 'right' as const,
              render: (r: VarianceQueueEntry) => r.thresholdSnapshot,
            },
            {
              key: 'decision',
              header: t('columns.decision'),
              render: (r: VarianceQueueEntry) => (
                <CmxStatusBadge label={t(`decisions.${r.decision}`)} variant={decisionVariant(r.decision)} size="sm" />
              ),
            },
            {
              key: 'decidedBy',
              header: t('columns.decidedBy'),
              render: (r: VarianceQueueEntry) =>
                r.decision === 'PENDING' ? '—' : `${r.decidedByName ?? '—'} · ${fmtDateTime(r.decidedAt)}`,
            },
            { key: 'reason', header: t('columns.reason'), render: (r: VarianceQueueEntry) => r.decisionReason ?? '—' },
            {
              key: 'actions',
              header: tCommon('actions'),
              sortable: false,
              align: 'right' as const,
              render: (r: VarianceQueueEntry) =>
                r.decision === 'PENDING' && canDecide ? (
                  <div className="flex flex-wrap justify-end gap-2">
                    <CmxButton size="sm" variant="outline" onClick={() => setDeciding({ row: r, mode: 'reject' })}>
                      {t('reject')}
                    </CmxButton>
                    <CmxButton size="sm" onClick={() => setDeciding({ row: r, mode: 'approve' })}>
                      {t('approve')}
                    </CmxButton>
                  </div>
                ) : (
                  <CmxButton size="sm" variant="ghost" asChild>
                    <Link href={`/dashboard/internal_fin/cash-drawers/${r.drawerId}/session/${r.sessionId}`}>{t('review')}</Link>
                  </CmxButton>
                ),
            },
          ]}
          data={listQuery.data?.rows ?? []}
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

      {deciding ? (
        <CashDrawerVarianceApprovalDialog
          open
          onOpenChange={(next) => {
            if (!next) setDeciding(null)
          }}
          drawerId={deciding.row.drawerId}
          sessionId={deciding.row.sessionId}
          mode={deciding.mode}
          onDecided={() => {
            setDeciding(null)
            void queryClient.invalidateQueries({ queryKey: ['cash-drawers', 'variance-approvals'] })
          }}
        />
      ) : null}
    </div>
  )
}
