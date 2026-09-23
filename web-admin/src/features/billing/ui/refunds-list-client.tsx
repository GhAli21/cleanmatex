'use client';

/**
 * Refunds List — Client Component
 *
 * Displays a paginated list of all refunds for the tenant.
 *
 * B34: upgraded from read-only to actionable behind the `order_fin_refund_ui`
 * feature flag — PENDING_APPROVAL rows expose Approve, APPROVED rows expose
 * Process. No maker-checker: holding `orders:approve_refund` is sufficient even
 * when the approver is the requester (owner rule) — permission is the control,
 * enforced server-side by the route. Every action confirms in a dialog, is
 * double-click safe, and reports the typed API error codes.
 */

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';

import { CmxButton, CmxInput, Label } from '@ui/primitives';
import { CmxDataGrid } from '@ui/data-display';
import {
  CmxSelectDropdown,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
} from '@ui/forms';
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogHeader,
  CmxDialogTitle,
  CmxDialogDescription,
  CmxDialogFooter,
} from '@ui/overlays/cmx-dialog';
import { CmxStatusBadge, useMessage } from '@ui/feedback';
import { useCSRFToken, getCSRFHeader } from '@/lib/hooks/use-csrf-token';
import { useHasPermission } from '@/lib/hooks/usePermissions';
import { REFUND_METHODS, REFUND_STATUSES } from '@/lib/constants/order-financial';
import { VOUCHER_RELATED_HREFS } from '@/lib/constants/voucher-related-hrefs';

/**
 * Refund data safe for the tenant billing grid. Sensitive replay and raw metadata
 * fields remain server-only while execution and audit evidence stay reviewable.
 */
interface RefundItem {
  id: string;
  refund_no: string;
  order_id: string;
  order_no: string | null;
  refund_amount: number;
  currency_code: string;
  reason_code: string | null;
  refund_reason: string | null;
  refund_method_code: string | null;
  refund_status: string;
  refund_source_type: string;
  refund_context: string;
  reopens_due_amount: number;
  original_payment_id: string | null;
  original_credit_app_id: string | null;
  gateway_refund_id: string | null;
  cash_drawer_session_id: string | null;
  cash_drawer_id: string | null;
  cash_drawer_session_no: string | null;
  pos_session_id: string | null;
  fin_voucher_id: string | null;
  fin_voucher_trx_line_id: string | null;
  cash_drawer_movement_id: string | null;
  created_by: string | null;
  created_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  processed_at: string | null;
  updated_by: string | null;
  updated_at: string | null;
  rec_notes: string | null;
}

/** Server-owned pagination for the tenant-scoped refund list. */
interface PaginationInfo {
  page: number;
  pageSize: number;
  total: number;
}

/**
 * Props supplied by the server page after its tenant-safe refund lookup.
 * @property refunds current server page, never a cross-tenant client cache
 */
interface RefundsListClientProps {
  refunds: RefundItem[];
  pagination: PaginationInfo;
  /** B34: stage actions render only when the order_fin_refund_ui flag is on. */
  actionsEnabled?: boolean;
  /** B9: when on, processing a CASH/ORIGINAL_METHOD refund executes for real
   *  (REFUND_VOUCHER + cash-drawer CASH_OUT, or a manual-settlement reference)
   *  instead of the record-only pre-B9 behavior. */
  executionEnabled?: boolean;
}

/** A live drawer session eligible to execute a cash refund. */
interface OpenDrawerSession {
  id: string;
  session_no: string;
  drawer_name: string;
}

/** Governed refund lifecycle actions exposed by this screen. */
type StageAction = 'approve' | 'process';

/**
 * Formats an audit timestamp for the active UI locale.
 * @param iso persisted timestamp from the server action
 * @param locale active Next Intl locale
 * @returns a localized timestamp or an em dash when unavailable
 */
function fmtDate(iso: string | null | undefined, locale: string): string {
  if (!iso) return '—';
  return new Intl.DateTimeFormat(locale, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  }).format(new Date(iso));
}

/**
 * Maps lifecycle stages to the design-system status semantics.
 * @param status governed refund status from the financial lifecycle
 * @returns Cmx status badge variant
 */
function refundStatusVariant(status: string): 'warning' | 'info' | 'success' | 'default' {
  if (status === REFUND_STATUSES.PENDING_APPROVAL) return 'warning';
  if (status === REFUND_STATUSES.APPROVED) return 'info';
  if (status === REFUND_STATUSES.PROCESSED) return 'success';
  return 'default';
}

/**
 *
 * Keeps governed actions beside the full financial evidence without exposing
 * idempotency keys or raw metadata to browser clients.
 * @param props server-provided refund page and feature gates
 */
