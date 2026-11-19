import type { Metadata } from 'next';

/** Identifies an individual AR invoice without placing financial data in tab metadata. */
export const metadata: Metadata = { title: 'AR Invoice Details' };

import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getTranslations } from 'next-intl/server';

import { CmxButton } from '@ui/primitives';
import {
  CmxCard,
  CmxCardContent,
  CmxCardHeader,
  CmxCardTitle,
} from '@ui/primitives/cmx-card';
import { CmxKpiStatCard } from '@ui/data-display';
import { getAuthContext } from '@/lib/auth/server-auth';
import { AR_STATUS_TRANSLATION_KEYS, AR_STATUS_BADGE_TONES } from '@/lib/constants/ar-invoice';
import { getArInvoiceDetail } from '@/lib/services/ar-invoice.service';
import { ArInvoiceDetailActions } from '@features/ar/ui/ar-invoice-detail-actions';
import { ArInvoiceDetailTabs } from '@features/ar/ui/ar-invoice-detail-tabs';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { BILLING_INTERNAL_FIN_INVOICES_ACCESS } from '@features/billing/access/billing-access'

import { CmxStatusBadge } from '@ui/feedback';
interface PageProps {
  params: Promise<{ id: string }>;
}

function formatCurrency(amount: number, currencyCode: string) {
  return new Intl.NumberFormat('en-OM', {
    style: 'currency',
    currency: currencyCode,
    minimumFractionDigits: 2,
    maximumFractionDigits: 4,
  }).format(amount);
}

/**
 *
 * @param root0
 * @param root0.params
 */
export default async function ArInvoiceDetailPage({ params }: PageProps) {
  const { id } = await params;
  const t = await getTranslations('invoices');
  const tAr = await getTranslations('invoices.ar');

  const auth = await getAuthContext();
  const detail = await getArInvoiceDetail(id, { tenantId: auth.tenantId });

  if (!detail) {
    notFound();
  }

  const invoice = detail.invoice;
  const statusKey = AR_STATUS_TRANSLATION_KEYS[invoice.status];

  return (
    <RequireAnyPermission permissions={BILLING_INTERNAL_FIN_INVOICES_ACCESS.page.permissions ?? []}>
      <div className="space-y-6 overflow-x-hidden p-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-gradient-to-br from-card via-muted to-warning-bg p-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground">
              {t('detail.title', { invoiceNo: invoice.invoice_no })}
            </h1>
            <CmxStatusBadge size="sm" tone="brand" appearance="solid" className={AR_STATUS_BADGE_TONES[invoice.status]}>
              {t(`statuses.${statusKey}`)}
            </CmxStatusBadge>
          </div>
          <p className="text-sm text-muted-foreground">
            {invoice.customer_name ?? invoice.customer_name2 ?? tAr('detail.noCustomer')}
          </p>
          <div className="flex flex-wrap gap-2">
            {invoice.order_id ? (
              <CmxButton asChild size="sm" variant="outline">
                <Link href={`/dashboard/orders/${invoice.order_id}`}>
                  {t('detail.forOrder', { orderId: invoice.order_no ?? invoice.order_id })}
                </Link>
              </CmxButton>
            ) : null}
            {invoice.customer_id ? (
              <CmxButton asChild size="sm" variant="ghost">
                <Link href={`/dashboard/internal_fin/ar/ledger?customerId=${invoice.customer_id}`}>
                  {tAr('detail.openLedger')}
                </Link>
              </CmxButton>
            ) : null}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <CmxKpiStatCard
          title={tAr('detail.kpis.total')}
          value={formatCurrency(invoice.total, invoice.currency_code)}
        />
        <CmxKpiStatCard
          title={tAr('detail.kpis.paid')}
          value={formatCurrency(invoice.paid_amount, invoice.currency_code)}
        />
        <CmxKpiStatCard
          title={tAr('detail.kpis.outstanding')}
          value={formatCurrency(invoice.outstanding_amount, invoice.currency_code)}
        />
        <CmxKpiStatCard
          title={tAr('detail.kpis.dueDate')}
          value={invoice.due_date ?? '—'}
        />
      </div>

      <CmxCard className="min-w-0">
        <CmxCardHeader>
          <CmxCardTitle>{tAr('detail.summaryTitle')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{tAr('detail.fields.invoiceType')}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{invoice.invoice_type_cd ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{tAr('detail.fields.issueDate')}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{invoice.issued_at ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{tAr('detail.fields.approval')}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{invoice.approval_action_cd ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-muted-foreground">{tAr('detail.fields.paymentTerms')}</p>
            <p className="mt-1 text-sm font-medium text-foreground">{invoice.payment_terms ?? '—'}</p>
          </div>
        </CmxCardContent>
      </CmxCard>

      <ArInvoiceDetailActions detail={detail} />

      <div className="min-w-0">
        <ArInvoiceDetailTabs detail={detail} />
      </div>
    </div>
    </RequireAnyPermission>
  );
}
