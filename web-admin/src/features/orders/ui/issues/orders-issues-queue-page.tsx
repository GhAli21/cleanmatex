/**
 * Tenant-wide order issues queue.
 */

'use client';

import * as React from 'react';
import Link from 'next/link';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { CmxButton, CmxSpinner } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { CmxEmptyState } from '@ui/data-display';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { OrderIssueSolveDialog } from './order-issue-solve-dialog';

interface QueueIssue {
  id: string;
  order_id: string;
  order_no: string | null;
  scope_level: string;
  issue_code: string;
  issue_text: string;
  priority: string | null;
  created_at: string | null;
  solved_at: string | null;
}

/**
 * Dashboard issues queue screen.
 */
export function OrdersIssuesQueuePage() {
  const t = useTranslations('orders.issues');
  const queryClient = useQueryClient();
  const [status, setStatus] = React.useState<'open' | 'all'>('open');
  const [solveTarget, setSolveTarget] = React.useState<{
    orderId: string;
    issueId: string;
  } | null>(null);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['tenant-order-issues', status],
    queryFn: async () => {
      const response = await fetch(
        `/api/v1/orders/issues?status=${status === 'open' ? 'open' : 'all'}`
      );
      const json = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          (json as { error?: string }).error || t('listFailed')
        );
      }
      return ((json as { data?: QueueIssue[] }).data ?? []) as QueueIssue[];
    },
  });

  const issues = data ?? [];

  return (
    <div className="space-y-4 p-4 md:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{t('pageTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('pageDescription')}</p>
        </div>
        <div className="flex gap-2">
          <CmxButton
            type="button"
            size="sm"
            variant={status === 'open' ? 'primary' : 'secondary'}
            onClick={() => setStatus('open')}
          >
            {t('filterOpen')}
          </CmxButton>
          <CmxButton
            type="button"
            size="sm"
            variant={status === 'all' ? 'primary' : 'secondary'}
            onClick={() => setStatus('all')}
          >
            {t('filterAll')}
          </CmxButton>
        </div>
      </div>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('listTitle')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="space-y-3">
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
            issues.map((issue) => {
              const openIssue = !issue.solved_at;
              return (
                <div
                  key={issue.id}
                  className="flex flex-col gap-2 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link
                        href={`/dashboard/processing?orderId=${issue.order_id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {issue.order_no ?? issue.order_id.slice(0, 8)}
                      </Link>
                      <Badge variant={openIssue ? 'destructive' : 'success'}>
                        {openIssue ? t('statusOpen') : t('statusSolved')}
                      </Badge>
                      <Badge variant="outline">
                        {t(`codes.${issue.issue_code}`)}
                      </Badge>
                    </div>
                    <p className="text-sm">{issue.issue_text}</p>
                  </div>
                  {openIssue ? (
                    <CmxButton
                      type="button"
                      size="sm"
                      variant="primary"
                      onClick={() =>
                        setSolveTarget({
                          orderId: issue.order_id,
                          issueId: issue.id,
                        })
                      }
                    >
                      {t('solve')}
                    </CmxButton>
                  ) : null}
                </div>
              );
            })
          )}
        </CmxCardContent>
      </CmxCard>

      {solveTarget ? (
        <OrderIssueSolveDialog
          open={Boolean(solveTarget)}
          orderId={solveTarget.orderId}
          issueId={solveTarget.issueId}
          onOpenChange={(next) => {
            if (!next) setSolveTarget(null);
          }}
          onSuccess={() => {
            void refetch();
            void queryClient.invalidateQueries({
              queryKey: ['tenant-order-issues'],
            });
          }}
        />
      ) : null}
    </div>
  );
}
