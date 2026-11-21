/**
 * Processing Screen - Detail Page
 * Per-item dynamic step tracking, piece-level workspace, financial summary,
 * and policy-driven WorkflowActionBar completion.
 */

'use client';

import { useCallback, useMemo, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import { useQueries, useQuery } from '@tanstack/react-query';
import { useLocale, useTranslations } from 'next-intl';
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  Circle,
  ExternalLink,
  ListChecks,
  Loader2,
  MapPin,
  PackageOpen,
  RefreshCw,
} from 'lucide-react';
import {
  CmxButton,
  CmxCard,
  CmxCardContent,
  CmxCardDescription,
  CmxCardHeader,
  CmxCardTitle,
  CmxSkeleton,
} from '@ui/primitives';
import { CmxCodeChip, CmxEmptyState } from '@ui/data-display';
import {
  CmxStatusBadge,
  CmxSummaryMessage,
  cmxMessage,
  type CmxBadgeTone,
} from '@ui/feedback';
import { FILE_REF_TYPES, FILE_SOURCES } from '@/lib/constants/file-util';
import { ORDER_PAYMENT_STATUS } from '@/lib/constants/order-financial';
import { ORDER_ISSUE_SCOPE } from '@/lib/constants/order-issues';
import { PRIORITY_LEVELS } from '@/lib/constants/order-types';
import { useAuth } from '@/lib/auth/auth-context';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { useTenantSettingsWithDefaults } from '@/lib/hooks/useTenantSettings';
import type { ProcessingStepConfig } from '@/lib/services/processing-steps-service';
import { useBilingual } from '@/lib/utils/bilingual';
import { readCanonicalOrderFinancialSnapshot } from '@/lib/utils/order-financial-snapshot';
import { normalizeOrderPaymentStatus } from '@/lib/utils/order-payment-status';
import {
  getOrderFromStateResponse,
  mapOrderCustomerFromStateRow,
} from '@/lib/utils/order-state-response';
import { resolveSafeDashboardReturnUrl } from '@/lib/utils/safe-dashboard-return-url';
import { buildOrderDetailsHref } from '@lib/orders/order-details-navigation';
import { OrderPiecesManager } from '@features/orders/ui/OrderPiecesManager';
import { OrderStageFiles } from '@features/orders/ui/order-stage-files';
import { PiecesErrorBoundary } from '@features/orders/ui/PiecesErrorBoundary';
import { OrderIssueRowActions } from '@features/orders/ui/issues/order-issue-row-actions';
import { PiecePhotosControl } from '@features/orders/ui/pieces/piece-photos';
import { WorkflowActionBar } from '@features/workflow/ui/WorkflowActionBar';

const SimpleProcessingDialog = dynamic(
  () =>
    import('@features/workflow/ui/simple-processing-dialog').then(
      (m) => m.SimpleProcessingDialog
    ),
  { ssr: false }
);

interface ProcessingDetailItem {
  id: string;
  product_name: string;
  product_name2?: string | null;
  quantity: number;
  quantity_ready: number;
  service_category_code: string | null;
  item_status: string;
  item_last_step: string | null;
  item_is_rejected: boolean;
  color: string | null;
  brand: string | null;
  has_stain: boolean;
  has_damage: boolean;
  notes: string | null;
}

interface ProcessingDetailOrder {
  id: string;
  order_no: string;
  branch_id: string | null;
  status: string;
  priority: string;
  has_issue: boolean;
  is_rejected: boolean;
  rack_location: string;
  ready_by_at: string | null;
  created_at: string | null;
  notes: string | null;
  payment_status: string;
  payment_type_code: string | null;
  subtotal: number;
  tax: number;
  total: number;
  paid_amount: number;
  outstanding_amount: number;
  customer: {
    name: string;
    name2?: string;
    phone: string;
  };
  items: ProcessingDetailItem[];
}

interface ResolvedStep {
  step_code: string;
  step_seq: number;
  label: string;
}

const DEFAULT_FALLBACK_STEPS: ReadonlyArray<{ code: string; seq: number }> = [
  { code: 'sorting', seq: 1 },
  { code: 'pretreatment', seq: 2 },
  { code: 'washing', seq: 3 },
  { code: 'drying', seq: 4 },
  { code: 'finishing', seq: 5 },
];

