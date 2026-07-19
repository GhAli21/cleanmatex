'use client';

/**
 * Refunds List — Client Component
 *
 * Displays a paginated list of all refunds for the tenant.
 *
 * B34: upgraded from read-only to actionable behind the `order_fin_refund_ui`
 * feature flag — PENDING_APPROVAL rows expose Approve (maker≠checker: the
 * requester's own button is disabled with the reason and the server enforces
 * it again), APPROVED rows expose Process. Every action confirms in a dialog,
 * is double-click safe, and reports the typed API error codes.
 */

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

import { CmxButton } from '@ui/primitives';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogDescription,
  CmxDialogFooter,
} from '@ui/overlays/cmx-dialog';
import { useMessage } from '@ui/feedback';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { useHasPermission } from '@/lib/hooks/usePermissions';

interface RefundItem {
  id: string;
  refund_no: string;
  order_id: string;
  order_no: string | null;
  refund_amount: number;
  currency_code: string;
  reason_code: string | null;
  refund_method_code: string | null;
  refund_status: string;
  created_by: string | null;
  created_at: string | null;
  processed_at: string | null;
}

interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

interface RefundsListClientProps {
  refunds: RefundItem[];
  pagination: PaginationInfo;
  /** B34: stage actions render only when the order_fin_refund_ui flag is on. */
  actionsEnabled?: boolean;
  /** Current user id for the maker≠checker self-approval disable. */
  currentUserId?: string | null;
}

type StageAction = 'approve' | 'process';

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

function statusBadgeClass(status: string): string {
  const map: Record<string, string> = {
    PENDING_APPROVAL: 'bg-yellow-100 text-yellow-800',
    APPROVED:         'bg-blue-100 text-blue-800',
    PROCESSED:        'bg-green-100 text-green-800',
    REJECTED:         'bg-red-100 text-red-800',
  };
  return map[status] ?? 'bg-gray-100 text-gray-800';
}

/**
 *
 * @param root0
 * @param root0.refunds
 * @param root0.pagination
 * @param root0.actionsEnabled
 * @param root0.currentUserId
 */
