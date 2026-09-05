'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, ClipboardCheck, Copy, CreditCard, MapPin, Package, Phone, Printer, UserRound } from 'lucide-react';

import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxButton } from '@ui/primitives';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { cmxMessage } from '@ui/feedback';
import { CollectPaymentButton } from '@features/orders/ui/collect-payment/collect-payment-button';
import { OrderCollectPaymentModal } from '@features/orders/ui/collect-payment/order-collect-payment-modal';

import { OrderWorkspaceSectionNav } from './order-workspace-section-nav';
import { OrderWorkspacePaymentBadge, OrderWorkspaceStatusBadge } from './order-workspace-status-badge';
import type { OrderWorkspaceSectionId, OrderWorkspaceStage } from './order-workspace-types';

interface OrderWorkspaceScreenProps {
  order: Record<string, unknown>;
  tenantOrgId: string;
  userId: string;
  locale: string;
  returnUrl: string;
  returnLabel?: string;
  initialSection: OrderWorkspaceSectionId;
}

const sections: OrderWorkspaceSectionId[] = ['overview', 'work', 'customer', 'financials', 'activity'];

function value(record: Record<string, unknown>, key: string): string | null {
  const candidate = record[key];
  return typeof candidate === 'string' && candidate.trim() ? candidate : null;
}

function amount(record: Record<string, unknown>, key: string): number {
  const candidate = Number(record[key] ?? 0);
  return Number.isFinite(candidate) ? candidate : 0;
}

