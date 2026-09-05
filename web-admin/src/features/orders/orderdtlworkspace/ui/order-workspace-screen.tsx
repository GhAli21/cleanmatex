'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, CheckCircle2, ChevronRight, ClipboardCheck, Copy, CreditCard, MapPin, Package, Phone, Printer, UserRound } from 'lucide-react';

import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxButton } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { cmxMessage } from '@ui/feedback';
import { CollectPaymentButton } from '@features/orders/ui/collect-payment/collect-payment-button';
import { OrderCollectPaymentModal } from '@features/orders/ui/collect-payment/order-collect-payment-modal';
import { WorkflowActionBar } from '@features/workflow/ui/WorkflowActionBar';

import { OrderWorkspaceSectionNav } from './order-workspace-section-nav';
import { OrderWorkspacePaymentBadge, OrderWorkspaceStatusBadge } from './order-workspace-status-badge';
import type { OrderWorkspaceSectionId, OrderWorkspaceStage, OrderWorkspaceWorkflowJourneyStage } from './order-workspace-types';

/**
 * Data and navigation context required to render the order operations workspace.
 *
 * `order` is server-sourced for the authenticated tenant; the client component
 * only derives presentation values and delegates mutations to canonical flows.
 */
interface OrderWorkspaceScreenProps {
  /** Serialized order payload supplied by the tenant-scoped server page. */
  order: Record<string, unknown>;
  /** Tenant identifier retained for canonical collection-flow integration. */
  tenantOrgId: string;
  /** Authenticated operator identifier retained for canonical collection-flow integration. */
  userId: string;
  /** Active application locale used for amounts and timestamps. */
  locale: string;
  /** Safe legacy-detail destination used when an operator leaves the workspace. */
  returnUrl: string;
  /** Optional label that preserves the caller's navigation context. */
  returnLabel?: string;
  /** Section selected when the URL has no valid workspace section. */
  initialSection: OrderWorkspaceSectionId;
  /** Ordered display journey from the tenant order's pinned workflow policy. */
  workflowJourney: OrderWorkspaceWorkflowJourneyStage[];
}

const sections: OrderWorkspaceSectionId[] = ['overview', 'work', 'customer', 'financials', 'activity', 'actions'];

/**
 * Returns a non-blank string from an untyped server payload.
 *
 * Keeps optional order fields from being rendered as whitespace or unsafe values.
 *
 * @param record - Serialized server payload containing the candidate field.
 * @param key - Field name to read from the payload.
 * @returns Trimmed string value, or `null` when it is absent or not displayable.
 */
