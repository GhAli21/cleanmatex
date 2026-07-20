/**
 * Lists issues for a scope; Solve + Add issue actions.
 */

'use client';

import * as React from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogFooter,
  CmxDialogDescription,
} from '@ui/overlays';
import { CmxButton } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxEmptyState } from '@ui/data-display';
import { CmxSpinner } from '@ui/primitives';
import { OrderIssueSolveDialog } from './order-issue-solve-dialog';
import { OrderIssueReportDialog } from './order-issue-report-dialog';
import type { OrderIssueScope } from '@/lib/constants/order-issues';

export interface OrderIssuesListDialogProps {
  open: boolean;
  orderId: string;
  scopeLevel: OrderIssueScope;
  orderItemId?: string | null;
  orderItemPieceId?: string | null;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}

interface IssueRow {
  id: string;
  issue_code: string;
  issue_text: string;
  priority: string | null;
  scope_level: string;
  created_at: string | null;
  solved_at: string | null;
  solved_notes: string | null;
}

/**
 * Scoped issues list with solve / add.
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
        issues: ((json as { data?: IssueRow[] }).data ?? []) as IssueRow[],
        openCount: (json as { meta?: { openCount?: number } }).meta?.openCount ?? 0,
        totalCount:
          (json as { meta?: { totalCount?: number } }).meta?.totalCount ?? 0,
      };
    },
  });

  const refresh = () => {
    void refetch();
    void queryClient.invalidateQueries({ queryKey: ['order-issue-summary', orderId] });
    onChanged?.();
  };

  const issues = data?.issues ?? [];

  return (
    <>
      <CmxDialog
        open={open}
        onOpenChange={(next) => {
          if (solveIssueId || reportOpen) return;
          onOpenChange(next);
        }}
      >
        <CmxDialogContent className="max-w-lg">
          <CmxDialogHeader>
            <CmxDialogTitle>{t('listTitle')}</CmxDialogTitle>
            <CmxDialogDescription>
              {t(`scope.${scopeLevel.toLowerCase()}`)}
            </CmxDialogDescription>
          </CmxDialogHeader>

          <div className="max-h-[50vh] space-y-3 overflow-y-auto py-2">
            {isLoading ? (
              <div className="flex justify-center py-8">
                <CmxSpinner />
              </div>
            ) : issues.length === 0 ? (
              <CmxEmptyState
                title={t('emptyTitle')}
                description={t('emptyDescription')}
              />
            ) : (
              issues.map((issue) => {
                const openIssue = !issue.solved_at;
                return (
                  <div
                    key={issue.id}
                    className="rounded-md border border-border p-3 space-y-2"
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant={openIssue ? 'destructive' : 'success'}>
                        {openIssue ? t('statusOpen') : t('statusSolved')}
                      </Badge>
                      <Badge variant="outline">
                        {t(`codes.${issue.issue_code}`)}
                      </Badge>
                      {issue.priority ? (
                        <span className="text-xs text-muted-foreground">
                          {t(`priorities.${issue.priority}`)}
                        </span>
                      ) : null}
                    </div>
                    <p className="text-sm">{issue.issue_text}</p>
                    {issue.solved_notes ? (
                      <p className="text-xs text-muted-foreground">
                        {t('solvedNotesLabel')}: {issue.solved_notes}
                      </p>
                    ) : null}
                    {openIssue ? (
                      <CmxButton
                        type="button"
                        variant="primary"
                        size="sm"
                        onClick={() => setSolveIssueId(issue.id)}
                      >
                        {t('solve')}
                      </CmxButton>
                    ) : null}
                  </div>
                );
              })
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