export default function RefundsListClient({
  refunds,
  pagination,
  actionsEnabled = false,
  executionEnabled = false,
}: RefundsListClientProps) {
  const t = useTranslations('billing.refunds');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const dir = locale === 'ar' ? 'rtl' : 'ltr';
  const router = useRouter();
  const { showSuccess, showError } = useMessage();
  const { token: csrfToken } = useCSRFToken();
  const canApprove = useHasPermission('orders', 'approve_refund');
  const canProcess = useHasPermission('orders', 'process_refund');

  const [pendingAction, setPendingAction] = useState<{ refund: RefundItem; action: StageAction } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // B9: execution inputs collected only for the CASH/ORIGINAL_METHOD process dialog.
  const [cashDrawerSessionId, setCashDrawerSessionId] = useState('');
  const [manualSettlementReference, setManualSettlementReference] = useState('');
  const [drawerSessions, setDrawerSessions] = useState<OpenDrawerSession[]>([]);
  const [drawerSessionsLoading, setDrawerSessionsLoading] = useState(false);

  const requiresCashDrawer =
    executionEnabled &&
    pendingAction?.action === 'process' &&
    pendingAction.refund.refund_method_code === REFUND_METHODS.CASH;
  const requiresManualReference =
    executionEnabled &&
    pendingAction?.action === 'process' &&
    pendingAction.refund.refund_method_code === REFUND_METHODS.ORIGINAL_METHOD;

  useEffect(() => {
    if (!requiresCashDrawer) return;
    setDrawerSessionsLoading(true);
    fetch('/api/v1/cash-drawers')
      .then(async (res) => {
        const json = await res.json().catch(() => null);
        if (!json?.success) return [];
        const drawers = (json.data ?? []) as Array<{
          id: string;
          drawer_name: string;
          currentSession: { id: string; session_no: string } | null;
        }>;
        return drawers
          .filter((d) => d.currentSession)
          .map((d) => ({
            id: d.currentSession!.id,
            session_no: d.currentSession!.session_no,
            drawer_name: d.drawer_name,
          }));
      })
      .then(setDrawerSessions)
      .catch(() => setDrawerSessions([]))
      .finally(() => setDrawerSessionsLoading(false));
  }, [requiresCashDrawer]);

  const showActionsColumn = actionsEnabled && (canApprove || canProcess);

  const totalPages = Math.ceil(pagination.total / pagination.pageSize);

  function handlePage(page: number) {
    const sp = new URLSearchParams(window.location.search);
    sp.set('page', String(page));
    router.push(`?${sp.toString()}`);
  }

  const canSubmitProcess =
    pendingAction?.action !== 'process' ||
    !executionEnabled ||
    (requiresCashDrawer ? !!cashDrawerSessionId : true) &&
    (requiresManualReference ? manualSettlementReference.trim().length > 0 : true);

  const columns: ColumnDef<RefundItem, unknown>[] = [
    {
      accessorKey: 'refund_no',
      header: t('refundNo'),
      cell: ({ getValue }) => <span className="font-mono text-xs font-medium">{getValue() as string}</span>,
      meta: { isCopyable: true },
    },
    {
      accessorKey: 'order_no',
      header: t('order'),
      cell: ({ row }) => (
        <Link
          href={`${VOUCHER_RELATED_HREFS.order(row.original.order_id)}?tab=financial`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.order_no ?? row.original.order_id}
        </Link>
      ),
      meta: { isCopyable: true },
    },
    {
      accessorKey: 'refund_amount',
      header: t('amount'),
      cell: ({ row }) => (
        <span className="font-mono font-medium tabular-nums">
          {row.original.refund_amount.toFixed(3)} <span className="text-xs text-muted-foreground">{row.original.currency_code}</span>
        </span>
      ),
      meta: { disableFilter: true },
    },
    {
      accessorKey: 'refund_status',
      header: t('status'),
      cell: ({ getValue }) => {
        const status = getValue() as string;
        return <CmxStatusBadge label={t(`statusLabels.${status}` as never)} variant={refundStatusVariant(status)} size="sm" />;
      },
    },
    {
      accessorKey: 'refund_method_code',
      header: t('method'),
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value ? t(`methodLabels.${value}` as never) : '—';
      },
    },
    {
      accessorKey: 'refund_source_type',
      header: t('sourceType'),
      cell: ({ getValue }) => t(`sourceTypeLabels.${getValue() as string}` as never),
      meta: { hideBelow: 'lg' },
    },
    {
      accessorKey: 'refund_context',
      header: t('context'),
      cell: ({ getValue }) => t(`contextLabels.${getValue() as string}` as never),
      meta: { hideBelow: 'lg' },
    },
    {
      accessorKey: 'reopens_due_amount',
      header: t('reopensDueAmount'),
      cell: ({ row }) => `${row.original.reopens_due_amount.toFixed(3)} ${row.original.currency_code}`,
      meta: { hideBelow: 'lg', disableFilter: true },
    },
    {
      accessorKey: 'reason_code',
      header: t('reason'),
      cell: ({ getValue }) => {
        const value = getValue() as string | null;
        return value ? t(`reasonLabels.${value}` as never) : '—';
      },
    },
    { accessorKey: 'refund_reason', header: t('reasonNote'), meta: { hideBelow: 'lg', isCopyable: true } },
    { accessorKey: 'original_payment_id', header: t('originalPaymentId'), meta: { hideBelow: 'lg', isCopyable: true } },
    { accessorKey: 'original_credit_app_id', header: t('originalCreditAppId'), meta: { hideBelow: 'lg', isCopyable: true } },
    {
      accessorKey: 'fin_voucher_id',
      header: t('financeVoucher'),
      cell: ({ row }) => row.original.fin_voucher_id ? (
        <Link href={VOUCHER_RELATED_HREFS.voucher(row.original.fin_voucher_id)} className="font-mono text-xs text-primary hover:underline">
          {row.original.fin_voucher_id}
        </Link>
      ) : '—',
      meta: { hideBelow: 'lg', isCopyable: true },
    },
    { accessorKey: 'fin_voucher_trx_line_id', header: t('voucherLineId'), meta: { hideBelow: 'lg', isCopyable: true } },
    {
      accessorKey: 'cash_drawer_session_id',
      header: t('cashDrawerSession'),
      cell: ({ row }) => row.original.cash_drawer_session_id && row.original.cash_drawer_id ? (
        <Link
          href={VOUCHER_RELATED_HREFS.cashDrawerSession(row.original.cash_drawer_id, row.original.cash_drawer_session_id)}
          className="font-mono text-xs text-primary hover:underline"
        >
          {row.original.cash_drawer_session_no ?? row.original.cash_drawer_session_id}
        </Link>
      ) : row.original.cash_drawer_session_id ?? '—',
      meta: { hideBelow: 'lg', isCopyable: true },
    },
    { accessorKey: 'cash_drawer_movement_id', header: t('cashDrawerMovementId'), meta: { hideBelow: 'lg', isCopyable: true } },
    { accessorKey: 'pos_session_id', header: t('posSessionId'), meta: { hideBelow: 'lg', isCopyable: true } },
    { accessorKey: 'gateway_refund_id', header: t('settlementReference'), meta: { hideBelow: 'lg', isCopyable: true } },
    { accessorKey: 'created_by', header: t('requestedBy'), meta: { hideBelow: 'lg', isCopyable: true } },
    { accessorKey: 'created_at', header: t('requestedAt'), cell: ({ getValue }) => fmtDate(getValue() as string | null, locale), meta: { hideBelow: 'md' } },
    { accessorKey: 'approved_by', header: t('approvedBy'), meta: { hideBelow: 'lg', isCopyable: true } },
    { accessorKey: 'approved_at', header: t('approvedAt'), cell: ({ getValue }) => fmtDate(getValue() as string | null, locale), meta: { hideBelow: 'lg' } },
    { accessorKey: 'processed_at', header: t('processedAt'), cell: ({ getValue }) => fmtDate(getValue() as string | null, locale), meta: { hideBelow: 'md' } },
    { accessorKey: 'updated_by', header: t('updatedBy'), meta: { hideBelow: 'lg', isCopyable: true } },
    { accessorKey: 'updated_at', header: t('updatedAt'), cell: ({ getValue }) => fmtDate(getValue() as string | null, locale), meta: { hideBelow: 'lg' } },
    { accessorKey: 'rec_notes', header: t('recordNotes'), meta: { hideBelow: 'lg', isCopyable: true } },
  ];

  if (showActionsColumn) {
    columns.push({
      id: 'actions',
      header: t('actions.column'),
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Link href={`${VOUCHER_RELATED_HREFS.order(row.original.order_id)}?tab=financial`}>
            <CmxButton size="sm" variant="ghost">{t('viewDetails')}</CmxButton>
          </Link>
          {row.original.refund_status === REFUND_STATUSES.PENDING_APPROVAL && canApprove ? (
            <CmxButton size="sm" variant="outline" onClick={() => setPendingAction({ refund: row.original, action: 'approve' })}>
              {t('actions.approve')}
            </CmxButton>
          ) : null}
          {row.original.refund_status === REFUND_STATUSES.APPROVED && canProcess ? (
            <CmxButton size="sm" onClick={() => setPendingAction({ refund: row.original, action: 'process' })}>
              {t('actions.process')}
            </CmxButton>
          ) : null}
        </div>
      ),
      enableSorting: false,
      enableHiding: false,
      meta: { disableFilter: true },
    });
  }

  async function executeStageAction() {
    if (!pendingAction || submitting || !canSubmitProcess) return;
    setSubmitting(true);
    try {
      const body =
        pendingAction.action === 'process' && executionEnabled
          ? JSON.stringify({
              cashDrawerSessionId: requiresCashDrawer ? cashDrawerSessionId : undefined,
              manualSettlementReference: requiresManualReference
                ? manualSettlementReference.trim()
                : undefined,
            })
          : undefined;
      const response = await fetch(
        `/api/v1/orders/refunds/${pendingAction.refund.id}/${pendingAction.action}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', ...getCSRFHeader(csrfToken) },
          body,
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
      setCashDrawerSessionId('');
      setManualSettlementReference('');
      router.refresh();
    } catch {
      showError(t('actions.failed'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-3">
      <CmxDataGrid
        data={refunds}
        columns={columns}
        getRowId={(refund) => refund.id}
        dir={dir}
        initialPageSize={pagination.pageSize}
        pageSizeOptions={[pagination.pageSize]}
        enableGlobalSearch
        enableColumnVisibility
        enableDensityToggle
        enableStickyFirstColumn
        enableColumnBorders
        enableScrollEdgeHints
        tableWrapperClassName="max-h-[calc(100vh-22rem)]"
        columnVisibilityStorageKey="billing-refunds-grid-columns"
        labels={{ globalSearchPlaceholder: tCommon('search'), empty: t('noRefunds') }}
      />

      {totalPages > 1 ? (
        <div className="flex items-center justify-between rounded-lg border border-border px-4 py-3">
          <span className="text-sm text-muted-foreground">
            {tCommon('pagination', { page: pagination.page, totalPages })}
          </span>
          <div className="flex gap-2 rtl:flex-row-reverse">
            <CmxButton variant="outline" size="sm" onClick={() => handlePage(pagination.page - 1)} disabled={pagination.page <= 1}>
              {tCommon('previous')}
            </CmxButton>
            <CmxButton variant="outline" size="sm" onClick={() => handlePage(pagination.page + 1)} disabled={pagination.page >= totalPages}>
              {tCommon('next')}
            </CmxButton>
          </div>
        </div>
      ) : null}

      {/* B34 stage-action confirmation (double-click safe via `submitting`) */}
      <CmxDialog
        open={pendingAction != null}
        onOpenChange={(open) => {
          if (!open && !submitting) {
            setPendingAction(null);
            setCashDrawerSessionId('');
            setManualSettlementReference('');
          }
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

          {requiresCashDrawer ? (
            <div className="space-y-2">
              <Label>{t('execution.cashDrawerLabel')} *</Label>
              {drawerSessionsLoading ? (
                <p className="text-xs text-muted-foreground">{tCommon('loading')}</p>
              ) : drawerSessions.length === 0 ? (
                <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {t('execution.noOpenDrawerSessions')}
                </p>
              ) : (
                <CmxSelectDropdown value={cashDrawerSessionId} onValueChange={setCashDrawerSessionId}>
                  <CmxSelectDropdownTrigger className="w-full">
                    <CmxSelectDropdownValue
                      displayValue={
                        drawerSessions.find((s) => s.id === cashDrawerSessionId)
                          ? `${drawerSessions.find((s) => s.id === cashDrawerSessionId)!.drawer_name} • ${drawerSessions.find((s) => s.id === cashDrawerSessionId)!.session_no}`
                          : undefined
                      }
                      placeholder={t('execution.selectDrawerPlaceholder')}
                    />
                  </CmxSelectDropdownTrigger>
                  <CmxSelectDropdownContent>
                    {drawerSessions.map((s) => (
                      <CmxSelectDropdownItem key={s.id} value={s.id}>
                        {s.drawer_name} • {s.session_no}
                      </CmxSelectDropdownItem>
                    ))}
                  </CmxSelectDropdownContent>
                </CmxSelectDropdown>
              )}
            </div>
          ) : null}

          {requiresManualReference ? (
            <div className="space-y-2">
              <Label htmlFor="refund-manual-ref">{t('execution.manualSettlementReferenceLabel')} *</Label>
              <CmxInput
                id="refund-manual-ref"
                value={manualSettlementReference}
                placeholder={t('execution.manualSettlementReferencePlaceholder')}
                onChange={(e) => setManualSettlementReference(e.target.value)}
              />
            </div>
          ) : null}

          <CmxDialogFooter>
            <CmxButton
              variant="outline"
              disabled={submitting}
              onClick={() => {
                setPendingAction(null);
                setCashDrawerSessionId('');
                setManualSettlementReference('');
              }}
            >
              {t('actions.cancel')}
            </CmxButton>
            <CmxButton disabled={submitting || !canSubmitProcess} onClick={executeStageAction}>
              {submitting ? t('actions.working') : t('actions.confirm')}
            </CmxButton>
          </CmxDialogFooter>
        </CmxDialogContent>
      </CmxDialog>
    </div>
  );
}