function value(record: Record<string, unknown>, key: string): string | null {
  const candidate = record[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate : null;
}

/**
 * Normalizes a monetary payload field for display-only calculations.
 *
 * Falls back to zero so an incomplete response cannot produce `NaN` in an
 * operational financial summary.
 *
 * @param record - Serialized server payload containing the candidate amount.
 * @param key - Monetary field name to read from the payload.
 * @returns Finite numeric amount, or zero when unavailable.
 */
function amount(record: Record<string, unknown>, key: string): number {
  const candidate = Number(record[key] ?? 0);
  return Number.isFinite(candidate) ? candidate : 0;
}

/**
 * Renders the responsive order operations workspace without duplicating canonical workflows.
 *
 * Read-only workspace data remains tenant-scoped by the server page; payment
 * collection and specialist actions continue through their existing audited routes.
 *
 * @param props - Tenant-scoped order data, locale, and workspace navigation context.
 * @returns Interactive order workspace screen.
 */
export function OrderWorkspaceScreen({
  order,
  locale,
  returnUrl,
  returnLabel,
  initialSection,
  workflowJourney,
}: OrderWorkspaceScreenProps) {
  const t = useTranslations('orders.detail.workspace');
  const isRTL = useRTL();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [collectOpen, setCollectOpen] = useState(false);
  const orderId = String(order.id ?? '');
  const orderNo = value(order, 'order_no') ?? orderId;
  const orderCurrency = value(order, 'currency_code') ?? 'OMR';
  const total = amount(order, 'total');
  const paid = amount(order, 'total_paid_amount') || amount(order, 'paid_amount');
  const credits = amount(order, 'total_credit_applied_amount');
  const balance = amount(order, 'outstanding_amount') || Math.max(0, total - paid - credits);
  const itemRows = Array.isArray(order.items) ? order.items : [];
  const customer = order.org_customers_mst as Record<string, unknown> | undefined;
  const customerMaster = customer?.sys_customers_mst as Record<string, unknown> | undefined;
  const customerName = value(order, 'customer_name')
    ?? [value(customerMaster ?? {}, 'first_name'), value(customerMaster ?? {}, 'last_name')].filter(Boolean).join(' ')
    ?? t('unknownCustomer');
  const mobile = value(order, 'customer_mobile_number') ?? value(customerMaster ?? {}, 'phone');
  const status = value(order, 'current_status') ?? value(order, 'status') ?? 'intake';
  const paymentPlan = value(order, 'payment_type_code');
  const address = value(order, 'address') ?? value(order, 'delivery_address') ?? value(order, 'customer_address');
  const location = value(order, 'location_details') ?? value(order, 'delivery_location_details');
  const fmt = (number: number) => formatMoneyAmountWithCode(number, { currencyCode: orderCurrency, decimalPlaces: 3, locale: locale === 'ar' ? 'ar' : 'en' });
  const activeSection = sections.includes(searchParams.get('section') as OrderWorkspaceSectionId)
    ? (searchParams.get('section') as OrderWorkspaceSectionId)
    : initialSection;

  const stages = useMemo<OrderWorkspaceStage[]>(() => {
    // The pinned policy, rather than a client-maintained lifecycle list, determines the operator-visible journey.
    const currentIndex = workflowJourney.findIndex((stage) => stage.statusCode.toLowerCase() === status.toLowerCase());
    return workflowJourney.map((stage, index) => ({
      id: stage.statusCode,
      label: stage.label,
      state: currentIndex < 0 ? 'upcoming' : index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming',
    }));
  }, [status, workflowJourney]);

  const changeSection = (section: OrderWorkspaceSectionId) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('section', section);
    router.replace(`/dashboard/orders/${orderId}/workspace?${params.toString()}`, { scroll: false });
  };

  const copyMobile = async () => {
    if (!mobile) return;
    try {
      await navigator.clipboard.writeText(mobile);
      cmxMessage.success(t('mobileCopied'));
    } catch {
      cmxMessage.error(t('copyMobileError'));
    }
  };

  const detailHref = (tab: string) => `/dashboard/orders/${orderId}/full?tab=${tab}&returnUrl=${encodeURIComponent(`/dashboard/orders/${orderId}/workspace`)}`;
  const hasCollectionDue = balance > 0;

  return (
    <main className="mx-auto max-w-7xl space-y-6 pb-24 lg:pb-6">
      {/* Centered workspace column preserves scanability and reserves mobile space for sticky browser controls. */}
      {/* Direction-aware utility row keeps navigation and secondary actions natural in Arabic and English. */}
      <div className={`flex flex-wrap items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <Link href={returnUrl} className={`inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground ${isRTL ? 'flex-row-reverse' : ''}`}>
          <ArrowLeft aria-hidden="true" className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} />
          {returnLabel ?? t('backToOrders')}
        </Link>
        <div className={`flex flex-wrap gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Link href={`/dashboard/orders/${orderId}/edit`}><CmxButton size="sm" variant="outline"><UserRound aria-hidden="true" className="h-4 w-4" />{t('edit')}</CmxButton></Link>
          <Link href={detailHref('items')}><CmxButton size="sm" variant="outline"><Printer aria-hidden="true" className="h-4 w-4" />{t('printAndDetails')}</CmxButton></Link>
        </div>
      </div>

      <CmxCard className="overflow-hidden border-border/80 shadow-sm">
        <CmxCardContent className="space-y-5 pt-6">
          {/* Header stacks on narrow screens, then separates identity from financial priority on wider displays. */}
          <div className={`flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h1 className="text-2xl font-bold tracking-tight">{orderNo}</h1>
                <OrderWorkspaceStatusBadge label={t(`statuses.${status.toLowerCase()}`, { default: status })} tone="info" />
                {paymentPlan ? <OrderWorkspacePaymentBadge label={t(`paymentPlans.${paymentPlan.toLowerCase()}`, { default: paymentPlan })} /> : null}
              </div>
              <p className="mt-2 text-base font-medium text-foreground">{customerName}</p>
              {order.received_at ? <p className="mt-1 text-sm text-muted-foreground">{t('receivedAt', { value: new Date(String(order.received_at)).toLocaleString(locale === 'ar' ? 'ar' : 'en') })}</p> : null}
            </div>
            <div className={isRTL ? 'text-left' : 'text-right'}>
              <p className="text-xs font-medium text-muted-foreground">{t('orderTotal')}</p>
              <p className="text-3xl font-bold tabular-nums">{fmt(total)}</p>
              {hasCollectionDue ? <p className="mt-1 text-sm font-medium text-[rgb(var(--cmx-warning-dark-rgb,161_98_7))]">{t('balanceDue', { value: fmt(balance) })}</p> : null}
            </div>
          </div>

          <div className="border-t border-border pt-5">
            <div className={`mb-4 flex items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <p className={`text-sm font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t('workflow')}</p>
              {stages.length ? <p className="text-xs font-medium text-muted-foreground">{stages.findIndex((stage) => stage.state === 'current') + 1} / {stages.length}</p> : null}
            </div>
            {stages.length ? <>
              {/* The configured policy order is scrollable rather than compressed on mobile. */}
              <ol className={`flex min-w-max items-center gap-1 overflow-x-auto pb-1 ${isRTL ? 'flex-row-reverse' : ''}`} aria-label={t('workflow')}>
                {stages.map((stage, index) => <li key={stage.id} className={`flex items-center ${isRTL ? 'flex-row-reverse' : ''}`} aria-current={stage.state === 'current' ? 'step' : undefined}><div className={`flex min-w-28 items-center gap-1.5 rounded-lg border px-3 py-3 text-xs ${stage.state === 'current' ? 'border-primary bg-primary/10 font-semibold text-foreground shadow-sm' : stage.state === 'complete' ? 'border-border bg-muted/50 text-foreground' : 'border-border bg-background text-muted-foreground'}`}>{stage.state === 'complete' ? <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5 text-[rgb(var(--cmx-success-rgb,34_197_94))]" /> : <span aria-hidden="true" className={`h-2 w-2 rounded-full ${stage.state === 'current' ? 'bg-primary' : 'bg-muted-foreground/40'}`} />}{stage.label}</div>{index < stages.length - 1 ? <ChevronRight aria-hidden="true" className={`mx-1 h-4 w-4 shrink-0 text-muted-foreground/50 ${isRTL ? 'rotate-180' : ''}`} /> : null}</li>)}
              </ol>
              <p className={`mt-4 text-sm text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`}>{t('workflowCurrentStatus', { value: value(order, 'current_status') ?? value(order, 'status') ?? status })}</p>
            </> : <p className="text-sm text-muted-foreground">{t('workflowJourneyUnavailable')}</p>}
          </div>
        </CmxCardContent>
      </CmxCard>

      {hasCollectionDue ? <CmxCard className="border-[rgb(var(--cmx-warning-rgb,234_179_8))]/40"><CmxCardContent className={`flex flex-wrap items-center justify-between gap-3 py-4 ${isRTL ? 'flex-row-reverse' : ''}`}><div><p className="font-semibold">{t('collectionAttentionTitle')}</p><p className="text-sm text-muted-foreground">{t('collectionAttentionDescription', { value: fmt(balance) })}</p></div><CollectPaymentButton label={t('collectPayment')} onCollect={() => setCollectOpen(true)} /></CmxCardContent></CmxCard> : null}

      <OrderWorkspaceSectionNav activeSection={activeSection} onChange={changeSection} labels={{ overview: t('sections.overview'), work: t('sections.work'), customer: t('sections.customer'), financials: t('sections.financials'), activity: t('sections.activity'), actions: t('sections.actions') }} counts={{ work: itemRows.length }} />

      {/* Overview balances work, finance, customer, and activity context before an operator enters a specialist flow. */}
      {activeSection === 'overview' || activeSection === 'work' ? <section className="grid gap-4 xl:grid-cols-3" aria-label={t('sections.work')}>
        <CmxCard className="xl:col-span-2"><CmxCardHeader><CmxCardTitle>{t('workProgress')}</CmxCardTitle></CmxCardHeader><CmxCardContent className="space-y-4"><div className="flex items-end justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-medium"><Package aria-hidden="true" className="h-4 w-4 text-primary" />{t('itemCount', { count: itemRows.length })}</div><p className="mt-2 text-sm text-muted-foreground">{itemRows.length ? t('workReady') : t('noItems')}</p></div><p className="text-3xl font-bold tabular-nums">{itemRows.length}</p></div><Link href={detailHref('items')}><CmxButton variant="outline" size="sm"><ClipboardCheck aria-hidden="true" className="h-4 w-4" />{t('openWork')}</CmxButton></Link></CmxCardContent></CmxCard>
        <CmxCard><CmxCardHeader><CmxCardTitle>{t('financialSnapshot')}</CmxCardTitle></CmxCardHeader><CmxCardContent className="space-y-3 text-sm"><div className="flex items-center justify-between"><span className="text-muted-foreground">{t('paid')}</span><span className="font-semibold tabular-nums">{fmt(paid)}</span></div><div className="flex items-center justify-between"><span className="text-muted-foreground">{t('credits')}</span><span className="font-semibold tabular-nums">{fmt(credits)}</span></div><div className="flex items-center justify-between border-t pt-3"><span className="font-medium">{t('balance')}</span><span className="text-lg font-bold tabular-nums">{fmt(balance)}</span></div></CmxCardContent></CmxCard>
        <CmxCard><CmxCardHeader><CmxCardTitle>{t('customerContext')}</CmxCardTitle></CmxCardHeader><CmxCardContent className="space-y-3"><p className="font-medium">{customerName}</p><p className="text-sm text-muted-foreground" dir="ltr">{mobile ?? t('noMobile')}</p><p className="line-clamp-2 text-sm text-muted-foreground">{address ?? t('noAddress')}</p><CmxButton variant="ghost" size="sm" onClick={() => changeSection('customer')}>{t('sections.customer')}<ChevronRight aria-hidden="true" className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} /></CmxButton></CmxCardContent></CmxCard>
        <CmxCard className="xl:col-span-2"><CmxCardHeader><CmxCardTitle>{t('activityTitle')}</CmxCardTitle></CmxCardHeader><CmxCardContent className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-muted-foreground">{t('activityDescription')}</p><CmxButton variant="outline" size="sm" onClick={() => changeSection('activity')}>{t('openActivity')}<ChevronRight aria-hidden="true" className={`h-4 w-4 ${isRTL ? 'rotate-180' : ''}`} /></CmxButton></CmxCardContent></CmxCard>
      </section> : null}

      {activeSection === 'customer' ? <CmxCard><CmxCardHeader><CmxCardTitle>{t('customerContext')}</CmxCardTitle></CmxCardHeader><CmxCardContent className="grid gap-4 md:grid-cols-2"><div><p className="text-sm font-medium">{customerName}</p>{mobile ? <div className="mt-2 flex items-center gap-2"><Phone aria-hidden="true" className="h-4 w-4 text-muted-foreground" /><span dir="ltr" className="text-sm">{mobile}</span><CmxButton size="xs" variant="ghost" aria-label={t('copyMobile')} onClick={copyMobile}><Copy aria-hidden="true" className="h-4 w-4" /></CmxButton></div> : <p className="mt-2 text-sm text-muted-foreground">{t('noMobile')}</p>}</div><div><div className="flex gap-2"><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><p className="text-sm">{address ?? t('noAddress')}</p>{location ? <p className="mt-1 text-sm text-muted-foreground">{location}</p> : null}</div></div></div></CmxCardContent></CmxCard> : null}

      {activeSection === 'financials' ? <CmxCard><CmxCardHeader><CmxCardTitle>{t('financialsTitle')}</CmxCardTitle></CmxCardHeader><CmxCardContent><p className="mb-4 text-sm text-muted-foreground">{t('financialsDescription')}</p><Link href={detailHref('payments_credits')}><CmxButton><CreditCard aria-hidden="true" className="h-4 w-4" />{t('openFinancials')}</CmxButton></Link></CmxCardContent></CmxCard> : null}

      {activeSection === 'activity' ? <CmxCard><CmxCardHeader><CmxCardTitle>{t('activityTitle')}</CmxCardTitle></CmxCardHeader><CmxCardContent><p className="mb-4 text-sm text-muted-foreground">{t('activityDescription')}</p><Link href={`/dashboard/orders/${orderId}?tab=history`}><CmxButton variant="outline">{t('openActivity')}</CmxButton></Link></CmxCardContent></CmxCard> : null}
      {activeSection === 'actions' ? (
        <section aria-label={t('sections.actions')}>
          {/* The workflow engine remains authoritative for allowed order-control actions and their safety gates. */}
          <WorkflowActionBar
            orderId={orderId}
            screen="order_control"
            title={t('orderControlTitle')}
            // Re-read the server-sourced workspace after an audited workflow transition changes the order state.
            onActionSuccess={() => router.refresh()}
          />
        </section>
      ) : null}
      <OrderCollectPaymentModal
        open={collectOpen}
        onOpenChange={setCollectOpen}
        orderId={orderId}
        customerId={value(order, 'customer_id')}
        branchId={value(order, 'branch_id')}
        outstandingAmount={balance}
        currencyCode={orderCurrency}
        onCollected={() => router.refresh()}
      />
    </main>
  );
}