/** Operational workspace that reuses canonical detail routes for deep specialist flows. */
export function OrderWorkspaceScreen({
  order,
  locale,
  returnUrl,
  returnLabel,
  initialSection,
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
  const status = value(order, 'status') ?? 'intake';
  const paymentPlan = value(order, 'payment_type_code');
  const preparation = value(order, 'preparation_status');
  const address = value(order, 'address') ?? value(order, 'delivery_address') ?? value(order, 'customer_address');
  const location = value(order, 'location_details') ?? value(order, 'delivery_location_details');
  const fmt = (number: number) => formatMoneyAmountWithCode(number, { currencyCode: orderCurrency, decimalPlaces: 3, locale: locale === 'ar' ? 'ar' : 'en' });
  const activeSection = sections.includes(searchParams.get('section') as OrderWorkspaceSectionId)
    ? (searchParams.get('section') as OrderWorkspaceSectionId)
    : initialSection;

  const stages = useMemo<OrderWorkspaceStage[]>(() => {
    const values = ['intake', 'preparation', 'processing', 'qa', 'ready', 'delivered', 'completed'];
    const currentIndex = Math.max(0, values.indexOf(status.toLowerCase()));
    return values.map((stage, index) => ({
      id: stage,
      label: t(`stages.${stage}`),
      state: index < currentIndex ? 'complete' : index === currentIndex ? 'current' : 'upcoming',
    }));
  }, [status, t]);

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
    <main className="space-y-5">
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

      <CmxCard>
        <CmxCardContent className="space-y-5 pt-6">
          <div className={`flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between ${isRTL ? 'lg:flex-row-reverse' : ''}`}>
            <div className={isRTL ? 'text-right' : 'text-left'}>
              <div className={`flex flex-wrap items-center gap-2 ${isRTL ? 'flex-row-reverse' : ''}`}>
                <h1 className="text-2xl font-bold tracking-tight">{orderNo}</h1>
                <OrderWorkspaceStatusBadge label={t(`statuses.${status.toLowerCase()}`, { default: status })} tone="info" />
                {paymentPlan ? <OrderWorkspacePaymentBadge label={t(`paymentPlans.${paymentPlan.toLowerCase()}`, { default: paymentPlan })} /> : null}
              </div>
              <p className="mt-2 text-sm text-muted-foreground">{customerName}</p>
              {order.received_at ? <p className="mt-1 text-sm text-muted-foreground">{t('receivedAt', { value: new Date(String(order.received_at)).toLocaleString(locale === 'ar' ? 'ar' : 'en') })}</p> : null}
            </div>
            <div className={isRTL ? 'text-left' : 'text-right'}>
              <p className="text-xs font-medium text-muted-foreground">{t('orderTotal')}</p>
              <p className="text-3xl font-bold tabular-nums">{fmt(total)}</p>
              {hasCollectionDue ? <p className="mt-1 text-sm font-medium text-[rgb(var(--cmx-warning-dark-rgb,161_98_7))]">{t('balanceDue', { value: fmt(balance) })}</p> : null}
            </div>
          </div>

          <div className="border-t border-border pt-4">
            <p className={`mb-3 text-sm font-semibold ${isRTL ? 'text-right' : 'text-left'}`}>{t('workflow')}</p>
            <ol className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4" aria-label={t('workflow')}>
              {stages.map((stage) => <li key={stage.id} className={`rounded-md border px-3 py-2 text-sm ${stage.state === 'current' ? 'border-primary bg-primary/5 font-semibold' : stage.state === 'complete' ? 'border-border bg-muted/40' : 'border-border text-muted-foreground'}`}>{stage.label}</li>)}
            </ol>
            <div className={`mt-4 flex flex-wrap items-center justify-between gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
              <p className="text-sm text-muted-foreground">{preparation ? t('preparationStatus', { value: preparation }) : t('workflowGuidance')}</p>
              {status.toLowerCase() === 'intake' || preparation === 'pending' ? <Link href={`/dashboard/preparation/${orderId}`}><CmxButton>{t('startPreparation')}</CmxButton></Link> : <Link href={detailHref('actions')}><CmxButton>{t('viewAvailableActions')}</CmxButton></Link>}
            </div>
          </div>
        </CmxCardContent>
      </CmxCard>

      {hasCollectionDue ? <CmxCard className="border-[rgb(var(--cmx-warning-rgb,234_179_8))]/40"><CmxCardContent className={`flex flex-wrap items-center justify-between gap-3 py-4 ${isRTL ? 'flex-row-reverse' : ''}`}><div><p className="font-semibold">{t('collectionAttentionTitle')}</p><p className="text-sm text-muted-foreground">{t('collectionAttentionDescription', { value: fmt(balance) })}</p></div><CollectPaymentButton label={t('collectPayment')} onCollect={() => setCollectOpen(true)} /></CmxCardContent></CmxCard> : null}

      <OrderWorkspaceSectionNav activeSection={activeSection} onChange={changeSection} labels={{ overview: t('sections.overview'), work: t('sections.work'), customer: t('sections.customer'), financials: t('sections.financials'), activity: t('sections.activity') }} counts={{ work: itemRows.length }} />

      {activeSection === 'overview' || activeSection === 'work' ? <section className="grid gap-4 lg:grid-cols-2" aria-label={t('sections.work')}>
        <CmxCard><CmxCardHeader><CmxCardTitle>{t('workProgress')}</CmxCardTitle></CmxCardHeader><CmxCardContent className="space-y-3"><div className="flex items-center gap-2 text-sm"><Package aria-hidden="true" className="h-4 w-4 text-muted-foreground" />{t('itemCount', { count: itemRows.length })}</div><p className="text-sm text-muted-foreground">{itemRows.length ? t('workReady') : t('noItems')}</p><Link href={detailHref('items')}><CmxButton variant="outline" size="sm"><ClipboardCheck aria-hidden="true" className="h-4 w-4" />{t('openWork')}</CmxButton></Link></CmxCardContent></CmxCard>
        <CmxCard><CmxCardHeader><CmxCardTitle>{t('financialSnapshot')}</CmxCardTitle></CmxCardHeader><CmxCardContent className="grid grid-cols-2 gap-4 text-sm"><div><p className="text-muted-foreground">{t('paid')}</p><p className="font-semibold tabular-nums">{fmt(paid)}</p></div><div><p className="text-muted-foreground">{t('credits')}</p><p className="font-semibold tabular-nums">{fmt(credits)}</p></div><div className="col-span-2 border-t pt-3"><p className="text-muted-foreground">{t('balance')}</p><p className="text-lg font-bold tabular-nums">{fmt(balance)}</p></div></CmxCardContent></CmxCard>
      </section> : null}

      {activeSection === 'customer' ? <CmxCard><CmxCardHeader><CmxCardTitle>{t('customerContext')}</CmxCardTitle></CmxCardHeader><CmxCardContent className="grid gap-4 md:grid-cols-2"><div><p className="text-sm font-medium">{customerName}</p>{mobile ? <div className="mt-2 flex items-center gap-2"><Phone aria-hidden="true" className="h-4 w-4 text-muted-foreground" /><span dir="ltr" className="text-sm">{mobile}</span><CmxButton size="xs" variant="ghost" aria-label={t('copyMobile')} onClick={copyMobile}><Copy aria-hidden="true" className="h-4 w-4" /></CmxButton></div> : <p className="mt-2 text-sm text-muted-foreground">{t('noMobile')}</p>}</div><div><div className="flex gap-2"><MapPin aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" /><div><p className="text-sm">{address ?? t('noAddress')}</p>{location ? <p className="mt-1 text-sm text-muted-foreground">{location}</p> : null}</div></div></div></CmxCardContent></CmxCard> : null}

      {activeSection === 'financials' ? <CmxCard><CmxCardHeader><CmxCardTitle>{t('financialsTitle')}</CmxCardTitle></CmxCardHeader><CmxCardContent><p className="mb-4 text-sm text-muted-foreground">{t('financialsDescription')}</p><Link href={detailHref('payments_credits')}><CmxButton><CreditCard aria-hidden="true" className="h-4 w-4" />{t('openFinancials')}</CmxButton></Link></CmxCardContent></CmxCard> : null}

      {activeSection === 'activity' ? <CmxCard><CmxCardHeader><CmxCardTitle>{t('activityTitle')}</CmxCardTitle></CmxCardHeader><CmxCardContent><p className="mb-4 text-sm text-muted-foreground">{t('activityDescription')}</p><Link href={`/dashboard/orders/${orderId}?tab=history`}><CmxButton variant="outline">{t('openActivity')}</CmxButton></Link></CmxCardContent></CmxCard> : null}
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
