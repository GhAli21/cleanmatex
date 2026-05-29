'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives/cmx-card';
import { Badge } from '@ui/primitives/badge';
import type { OrderFinancialSummaryViewModel } from '@features/orders/model/order-financial-summary-view';
import { OrderFinancialMoneyValue } from './order-financial-money-value';

interface OrderPaymentsCreditsTablesProps {
  viewModel: OrderFinancialSummaryViewModel;
}

function paymentStatusVariant(status: string | null): 'success' | 'warning' | 'destructive' | 'secondary' | 'info' {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'PENDING':
    case 'PROCESSING':
      return 'warning';
    case 'FAILED':
      return 'destructive';
    case 'REFUNDED':
      return 'info';
    default:
      return 'secondary';
  }
}

export function OrderPaymentsCreditsTables({ viewModel }: OrderPaymentsCreditsTablesProps) {
  const t = useTranslations('orders.detail.financial');
  const isRTL = useRTL();
  const { payments, creditApplications, currencyCode } = viewModel;
  const th = `px-3 py-2 text-xs font-semibold uppercase text-muted-foreground ${isRTL ? 'text-right' : 'text-left'}`;
  const td = `px-3 py-2 text-sm ${isRTL ? 'text-right' : 'text-left'}`;

  return (
    <div className="space-y-6">
      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('realPaymentsTable')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className={th}>{t('col.method')}</th>
                <th className={`${th} ${isRTL ? 'text-left' : 'text-right'}`}>{t('col.amount')}</th>
                <th className={th}>{t('col.status')}</th>
                <th className={th}>{t('col.voucher')}</th>
                <th className={th}>{t('col.reference')}</th>
                <th className={th}>{t('col.date')}</th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={6} className={`${td} py-8 text-muted-foreground`}>
                    {t('none')}
                  </td>
                </tr>
              ) : (
                payments.map((p) => (
                  <tr key={p.id} className="border-b border-border/60">
                    <td className={td}>{p.payment_method_code?.replace(/_/g, ' ') ?? '—'}</td>
                    <td className={`${td} ${isRTL ? 'text-left' : 'text-right'}`}>
                      <OrderFinancialMoneyValue amount={p.amount} currencyCode={currencyCode} />
                    </td>
                    <td className={td}>
                      <Badge variant={paymentStatusVariant(p.payment_status)}>
                        {p.payment_status ?? '—'}
                      </Badge>
                    </td>
                    <td className={td}>
                      {p.fin_voucher_id ? (
                        <Link
                          href={`/dashboard/internal_fin/vouchers/${p.fin_voucher_id}`}
                          className="text-primary hover:underline"
                        >
                          {t('openVoucher')}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={td}>{p.gateway_reference ?? '—'}</td>
                    <td className={td}>{new Date(p.created_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CmxCardContent>
      </CmxCard>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('creditApplicationsTable')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent className="overflow-x-auto p-0 sm:p-0">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr className="border-b border-border bg-muted/40">
                <th className={th}>{t('col.creditType')}</th>
                <th className={`${th} ${isRTL ? 'text-left' : 'text-right'}`}>{t('col.amount')}</th>
                <th className={th}>{t('col.reference')}</th>
                <th className={th}>{t('col.voucher')}</th>
                <th className={th}>{t('col.date')}</th>
              </tr>
            </thead>
            <tbody>
              {creditApplications.length === 0 ? (
                <tr>
                  <td colSpan={5} className={`${td} py-8 text-muted-foreground`}>
                    {t('none')}
                  </td>
                </tr>
              ) : (
                creditApplications.map((c) => (
                  <tr key={c.id} className="border-b border-border/60">
                    <td className={td}>{c.credit_type.replace(/_/g, ' ')}</td>
                    <td className={`${td} ${isRTL ? 'text-left' : 'text-right'}`}>
                      <OrderFinancialMoneyValue
                        amount={c.applied_amount}
                        currencyCode={currencyCode}
                        variant="credit"
                      />
                    </td>
                    <td className={td}>{c.reference_no ?? '—'}</td>
                    <td className={td}>
                      {c.fin_voucher_id ? (
                        <Link
                          href={`/dashboard/internal_fin/vouchers/${c.fin_voucher_id}`}
                          className="text-primary hover:underline"
                        >
                          {t('openVoucher')}
                        </Link>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={td}>{new Date(c.applied_at).toLocaleString()}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}