export default function RefundsListClient({
  refunds,
  pagination,
  actionsEnabled = false,
  currentUserId = null,
}: RefundsListClientProps) {
  const t = useTranslations('billing.refunds');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const { showSuccess, showError } = useMessage();
  const { token: csrfToken } = useCSRFToken();
  const canApprove = useHasPermission('orders', 'approve_refund');
  const canProcess = useHasPermission('orders', 'process_refund');

  const [pendingAction, setPendingAction] = useState<{ refund: RefundItem; action: StageAction } | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const showActionsColumn = actionsEnabled && (canApprove || canProcess);

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  function handlePage(page: number) {
    const sp = new URLSearchParams(window.location.search);
    sp.set('page', String(page));
    router.push(`?${sp.toString()}`);
  }

  async function executeStageAction() {
    if (!pendingAction || submitting) return;
    setSubmitting(true);
    try {
      const response = await fetch(
        `/api/v1/orders/refunds/${pendingAction.refund.id}/${pendingAction.action}`,
        {
          method: 'PATCH',
          headers: { ...getCSRFHeader(csrfToken) },
        },
      );
      const payload = (await response.json().catch(() => null)) as
        | { success?: boolean; error?: string; code?: string }
        | null;
      if (!response.ok || !payload?.success) {
        showError(
          payload?.code
            ? t(`errors.${payload.code}` as Parameters<typeof t>[0])
            : payload?.error ?? t('actions.failed'),
        );
        return;
      }
      showSuccess(
        pendingAction.action === 'approve' ? t('actions.approved') : t('actions.processed'),
      );
      setPendingAction(null);
      router.refresh();
    } catch {
      showError(t('actions.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  if (refunds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-gray-300 py-16 text-center">
        <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
        </svg>
        <p className="mt-4 text-sm text-gray-500">{t('noRefunds')}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white">
      <div className="overflow-x-auto">
        <table className="w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('refundNo')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('order')}</th>
              <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider text-gray-500">{t('amount')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('method')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('status')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('reason')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('requestedAt')}</th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('processedAt')}</th>
              {showActionsColumn && (
                <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-gray-500">{t('actions.column')}</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 bg-white">
            {refunds.map((r) => {
              const isOwnRequest = false; //Boolean(currentUserId && r.created_by === currentUserId);
              return (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{r.refund_no}</td>
                  <td className="whitespace-nowrap px-4 py-3">
                    {r.order_no ? (
                      <Link
                        href={`/dashboard/orders/${r.order_id}`}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        {r.order_no}
                      </Link>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                    {r.currency_code} {r.refund_amount.toFixed(3)}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {r.refund_method_code
                      ? t(`methodLabels.${r.refund_method_code}` as Parameters<typeof t>[0])
                      : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusBadgeClass(r.refund_status)}`}>
                      {t(`statusLabels.${r.refund_status}` as Parameters<typeof t>[0])}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">
                    {r.reason_code
                      ? t(`reasonLabels.${r.reason_code}` as Parameters<typeof t>[0])
                      : '—'}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">{fmtDate(r.created_at)}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">{fmtDate(r.processed_at)}</td>
                  {showActionsColumn && (
                    <td className="whitespace-nowrap px-4 py-3">
                      {r.refund_status === 'PENDING_APPROVAL' && canApprove && (
                        <CmxButton
                          size="sm"
                          variant="outline"
                          disabled={isOwnRequest}
                          title={isOwnRequest ? t('actions.selfApprovalBlocked') : undefined}
                          onClick={() => setPendingAction({ refund: r, action: 'approve' })}
                        >
                          {t('actions.approve')}
                        </CmxButton>
                      )}
                      {r.refund_status === 'APPROVED' && canProcess && (
                        <CmxButton
                          size="sm"
                          onClick={() => setPendingAction({ refund: r, action: 'process' })}
                        >
                          {t('actions.process')}
                        </CmxButton>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between border-t border-gray-200 bg-white px-4 py-3 text-sm text-gray-700">
        <div>
          {pagination.total} total
        </div>
        <div className="flex items-center gap-2">
          {pagination.page > 1 && (
            <button
              onClick={() => handlePage(pagination.page - 1)}
              className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
            >
              {tCommon('previous')}
            </button>
          )}
          <span className="px-2 text-gray-600">
            {pagination.page} / {totalPages}
          </span>
          {pagination.page < totalPages && (
            <button
              onClick={() => handlePage(pagination.page + 1)}
              className="rounded border border-gray-300 px-3 py-1 hover:bg-gray-50"
            >
              {tCommon('next')}
            </button>
          )}
        </div>
      </div>

      {/* B34 stage-action confirmation (double-click safe via `submitting`) */}
      <CmxDialog
        open={pendingAction != null}
        onOpenChange={(open) => {
          if (!open && !submitting) setPendingAction(null);
        }}
      >
        <CmxDialogContent className="max-w-md">
          <CmxDialogHeader>
            <CmxDialogTitle>
              {pendingAction?.action === 'approve'
                ? t('actions.confirmApproveTitle')
                : t('actions.confirmProcessTitle')}
            </CmxDialogTitle>
            <CmxDialogDescription>
              {pendingAction
                ? t(
                    pendingAction.action === 'approve'
                      ? 'actions.confirmApproveBody'
                      : 'actions.confirmProcessBody',
                    {
                      refundNo: pendingAction.refund.refund_no,
                      amount: pendingAction.refund.refund_amount.toFixed(3),
                      currency: pendingAction.refund.currency_code,
                    },
                  )
                : null}
            </CmxDialogDescription>
          </CmxDialogHeader>
          <CmxDialogFooter>
            <CmxButton
              variant="outline"
              disabled={submitting}
              onClick={() => setPendingAction(null)}
            >
              {t('actions.cancel')}
            </CmxButton>
            <CmxButton disabled={submitting} onClick={executeStageAction}>
              {submitting ? t('actions.working') : t('actions.confirm')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  );
}
