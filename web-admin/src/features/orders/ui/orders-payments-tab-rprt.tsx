'use client';
/* eslint-disable react-hooks/set-state-in-effect */

import Link from 'next/link';
import { useMemo, useState, useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { Search, CreditCard, ArrowUpRight } from 'lucide-react';
import { useRTL } from '@/lib/hooks/useRTL';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { CmxInput } from '@ui/primitives';
import { CmxCopyableCell } from '@ui/data-display/cmx-copyable-cell';
import type { PaymentTransaction } from '@/lib/types/payment';

interface OrdersPaymentsTabRprtProps {
  payments: PaymentTransaction[];
  filterInvoiceId?: string | null;
  filterVoucherId?: string | null;
  translations: {
    emptyPayments: string;
    searchByInvoiceId: string;
    searchByVoucherId: string;
    paymentId?: string;
    invoiceId?: string;
    voucherId?: string;
    transactionId?: string;
    gateway?: string;
    notes?: string;
  };
}

/**
 *
 * @param root0
 * @param root0.payments
 * @param root0.filterInvoiceId
 * @param root0.filterVoucherId
 * @param root0.translations
 */
export function OrdersPaymentsTabRprt({
  payments,
  filterInvoiceId,
  filterVoucherId,
  translations: t,
}: OrdersPaymentsTabRprtProps) {
  const tDetail = useTranslations('orders.detailFull');
  const isRTL = useRTL();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const moneyLocale = isRTL ? 'ar' : 'en';
  const [searchInvoiceId, setSearchInvoiceId] = useState(filterInvoiceId ?? '');
  const [searchVoucherId, setSearchVoucherId] = useState(filterVoucherId ?? '');

  useEffect(() => {
    if (filterInvoiceId != null) setSearchInvoiceId(filterInvoiceId);
    if (filterVoucherId != null) setSearchVoucherId(filterVoucherId);
  }, [filterInvoiceId, filterVoucherId]);

  const filtered = useMemo(() => {
    let result = payments;
    if (searchInvoiceId.trim()) {
      result = result.filter((payment) => payment.invoice_id === searchInvoiceId.trim());
    }
    if (searchVoucherId.trim()) {
      result = result.filter((payment) => payment.voucher_id === searchVoucherId.trim());
    }
    return result;
  }, [payments, searchInvoiceId, searchVoucherId]);

  const CopyValue = ({
    value,
    maxLength,
    className = '',
  }: {
    value: string | number | null | undefined;
    maxLength?: number;
    className?: string;
  }) => (
    <CmxCopyableCell
      as="span"
      value={value}
      maxLength={maxLength}
      align={isRTL ? 'right' : 'left'}
      className={`px-0 py-0 text-sm text-foreground ${className}`}
    />
  );

  if (payments.length === 0) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 text-gray-500 ${isRTL ? 'text-right' : 'text-left'}`}
      >
        <CreditCard className="mb-3 h-12 w-12 text-gray-300" />
        <p>{t.emptyPayments}</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={`flex flex-wrap gap-4 ${isRTL ? 'flex-row-reverse' : ''}`}>
        <div className="relative min-w-[180px] flex-1">
          <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ${isRTL ? 'left-auto right-3' : 'left-3 right-auto'}`} />
          <CmxInput
            type="text"
            placeholder={t.searchByInvoiceId}
            value={searchInvoiceId}
            onChange={(e) => setSearchInvoiceId(e.target.value)}
            className={isRTL ? 'pl-3 pr-10' : 'pl-10 pr-3'}
          />
        </div>
        <div className="relative min-w-[180px] flex-1">
          <Search className={`absolute top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 ${isRTL ? 'left-auto right-3' : 'left-3 right-auto'}`} />
          <CmxInput
            type="text"
            placeholder={t.searchByVoucherId}
            value={searchVoucherId}
            onChange={(e) => setSearchVoucherId(e.target.value)}
            className={isRTL ? 'pl-3 pr-10' : 'pl-10 pr-3'}
          />
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.paymentId ?? 'ID'}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {tDetail('amountSummary')}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {tDetail('methodAndStatus')}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {tDetail('references')}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {tDetail('instrument')}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {tDetail('paidAt')}
              </th>
              <th className={`px-4 py-3 text-sm font-medium text-gray-700 ${isRTL ? 'text-right' : 'text-left'}`}>
                {t.notes ?? 'Notes'}
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((payment) => {
              const metadata = (payment.metadata ?? {}) as Record<string, unknown>;
              const paidDate = payment.paid_at ?? payment.created_at;
              const paymentCurrency = payment.currency_code?.trim() || currencyCode;

              return (
                <tr key={payment.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
                  <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <CopyValue value={payment.id} maxLength={12} className="font-medium" />
                        <Link
                          href={`/dashboard/internal_fin/payments/${payment.id}`}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted"
                        >
                          {tDetail('openPayment')}
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      </div>
                      <CopyValue value={payment.transaction_id} maxLength={16} className="text-muted-foreground" />
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="space-y-2">
                      <CopyValue
                        value={formatMoneyAmountWithCode(Number(payment.paid_amount ?? 0), {
                          currencyCode: paymentCurrency,
                          decimalPlaces,
                          locale: moneyLocale,
                        })}
                        className="font-medium"
                      />
                      <div className="text-xs text-muted-foreground">
                        {tDetail('currencyCode')}: {paymentCurrency}
                      </div>
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="space-y-2">
                      <CopyValue value={payment.payment_method_code} className="font-medium" />
                      <div className="text-sm text-muted-foreground">
                        {payment.status ?? '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {payment.gateway ?? '—'}
                      </div>
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t.invoiceId ?? 'Invoice ID'}:</span>{' '}
                        {payment.invoice_id ? (
                          <Link href={`/dashboard/internal_fin/invoices/${payment.invoice_id}`} className="font-medium text-primary hover:underline">
                            {payment.invoice_id.slice(0, 8)}...
                          </Link>
                        ) : (
                          '—'
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t.voucherId ?? 'Voucher ID'}:</span>{' '}
                        {payment.voucher_id ? (
                          <Link href={`/dashboard/internal_fin/vouchers/${payment.voucher_id}`} className="font-medium text-primary hover:underline">
                            {payment.voucher_id.slice(0, 8)}...
                          </Link>
                        ) : (
                          '—'
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{t.transactionId ?? 'Transaction ID'}:</span>{' '}
                        <CopyValue value={payment.transaction_id} maxLength={16} className="inline" />
                      </div>
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{tDetail('cardBrand')}:</span>{' '}
                        <CopyValue value={typeof metadata.card_brand === 'string' ? metadata.card_brand : null} className="inline" />
                      </div>
                      <div>
                        <span className="text-muted-foreground">{tDetail('cardLastFour')}:</span>{' '}
                        <CopyValue value={typeof metadata.card_last_four === 'string' ? metadata.card_last_four : null} className="inline" />
                      </div>
                      <div>
                        <span className="text-muted-foreground">{tDetail('bankReference')}:</span>{' '}
                        <CopyValue value={typeof metadata.bank_reference === 'string' ? metadata.bank_reference : null} className="inline" />
                      </div>
                      <div>
                        <span className="text-muted-foreground">{tDetail('gatewayReference')}:</span>{' '}
                        <CopyValue value={typeof metadata.gateway_transaction_id === 'string' ? metadata.gateway_transaction_id : null} className="inline" />
                      </div>
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="space-y-2 text-sm">
                      <CopyValue value={paidDate ? new Date(paidDate).toLocaleString() : null} />
                      <div className="text-xs text-muted-foreground">
                        {tDetail('createdAt')}: {payment.created_at ? new Date(payment.created_at).toLocaleString() : '—'}
                      </div>
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="space-y-2">
                      <CopyValue value={payment.rec_notes} maxLength={28} />
                      {typeof metadata.failure_reason === 'string' && metadata.failure_reason.trim() && (
                        <div className="text-xs text-destructive">
                          {tDetail('failureReason')}: {metadata.failure_reason}
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && (searchInvoiceId || searchVoucherId) && (
        <p className="text-sm text-gray-500">{tDetail('noPaymentsMatch')}</p>
      )}
    </div>
  );
}