const KNOWN_STATUS_KEYS = new Set([
  'processing',
  'sorting',
  'pretreatment',
  'washing',
  'drying',
  'finishing',
  'in_wash',
  'in_dry',
  'in_finish',
  'qc',
  'qa',
  'assembly',
]);

function getLocalizedStatus(
  status: string,
  tStatus: (key: string) => string
): string {
  const normalized = (status || 'processing').trim().toLowerCase();
  if (KNOWN_STATUS_KEYS.has(normalized)) {
    return tStatus(normalized);
  }
  return normalized
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function getSlaInfo(
  readyByAt: string | null,
  nowMs: number,
  tTable: (key: string) => string
): { label: string; tone: CmxBadgeTone } | null {
  if (!readyByAt) return null;
  const due = new Date(readyByAt);
  if (Number.isNaN(due.getTime())) return null;
  const diffMs = due.getTime() - nowMs;
  if (diffMs < 0) return { label: tTable('slaOverdue'), tone: 'danger' };
  if (diffMs <= 2 * 60 * 60 * 1000) return { label: tTable('slaDueSoon'), tone: 'warning' };
  const now = new Date(nowMs);
  if (
    due.getFullYear() === now.getFullYear() &&
    due.getMonth() === now.getMonth() &&
    due.getDate() === now.getDate()
  ) {
    return { label: tTable('slaToday'), tone: 'info' };
  }
  return null;
}

function formatDateTime(value: string | null, locale: string): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(d);
}

/**
 * Per-order processing detail workspace (`/dashboard/processing/[id]`).
 * Uses policy-driven `WorkflowActionBar` as the single stage-completion surface.
 */
