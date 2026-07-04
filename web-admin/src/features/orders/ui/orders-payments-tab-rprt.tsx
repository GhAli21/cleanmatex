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
import type { OrderPaymentRow } from '@/lib/services/order-financial-summary.service';

interface OrdersPaymentsTabRprtProps {
  /** Canonical payment rows from `org_order_payments_dtl` (single payment truth — ADR-002). */
  payments: OrderPaymentRow[];
  filterVoucherId?: string | null;
  translations: {
    emptyPayments: string;
    searchByVoucherId: string;
    paymentId?: string;
    voucherId?: string;
    notes?: string;
  };
}

/**
 * Order Payments tab — lists the canonical `org_order_payments_dtl` rows for
 * one order. Reads the same rows the financial snapshot engine aggregates, so
 * this tab can never disagree with the Financial tab on the same screen.
 * @param root0
 * @param root0.payments
 * @param root0.filterVoucherId
 * @param root0.translations
 */
export function OrdersPaymentsTabRprt({
  payments,
  filterVoucherId,
  translations: t,
}: OrdersPaymentsTabRprtProps) {
  const tDetail = useTranslations('orders.detailFull');
  const isRTL = useRTL();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const moneyLocale = isRTL ? 'ar' : 'en';
  const [searchVoucherId, setSearchVoucherId] = useState(filterVoucherId ?? '');

  useEffect(() => {
    if (filterVoucherId != null) setSearchVoucherId(filterVoucherId);
  }, [filterVoucherId]);

  const filtered = useMemo(() => {
    if (!searchVoucherId.trim()) return payments;
    return payments.filter((payment) => payment.fin_voucher_id === searchVoucherId.trim());
  }, [payments, searchVoucherId]);

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
              const paidDate = payment.paid_at ?? payment.created_at;
              const paymentCurrency = payment.currency_code?.trim() || currencyCode;
              const fmtMoney = (value: number) =>
                formatMoneyAmountWithCode(value, {
                  currencyCode: paymentCurrency,
                  decimalPlaces,
                  locale: moneyLocale,
                });

              return (
                <tr key={payment.id} className="border-b border-gray-100 align-top hover:bg-gray-50">
                  <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="space-y-2">
                      <CopyValue value={payment.id} maxLength={12} className="font-medium" />
                      {payment.fin_voucher_id && (
                        <Link
                          href={`/dashboard/internal_fin/vouchers/${payment.fin_voucher_id}`}
                          className="inline-flex items-center gap-1 rounded-full border border-border px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-muted"
                        >
                          {tDetail('openVoucher')}
                          <ArrowUpRight className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="space-y-2">
                      <CopyValue value={fmtMoney(payment.amount)} className="font-medium" />
                      {payment.tendered_amount != null && payment.tendered_amount > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {tDetail('tenderedAmount')}: {fmtMoney(payment.tendered_amount)}
                        </div>
                      )}
                      {payment.change_returned_amount != null && payment.change_returned_amount > 0 && (
                        <div className="text-xs text-muted-foreground">
                          {tDetail('changeReturned')}: {fmtMoney(payment.change_returned_amount)}
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        {tDetail('currencyCode')}: {paymentCurrency}
                      </div>
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="space-y-2">
                      <CopyValue
                        value={payment.payment_method_name_snapshot ?? payment.payment_method_code}
                        className="font-medium"
                      />
                      <div className="text-sm text-muted-foreground">
                        {payment.payment_status ?? '—'}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {payment.gateway_code ?? '—'}
                      </div>
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{t.voucherId ?? 'Voucher ID'}:</span>{' '}
                        {payment.fin_voucher_id ? (
                          <Link
                            href={`/dashboard/internal_fin/vouchers/${payment.fin_voucher_id}`}
                            className="font-medium text-primary hover:underline"
                          >
                            {payment.fin_voucher_id.slice(0, 8)}...
                          </Link>
                        ) : (
                          '—'
                        )}
                      </div>
                      <div>
                        <span className="text-muted-foreground">{tDetail('gatewayReference')}:</span>{' '}
                        <CopyValue
                          value={payment.gateway_reference ?? payment.gateway_transaction_id}
                          maxLength={16}
                          className="inline"
                        />
                      </div>
                    </div>
                  </td>
                  <td className={`px-4 py-3 ${isRTL ? 'text-right' : 'text-left'}`}>
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="text-muted-foreground">{tDetail('cardBrand')}:</span>{' '}
                        <CopyValue value={payment.card_brand_code} className="inline" />
                      </div>
                      <div>
                        <span className="text-muted-foreground">{tDetail('cardLastFour')}:</span>{' '}
                        <CopyValue value={payment.card_last4} className="inline" />
                      </div>
                      <div>
                        <span className="text-muted-foreground">{tDetail('checkNumber')}:</span>{' '}
                        <CopyValue value={payment.check_no} className="inline" />
                      </div>
                      <div>
                        <span className="text-muted-foreground">{tDetail('bankReference')}:</span>{' '}
                        <CopyValue value={payment.bank_reference} className="inline" />
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
                    <CopyValue value={payment.rec_notes} maxLength={28} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filtered.length === 0 && searchVoucherId && (
        <p className="text-sm text-gray-500">{tDetail('noPaymentsMatch')}</p>
      )}
    </div>
  );
}
