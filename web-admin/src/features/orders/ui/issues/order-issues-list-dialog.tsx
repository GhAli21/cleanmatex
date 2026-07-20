/**
 * Lists issues for a scope in a CmxDataTable (Issue / Reported / Resolution / Solved).
 */

'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogDescription,
} from '@ui/overlays';
import { CmxButton, CmxSpinner } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxDataTable, CmxEmptyState } from '@ui/data-display';
import { OrderIssueSolveDialog } from './order-issue-solve-dialog';
import { OrderIssueReportDialog } from './order-issue-report-dialog';
import type { OrderIssueScope } from '@/lib/constants/order-issues';
import { OrderIssueActorTimeCell } from './order-issue-actor-time-cell';
import type { OrderIssueTableRow } from './order-issue-table-types';

export interface OrderIssuesListDialogProps {
  open: boolean;
  orderId: string;
  scopeLevel: OrderIssueScope;
  orderItemId?: string | null;
  orderItemPieceId?: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

/**
 * Scoped issues list with solve / add — table layout.
 */
export function OrderIssuesListDialog({
  open,
  orderId,
  scopeLevel,
  orderItemId,
  orderItemPieceId,
  onOpenChange,
  onChanged,
}: OrderIssuesListDialogProps) {
  const t = useTranslations('orders.issues');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const queryClient = useQueryClient();
  const [solveIssueId, setSolveIssueId] = React.useState<string | null>(null);
  const [reportOpen, setReportOpen] = React.useState(false);

  const queryKey = [
    'order-issues',
    orderId,
    scopeLevel,
    orderItemId,
    orderItemPieceId,
  ] as const;

  const { data, isLoading, refetch } = useQuery({
    queryKey,
    enabled: open && Boolean(orderId),
    queryFn: async () => {
      const params = new URLSearchParams({ status: 'all' });
      if (orderItemPieceId) {
        params.set('orderItemPieceId', orderItemPieceId);
      } else if (orderItemId) {
        params.set('orderItemId', orderItemId);
        params.set('includeChildren', 'false');
      } else {
        params.set('includeChildren', 'false');
      }
      const response = await fetch(
        `/api/v1/orders/${orderId}/issues?${params.toString()}`
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (json as { error?: string }).error || t('listFailed')
        );
      }
      return {
        issues: ((json as { data?: OrderIssueTableRow[] }).data ??
          []) as OrderIssueTableRow[],
        openCount:
          (json as { meta?: { openCount?: number } }).meta?.openCount ?? 0,
        totalCount:
          (json as { meta?: { totalCount?: number } }).meta?.totalCount ?? 0,
      };
    },
  });

  const refresh = () => {
    void refetch();
    void queryClient.invalidateQueries({
      queryKey: ['order-issue-summary', orderId],
    });
    onChanged?.();
  };

  const issues = data?.issues ?? [];

  const columns = React.useMemo(
    () => [
      {
        key: 'issue',
        header: t('columns.issue'),
        sortable: false,
        render: (row: OrderIssueTableRow) => {
          const isOpen = !row.solved_at;
          return (
            <div className="min-w-[12rem] max-w-xs space-y-1.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant={isOpen ? 'destructive' : 'success'}>
                  {isOpen ? t('statusOpen') : t('statusSolved')}
                </Badge>
                <Badge variant="outline">{t(`codes.${row.issue_code}`)}</Badge>
                {row.priority ? (
                  <span className="text-xs text-muted-foreground">
                    {t(`priorities.${row.priority}`)}
                  </span>
                ) : null}
              </div>
              <p className="text-sm font-medium text-foreground whitespace-pre-wrap">
                {row.issue_text}
              </p>
            </div>
          );
        },
      },
      {
        key: 'reported',
        header: t('columns.reported'),
        sortable: false,
        render: (row: OrderIssueTableRow) => (
          <OrderIssueActorTimeCell
            byLabel={t('createdBy')}
            whenLabel={t('createdWhen')}
            actorName={row.created_by_name}
            actorId={row.created_by}
            at={row.created_at}
            locale={locale}
          />
        ),
      },
      {
        key: 'resolution',
        header: t('columns.resolution'),
        sortable: false,
        render: (row: OrderIssueTableRow) => (
          <p className="min-w-[8rem] max-w-xs text-sm whitespace-pre-wrap text-muted-foreground">
            {row.solved_notes?.trim() || '—'}
          </p>
        ),
      },
      {
        key: 'solved',
        header: t('columns.solved'),
        sortable: false,
        render: (row: OrderIssueTableRow) =>
          row.solved_at ? (
            <OrderIssueActorTimeCell
              byLabel={t('solvedBy')}
              whenLabel={t('solvedWhen')}
              actorName={row.solved_by_name}
              actorId={row.solved_by}
              at={row.solved_at}
              locale={locale}
            />
          ) : (
            <CmxButton
              type="button"
              variant="primary"
              size="sm"
              onClick={() => setSolveIssueId(row.id)}
            >
              {t('solve')}
            </CmxButton>
          ),
      },
    ],
    [locale, t]
  );

  return (
    <>
      <CmxDialog
        open={open}
        onOpenChange={(next) => {
          if (solveIssueId || reportOpen) return;
          onOpenChange(next);
        }}
      >
        <CmxDialogContent className="max-w-5xl w-[min(96vw,72rem)]">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('listTitle')}</CmxDialogTitle>
            <CmxDialogDescription>
              {t(`scope.${scopeLevel.toLowerCase()}`)}
              {data
                ? ` · ${t('summaryCounts', {
                    open: data.openCount,
                    total: data.totalCount,
                  })}`
                : null}
            </CmxDialogDescription>
          </CmxDialogHeader>

          <div className="max-h-[60vh] overflow-auto py-2">
            {isLoading ? (
              <div className="flex justify-center py-10">
                <CmxSpinner />
              </div>
            ) : issues.length === 0 ? (
              <CmxEmptyState
                title={t('emptyTitle')}
                description={t('emptyDescription')}
              />
            ) : (
              <CmxDataTable
                columns={columns}
                data={issues}
                paginationFooter="never"
                emptyMessage={t('emptyTitle')}
              />
            )}
          </div>

          <CmxDialogFooter>
            <CmxButton
              type="button"
              variant="secondary"
              onClick={() => onOpenChange(false)}
            >
              {tCommon('close')}
            </CmxButton>
            <CmxButton
              type="button"
              variant="primary"
              onClick={() => setReportOpen(true)}
            >
              {t('addIssue')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>

      {solveIssueId ? (
        <OrderIssueSolveDialog
          open={Boolean(solveIssueId)}
          orderId={orderId}
          issueId={solveIssueId}
          onOpenChange={(next) => {
            if (!next) setSolveIssueId(null);
          }}
          onSuccess={refresh}
        />
      ) : null}

      <OrderIssueReportDialog
        open={reportOpen}
        orderId={orderId}
        scopeLevel={scopeLevel}
        orderItemId={orderItemId}
        orderItemPieceId={orderItemPieceId}
        onOpenChange={setReportOpen}
        onSuccess={refresh}
      />
    </>
  );
}