export default function ProcessingDetailPage() {
  const params = useParams<{ id?: string }>();
  const searchParams = useSearchParams();
  const locale = useLocale();
  const getBilingual = useBilingual();
  const { formatMoneyWithCode } = useTenantCurrency();
  const { currentTenant, isLoading: authLoading } = useAuth();

  const t = useTranslations('processing');
  const tTable = useTranslations('processing.table');
  const tModal = useTranslations('processing.modal');
  const tDetail = useTranslations('processing.detail');
  const tStatus = useTranslations('processing.status');
  const tSteps = useTranslations('processing.steps');
  const tPieces = useTranslations('newOrder.pieces');

  const orderId = typeof params?.id === 'string' ? params.id : undefined;
  const returnUrl = resolveSafeDashboardReturnUrl(
    searchParams.get('returnUrl'),
    '/dashboard/processing'
  );
  const orderDetailsReturnUrl = orderId
    ? `/dashboard/processing/${orderId}`
    : '/dashboard/processing';

  const { trackByPiece } = useTenantSettingsWithDefaults(currentTenant?.tenant_id || '');
  const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(new Set());
  const [recordingStepKey, setRecordingStepKey] = useState<string | null>(null);
  const [actionBarKey, setActionBarKey] = useState(0);
  const [isSimpleOpen, setIsSimpleOpen] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());

  const {
    data: order,
    isLoading,
    isFetching,
    error: orderQueryError,
    refetch: refetchOrder,
  } = useQuery<ProcessingDetailOrder | null>({
    queryKey: ['order-processing-detail', orderId, currentTenant?.tenant_id],
    enabled: Boolean(currentTenant?.tenant_id && orderId),
    queryFn: async () => {
      const res = await fetch(`/api/v1/orders/${orderId}/state`);
      const json = (await res.json()) as {
        success?: boolean;
        error?: string;
        data?: { order?: unknown; items?: unknown[] };
        order?: unknown;
        items?: unknown[];
      };
      if (!res.ok) {
        throw new Error(json.error || t('error.loadingFailed'));
      }
      const rawOrder = getOrderFromStateResponse(json);
      if (!rawOrder || typeof rawOrder !== 'object') {
        return null;
      }

      const raw = rawOrder as Record<string, unknown>;
      const rawItems = (json.data?.items ?? json.items ?? []) as Array<Record<string, unknown>>;
      const items: ProcessingDetailItem[] = rawItems.map((item) => {
        const product = item.org_product_data_mst as
          | { product_name?: string; product_name2?: string | null }
          | undefined;
        return {
          id: String(item.id),
          product_name:
            product?.product_name ||
            (item.product_name as string | undefined) ||
            t('modal.unknownItem'),
          product_name2:
            product?.product_name2 ?? (item.product_name2 as string | null | undefined) ?? null,
          quantity: Number(item.quantity ?? 0),
          quantity_ready: Number(item.quantity_ready ?? 0),
          service_category_code:
            (item.service_category_code as string | null | undefined) ?? null,
          item_status: (item.item_status as string | undefined) || 'pending',
          item_last_step: (item.item_last_step as string | null | undefined) ?? null,
          item_is_rejected: Boolean(item.item_is_rejected),
          color: (item.color as string | null | undefined) ?? null,
          brand: (item.brand as string | null | undefined) ?? null,
          has_stain: Boolean(item.has_stain),
          has_damage: Boolean(item.has_damage),
          notes: (item.notes as string | null | undefined) ?? null,
        };
      });

      const snapshot = readCanonicalOrderFinancialSnapshot(raw);
      const customer = mapOrderCustomerFromStateRow(raw);

      return {
        id: String(raw.id),
        order_no: String(raw.order_no ?? ''),
        branch_id: (raw.branch_id as string | null | undefined) ?? null,
        status: String(raw.current_status ?? raw.status ?? 'processing'),
        priority: String(raw.priority ?? PRIORITY_LEVELS.NORMAL),
        has_issue: Boolean(raw.has_issue),
        is_rejected: Boolean(raw.is_rejected),
        rack_location: String(raw.rack_location ?? ''),
        ready_by_at:
          (raw.ready_by_at_new as string | null | undefined) ??
          (raw.ready_by as string | null | undefined) ??
          null,
        created_at: (raw.created_at as string | null | undefined) ?? null,
        notes:
          (raw.customer_notes as string | null | undefined) ??
          (raw.internal_notes as string | null | undefined) ??
          null,
        payment_status: String(raw.payment_status ?? ''),
        payment_type_code: (raw.payment_type_code as string | null | undefined) ?? null,
        subtotal: snapshot.subtotalAmount,
        tax: snapshot.totalTaxAmount,
        total: snapshot.totalAmount,
        paid_amount: snapshot.totalPaidAmount,
        outstanding_amount: snapshot.outstandingAmount,
        customer,
        items,
      };
    },
  });

  const uniqueCategories = useMemo(() => {
    const codes = new Set<string>();
    (order?.items ?? []).forEach((it) => {
      if (it.service_category_code) {
        codes.add(it.service_category_code.toUpperCase());
      }
    });
    return Array.from(codes);
  }, [order?.items]);

  const categoryStepQueries = useQueries({
    queries: uniqueCategories.map((categoryCode) => ({
      queryKey: ['processing-steps-config', categoryCode, currentTenant?.tenant_id],
      enabled: Boolean(currentTenant?.tenant_id && categoryCode),
      staleTime: 5 * 60 * 1000,
      queryFn: async () => {
        const res = await fetch(
          `/api/v1/processing-steps/${encodeURIComponent(categoryCode)}`
        );
        if (!res.ok) return [] as ProcessingStepConfig[];
        const json = (await res.json()) as {
          success?: boolean;
          data?: ProcessingStepConfig[];
        };
        return json.success && Array.isArray(json.data) ? json.data : [];
      },
    })),
  });

  const stepsByCategory = useMemo(() => {
    const map = new Map<string, ResolvedStep[]>();
    uniqueCategories.forEach((code, idx) => {
      const data = categoryStepQueries[idx]?.data;
      if (Array.isArray(data) && data.length > 0) {
        const active = data
          .filter((s) => s.is_active !== false)
          .slice()
          .sort((a, b) => (a.display_order || a.step_seq) - (b.display_order || b.step_seq));
        if (active.length > 0) {
          map.set(
            code,
            active.map((s) => ({
              step_code: s.step_code,
              step_seq: s.step_seq,
              label:
                getBilingual(s.step_name, s.step_name2) ||
                s.step_name ||
                s.step_code,
            }))
          );
        }
      }
    });
    return map;
  }, [categoryStepQueries, getBilingual, uniqueCategories]);

  const fallbackSteps: ResolvedStep[] = useMemo(
    () =>
      DEFAULT_FALLBACK_STEPS.map((s) => ({
        step_code: s.code,
        step_seq: s.seq,
        label: tSteps(s.code as 'sorting' | 'pretreatment' | 'washing' | 'drying' | 'finishing'),
      })),
    [tSteps]
  );

  const handleRefreshAll = useCallback(async () => {
    setNowMs(Date.now());
    setActionBarKey((k) => k + 1);
    await refetchOrder();
  }, [refetchOrder]);

  const handleRecordStep = useCallback(
    async (itemId: string, step: ResolvedStep) => {
      if (!orderId) return;
      const key = `${itemId}:${step.step_code}`;
      setRecordingStepKey(key);
      try {
        const res = await fetch(`/api/v1/orders/${orderId}/items/${itemId}/step`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            stepCode: step.step_code,
            stepSeq: step.step_seq,
          }),
        });
        const json = (await res.json().catch(() => ({}))) as {
          success?: boolean;
          error?: string;
        };
        if (!res.ok || !json.success) {
          throw new Error(json.error || tDetail('stepError'));
        }
        cmxMessage.success(tDetail('stepSuccess', { step: step.label }));
        setNowMs(Date.now());
        setActionBarKey((k) => k + 1);
        await refetchOrder();
      } catch (err) {
        cmxMessage.error(
          err instanceof Error ? err.message : tDetail('stepError')
        );
      } finally {
        setRecordingStepKey(null);
      }
    },
    [orderId, refetchOrder, tDetail]
  );

  const toggleItemExpansion = useCallback((itemId: string) => {
    setExpandedItemIds((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  if (isLoading || authLoading) {
    return (
      <div className="w-full space-y-4">
        <CmxSkeleton className="h-14 w-full" />
        <CmxSkeleton className="h-32 w-full" />
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-2">
            <CmxSkeleton className="h-44 w-full" />
            <CmxSkeleton className="h-44 w-full" />
          </div>
          <div className="space-y-4">
            <CmxSkeleton className="h-40 w-full" />
            <CmxSkeleton className="h-40 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const queryErrorMessage =
    orderQueryError instanceof Error ? orderQueryError.message : null;

  if (!order) {
    return (
      <div className="w-full space-y-4">
        {queryErrorMessage && (
          <CmxSummaryMessage
            type="error"
            title={t('error.loadingFailed')}
            items={[queryErrorMessage]}
          />
        )}
        <CmxEmptyState
          icon={<PackageOpen className="h-10 w-10 text-muted-foreground" aria-hidden />}
          title={t('error.orderNotFound')}
          description={t('error.orderNotFoundDesc')}
          action={
            <CmxButton variant="secondary" asChild>
              <Link href={returnUrl}>
                <ChevronLeft className="me-1.5 h-4 w-4 rtl:rotate-180" aria-hidden />
                {t('backToProcessing')}
              </Link>
            </CmxButton>
          }
        />
      </div>
    );
  }

  const displayCustomerName =
    getBilingual(order.customer.name, order.customer.name2) || order.customer.name;
  const localizedOrderStatus = getLocalizedStatus(order.status, tStatus);
  const slaInfo = getSlaInfo(order.ready_by_at, nowMs, tTable);
  const priorityLower = order.priority.toLowerCase();
  const priorityBadge =
    priorityLower === PRIORITY_LEVELS.URGENT
      ? { label: tTable('priorityUrgent'), tone: 'danger' as CmxBadgeTone }
      : priorityLower === PRIORITY_LEVELS.EXPRESS
        ? { label: tTable('priorityExpress'), tone: 'brand' as CmxBadgeTone }
        : null;

  const normalizedPayment = normalizeOrderPaymentStatus(order.payment_status, {
    paymentTypeCode: order.payment_type_code,
    outstandingAmount: order.outstanding_amount,
  });
  const paymentBadge: { label: string; tone: CmxBadgeTone } =
    normalizedPayment === ORDER_PAYMENT_STATUS.PAID ||
    normalizedPayment === ORDER_PAYMENT_STATUS.OVERPAID
      ? { label: tTable('paymentPaid'), tone: 'success' }
      : normalizedPayment === ORDER_PAYMENT_STATUS.PARTIALLY_PAID
        ? { label: tTable('paymentPartial'), tone: 'warning' }
        : normalizedPayment === ORDER_PAYMENT_STATUS.PENDING_COLLECTION
          ? { label: tTable('paymentCollection'), tone: 'warning' }
          : { label: tTable('paymentUnpaid'), tone: 'danger' };

  const totalPieces = order.items.reduce((sum, it) => sum + Math.max(0, it.quantity), 0);
  const readyPieces = order.items.reduce(
    (sum, it) => sum + Math.min(Math.max(0, it.quantity), Math.max(0, it.quantity_ready)),
    0
  );
  const orderDetailsHref = buildOrderDetailsHref({
    tenantOrgId: currentTenant?.tenant_id,
    orderId: order.id,
    orderNo: order.order_no,
    returnUrl: orderDetailsReturnUrl,
    returnLabel: t('backToProcessing'),
  });

  const floorContent = (
    <div className="w-full space-y-4">
      {/* Header Card */}
      <CmxCard>
        <CmxCardContent className="p-4 sm:p-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <CmxButton variant="ghost" size="sm" asChild>
                <Link href={returnUrl}>
                  <ChevronLeft className="me-1 h-4 w-4 rtl:rotate-180" aria-hidden />
                  {t('backToProcessing')}
                </Link>
              </CmxButton>

              {orderDetailsHref && (
                <CmxButton variant="outline" size="sm" asChild>
                  <Link href={orderDetailsHref}>
                    <ExternalLink className="me-1.5 h-3.5 w-3.5" aria-hidden />
                    {tTable('details')}
                  </Link>
                </CmxButton>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <OrderIssueRowActions
                orderId={order.id}
                scopeLevel={ORDER_ISSUE_SCOPE.ORDER}
                openCount={order.has_issue ? 1 : 0}
                totalCount={order.has_issue ? 1 : 0}
                hasOpenIssue={order.has_issue}
                onChanged={() => {
                  void handleRefreshAll();
                }}
                compact={false}
              />

              <CmxButton
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => setIsSimpleOpen(true)}
              >
                <ListChecks className="me-1.5 h-4 w-4" aria-hidden />
                {tTable('simpleProcess')}
              </CmxButton>

              <CmxButton
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  void handleRefreshAll();
                }}
                loading={isFetching}
                aria-label={t('refresh')}
              >
                {!isFetching && <RefreshCw className="me-1.5 h-3.5 w-3.5" aria-hidden />}
                {t('refresh')}
              </CmxButton>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold text-foreground sm:text-2xl">
              {t('title')}
            </h1>
            <CmxCodeChip code={order.order_no} kind="order" size="md" />
            <CmxStatusBadge label={localizedOrderStatus} tone="info" size="sm" />
            {priorityBadge && (
              <CmxStatusBadge label={priorityBadge.label} tone={priorityBadge.tone} size="sm" />
            )}
            {slaInfo && (
              <CmxStatusBadge label={slaInfo.label} tone={slaInfo.tone} size="sm" />
            )}
            <CmxStatusBadge label={paymentBadge.label} tone={paymentBadge.tone} size="sm" />
          </div>

          <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            <div>
              <span className="font-medium text-foreground">{t('customer')}:</span>{' '}
              {displayCustomerName}
            </div>
            <div>
              <span className="font-medium text-foreground">{t('phone')}:</span>{' '}
              <bdi dir="ltr" className="tabular-nums">
                {order.customer.phone}
              </bdi>
            </div>
            <div>
              <span className="font-medium text-foreground">{tDetail('readyBy')}:</span>{' '}
              <span className="tabular-nums">{formatDateTime(order.ready_by_at, locale)}</span>
            </div>
            <div className="tabular-nums">
              <span className="font-medium text-foreground">{tDetail('piecesReady')}:</span>{' '}
              {readyPieces} / {totalPieces}
            </div>
          </div>
        </CmxCardContent>
      </CmxCard>

      {queryErrorMessage && (
        <CmxSummaryMessage
          type="error"
          title={t('error.loadingFailed')}
          items={[queryErrorMessage]}
        />
      )}

      {/* Main 2-Column Workspace */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Left: Items & Steps */}
        <div className="space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-foreground">
              {t('items')} ({order.items.length})
            </h2>
          </div>

          {order.items.length === 0 ? (
            <CmxEmptyState
              icon={<PackageOpen className="h-9 w-9 text-muted-foreground" aria-hidden />}
              title={t('noItems')}
            />
          ) : (
            order.items.map((item) => {
              const catKey = item.service_category_code?.toUpperCase();
              const steps = (catKey && stepsByCategory.get(catKey)) || fallbackSteps;
              const lastCompletedIdx = item.item_last_step
                ? steps.findIndex((s) => s.step_code === item.item_last_step)
                : -1;
              const completedSteps = lastCompletedIdx >= 0 ? lastCompletedIdx + 1 : 0;
              const progressPercentage =
                steps.length > 0 ? Math.round((completedSteps / steps.length) * 100) : 0;
              const itemName = getBilingual(item.product_name, item.product_name2) || item.product_name;
              const allStepsDone = steps.length > 0 && completedSteps >= steps.length;

              return (
                <CmxCard key={item.id}>
                  <CmxCardHeader className="pb-3">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="space-y-1">
                        <CmxCardTitle className="text-base sm:text-lg">{itemName}</CmxCardTitle>
                        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                          <span className="tabular-nums">
                            <span className="font-medium text-foreground">{t('quantity')}:</span>{' '}
                            {item.quantity} ({item.quantity_ready}/{item.quantity} {tModal('ready')})
                          </span>
                          {item.service_category_code && (
                            <span className="rounded bg-muted px-1.5 py-0.5 font-medium text-foreground">
                              {item.service_category_code}
                            </span>
                          )}
                          {item.color && (
                            <span className="rounded bg-muted px-1.5 py-0.5">
                              {tTable('color')}: {item.color}
                            </span>
                          )}
                          {item.brand && (
                            <span className="rounded bg-muted px-1.5 py-0.5">
                              {tTable('brand')}: {item.brand}
                            </span>
                          )}
                          {item.has_stain && (
                            <CmxStatusBadge label={tTable('stain')} tone="warning" size="sm" />
                          )}
                          {item.has_damage && (
                            <CmxStatusBadge label={tTable('damage')} tone="danger" size="sm" />
                          )}
                          {item.item_is_rejected && (
                            <CmxStatusBadge label={tModal('rejected')} tone="danger" size="sm" />
                          )}
                        </div>
                      </div>

                      <CmxStatusBadge
                        size="sm"
                        tone={item.item_status === 'ready' || allStepsDone ? 'success' : 'info'}
                        label={getLocalizedStatus(item.item_status || 'processing', tStatus)}
                      />
                    </div>
                  </CmxCardHeader>

                  <CmxCardContent className="space-y-4">
                    {/* Progress Bar */}
                    <div>
                      <div className="mb-1.5 flex items-center justify-between text-xs tabular-nums">
                        <span className="font-medium text-foreground">{t('progress')}</span>
                        <span className="text-muted-foreground">
                          {completedSteps} / {steps.length} {t('stepsLabel')} ({progressPercentage}%)
                        </span>
                      </div>
                      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                        <div
                          className={`h-full rounded-full transition-all duration-300 ${
                            allStepsDone ? 'bg-success' : 'bg-primary'
                          }`}
                          style={{ width: `${Math.min(100, progressPercentage)}%` }}
                        />
                      </div>
                    </div>

                    {/* Dynamic Step Progression */}
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                          {t('processingSteps')}
                        </p>
                        {allStepsDone && (
                          <span className="text-xs font-medium text-success-text">
                            {tDetail('allStepsCompleted')}
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-3">
                        {steps.map((step, idx) => {
                          const stepState: 'completed' | 'current' | 'pending' =
                            idx <= lastCompletedIdx
                              ? 'completed'
                              : idx === lastCompletedIdx + 1
                                ? 'current'
                                : 'pending';
                          const isCompleted = stepState === 'completed';
                          const isCurrent = stepState === 'current';
                          const stepKey = `${item.id}:${step.step_code}`;
                          const isRecordingThis = recordingStepKey === stepKey;
                          const isDisabled =
                            Boolean(recordingStepKey) || isCompleted || !isCurrent;

                          return (
                            <CmxButton
                              key={step.step_code}
                              type="button"
                              variant={isCurrent ? 'outline' : 'ghost'}
                              onClick={() => {
                                if (!isDisabled) {
                                  void handleRecordStep(item.id, step);
                                }
                              }}
                              disabled={isDisabled}
                              className={
                                isCompleted
                                  ? 'h-auto justify-start border border-success-border bg-success-bg px-3 py-2 text-success-text opacity-100'
                                  : isCurrent
                                    ? 'h-auto justify-start border-2 border-primary bg-info-bg px-3 py-2 text-info-text hover:bg-info-bg/80'
                                    : 'h-auto justify-start border border-border bg-muted/50 px-3 py-2 text-muted-foreground'
                              }
                              title={
                                isCompleted
                                  ? t('stepCompleted')
                                  : isCurrent
                                    ? t('stepCurrent')
                                    : t('stepPending')
                              }
                            >
                              <span className="me-2 shrink-0">
                                {isRecordingThis ? (
                                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                                ) : isCompleted ? (
                                  <CheckCircle2 className="h-4 w-4 text-success-text" aria-hidden />
                                ) : (
                                  <Circle
                                    className={`h-4 w-4 ${
                                      isCurrent ? 'fill-primary text-primary-text' : 'text-muted-foreground'
                                    }`}
                                    aria-hidden
                                  />
                                )}
                              </span>
                              <span className="me-1 text-xs font-semibold tabular-nums opacity-75">
                                {idx + 1}.
                              </span>
                              <span className="flex-1 truncate text-start text-sm font-medium">
                                {step.label}
                              </span>
                              {isCurrent && !isRecordingThis && (
                                <span className="ms-2 shrink-0 text-xs font-semibold text-primary-text">
                                  {t('clickToComplete')}
                                </span>
                              )}
                            </CmxButton>
                          );
                        })}
                      </div>
                    </div>

                    {item.notes && (
                      <p className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">{tDetail('notes')}:</span>{' '}
                        {item.notes}
                      </p>
                    )}

                    {/* Piece Photos (when item-level tracking) or Expandable Piece Manager */}
                    {!trackByPiece && orderId && (
                      <PiecePhotosControl
                        orderId={orderId}
                        refType={FILE_REF_TYPES.ORDER_ITEM}
                        refId={item.id}
                        label={itemName}
                        source={FILE_SOURCES.ORDER_PROCESSING}
                      />
                    )}

                    {trackByPiece && orderId && currentTenant?.tenant_id && (
                      <div className="border-t border-border pt-3">
                        <CmxButton
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleItemExpansion(item.id)}
                          className="h-auto w-full justify-between px-1 py-1 text-sm font-medium text-foreground"
                        >
                          <span>{tPieces('viewPieces')}</span>
                          {expandedItemIds.has(item.id) ? (
                            <ChevronUp className="h-4 w-4" aria-hidden />
                          ) : (
                            <ChevronDown className="h-4 w-4" aria-hidden />
                          )}
                        </CmxButton>

                        {expandedItemIds.has(item.id) && (
                          <div className="mt-3">
                            <PiecesErrorBoundary>
                              <OrderPiecesManager
                                orderId={orderId}
                                itemId={item.id}
                                fileSource={FILE_SOURCES.ORDER_PROCESSING}
                                tenantId={currentTenant.tenant_id}
                                branchId={order.branch_id}
                                readOnly={false}
                                autoLoad
                                enableBulkOperations
                                pieceDensity="compact"
                                onUpdate={() => {
                                  void handleRefreshAll();
                                }}
                              />
                            </PiecesErrorBoundary>
                          </div>
                        )}
                      </div>
                    )}
                  </CmxCardContent>
                </CmxCard>
              );
            })
          )}

          {orderId && <OrderStageFiles orderId={orderId} source={FILE_SOURCES.ORDER_PROCESSING} />}
        </div>

        {/* Right Rail: Payment Summary, Storage & Quick Tools */}
        <div className="space-y-4">
          <CmxCard>
            <CmxCardHeader className="pb-2">
              <div className="flex items-center justify-between gap-2">
                <CmxCardTitle className="text-base">{tDetail('financialTitle')}</CmxCardTitle>
                <CmxStatusBadge label={paymentBadge.label} tone={paymentBadge.tone} size="sm" />
              </div>
            </CmxCardHeader>
            <CmxCardContent className="space-y-2 text-sm tabular-nums">
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{tDetail('subtotal')}</span>
                <span>{formatMoneyWithCode(order.subtotal)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{tDetail('tax')}</span>
                <span>{formatMoneyWithCode(order.tax)}</span>
              </div>
              <div className="flex items-center justify-between border-t border-border pt-2 font-semibold text-foreground">
                <span>{tTable('total')}</span>
                <span>{formatMoneyWithCode(order.total)}</span>
              </div>
              <div className="flex items-center justify-between text-muted-foreground">
                <span>{tDetail('paid')}</span>
                <span>{formatMoneyWithCode(order.paid_amount)}</span>
              </div>
              <div className="flex items-center justify-between font-semibold text-foreground">
                <span>{tDetail('balanceDue')}</span>
                <span className={order.outstanding_amount > 0 ? 'text-warning-text' : 'text-success-text'}>
                  {formatMoneyWithCode(order.outstanding_amount)}
                </span>
              </div>
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader className="pb-2">
              <CmxCardTitle className="text-base">{tDetail('storageTitle')}</CmxCardTitle>
              <CmxCardDescription>{tDetail('rackLocationHelp')}</CmxCardDescription>
            </CmxCardHeader>
            <CmxCardContent className="space-y-3 text-sm">
              <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 px-3 py-2">
                <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{tDetail('rackLocation')}</div>
                  <div className="truncate font-medium text-foreground">
                    {order.rack_location || tDetail('rackNotAssigned')}
                  </div>
                </div>
              </div>

              {order.notes && (
                <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
                  <div className="text-xs text-muted-foreground">{tDetail('notes')}</div>
                  <div className="mt-0.5 text-sm text-foreground">{order.notes}</div>
                </div>
              )}
            </CmxCardContent>
          </CmxCard>

          <CmxCard>
            <CmxCardHeader className="pb-2">
              <CmxCardTitle className="text-base">{tDetail('quickToolsTitle')}</CmxCardTitle>
            </CmxCardHeader>
            <CmxCardContent className="space-y-2">
              <CmxButton
                type="button"
                variant="secondary"
                className="w-full justify-start"
                onClick={() => setIsSimpleOpen(true)}
              >
                <ListChecks className="me-2 h-4 w-4" aria-hidden />
                {tTable('simpleProcess')}
              </CmxButton>

              {orderDetailsHref && (
                <CmxButton variant="outline" className="w-full justify-start" asChild>
                  <Link href={orderDetailsHref}>
                    <ExternalLink className="me-2 h-4 w-4" aria-hidden />
                    {tTable('details')}
                  </Link>
                </CmxButton>
              )}
            </CmxCardContent>
          </CmxCard>
        </div>
      </div>
    </div>
  );

  return (
    <div className="w-full space-y-4">
      {orderId ? (
        <WorkflowActionBar
          key={actionBarKey}
          orderId={orderId}
          screen="processing"
          emptyBackHref={returnUrl}
          onActionSuccess={() => {
            void handleRefreshAll();
          }}
        >
          {floorContent}
        </WorkflowActionBar>
      ) : (
        floorContent
      )}

      {currentTenant && isSimpleOpen ? (
        <SimpleProcessingDialog
          isOpen
          orderId={order.id}
          tenantId={currentTenant.tenant_id}
          onClose={() => setIsSimpleOpen(false)}
          onRefresh={() => {
            void handleRefreshAll();
          }}
        />
      ) : null}
    </div>
  );
}
