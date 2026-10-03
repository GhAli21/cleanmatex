'use client';

import { useMemo } from 'react';
import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useLocale } from '@/lib/hooks/useLocale';
import type { ReadyOrder } from '@features/orders/model/ready-order-types';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import { sourceLabel } from '@/lib/db/order-discounts-types';
import type { OrderDiscountLine } from '@/lib/db/order-discounts-types';
import {
  buildCashChangeRows,
  type CashChangePaymentLike,
  type CashChangeRoundingLike,
} from '@features/orders/model/cash-change-rows';

/** One tender on the receipt: what was paid, how, and (for cash) what was handed over and returned. */
export interface ReceiptPaymentLine extends CashChangePaymentLike {
  id: string;
  payment_method_code: string | null;
  payment_method_name_snapshot: string | null;
  amount: number;
  tendered_amount: number | null;
  payment_status: string | null;
}

/**
 *
 */
export type PrintLayout = 'thermal' | 'a4';

interface OrderReceiptPrintProps {
  order: ReadyOrder;
  layout: PrintLayout;
  discountLines?: OrderDiscountLine[];
  /** Completed tenders (with cash tendered / change); omitted when they could not be loaded. */
  payments?: ReceiptPaymentLine[];
  /** Net posted cash-change rounding per currency; empty/omitted when none applied. */
  cashChangeRounding?: CashChangeRoundingLike[];
}

/**
 *
 * @param root0
 * @param root0.order
 * @param root0.layout
 * @param root0.discountLines
 * @param root0.payments
 * @param root0.cashChangeRounding
 */
export function OrderReceiptPrint({
  order,
  layout,
  discountLines = [],
  payments = [],
  cashChangeRounding = [],
}: OrderReceiptPrintProps) {
  const tPaymentsDetail = useTranslations('orders.detailFull');
  const tOrders = useTranslations('orders');
  const tOrderDetail = useTranslations('orders.detail');
  const tWorkflowReady = useTranslations('workflow.ready');
  const tWorkflowLabels = useTranslations('workflow.labels');
  const tCommon = useTranslations('common');
  const isRTL = useRTL();
  const locale = useLocale();
  const { currencyCode, decimalPlaces } = useTenantCurrency();
  const moneyLocale = locale === 'ar' ? 'ar' : 'en';
  const fmt = (n: number) =>
    formatMoneyAmountWithCode(n, { currencyCode, decimalPlaces, locale: moneyLocale });

  const formattedReadyBy = useMemo(() => {
    if (!order.readyBy) return '';
    const date = new Date(order.readyBy);
    return date.toLocaleString(locale === 'ar' ? 'ar' : 'en', {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  }, [order.readyBy, locale]);

  // Only completed tenders belong on a receipt; a pending or failed attempt is not "paid".
  const receiptPayments = payments.filter((p) => !p.payment_status || p.payment_status === 'COMPLETED');
  const cashChangeRows = buildCashChangeRows(receiptPayments, cashChangeRounding, currencyCode);

  const containerWidthClass =
    layout === 'thermal' ? 'max-w-[80mm] w-full' : 'w-full max-w-a4';

  return (
    <div
      className={`mx-auto ${containerWidthClass} bg-white text-gray-900 print:bg-white`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <header className="print-header text-center">
        <h1 className="print-title">CleanMateX</h1>
        <p className="print-subtitle">
          {tWorkflowReady('description')}
        </p>
      </header>

      <section className="print-section">
        <div className="flex justify-between print-row">
          <span className="font-semibold">{tOrders('orderNumber')}</span>
          <span>{order.orderNo}</span>
        </div>
        <div className="flex justify-between print-row">
          <span className="font-semibold">{tWorkflowLabels('customer')}</span>
          <span>{order.customer.name}</span>
        </div> 
        <div className="flex justify-between print-row">
          <span className="font-semibold">{tWorkflowLabels('phone')}</span>
          <span>{order.customer.phone}</span>
        </div>
        {formattedReadyBy && (
          <div className="flex justify-between print-row">
            <span className="font-semibold">{tOrderDetail('readyBy')}</span>
            <span>{formattedReadyBy}</span>
          </div>
        )}
        <div className="flex justify-between print-row">
          <span className="font-semibold">{tWorkflowReady('rack')}</span>
          <span>{order.rackLocation || '-'}</span>
        </div>
      </section>

      <section className="print-section border-t border-b border-gray-200 py-2">
        <h2>{tWorkflowReady('itemsTitle')}</h2>
        <div className="space-y-1">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between">
              <div className="flex-1">
                <div className="font-medium">{item.productName}</div>
                <div className="text-[11px] text-gray-500">
                  {tWorkflowReady('quantity')}: {item.quantity}
                </div>
              </div>
              <div className="text-right text-[11px]">
                {fmt(item.totalPrice)}
              </div>
            </div>
          ))}
        </div>
      </section>

      {discountLines.length > 0 && (
        <section className="print-section border-t border-gray-200 pt-2">
          <div className="flex justify-between print-row">
            <span className="font-semibold">{tOrderDetail('discount')}</span>
            <span className="text-red-600">
              -{fmt(discountLines.reduce((s, l) => s + l.discount_amount, 0))}
            </span>
          </div>
          {discountLines.map((line) => (
            <div key={line.id} className="flex justify-between text-xs text-gray-500 ps-3">
              <span>{sourceLabel(line.source_type, locale === 'ar' ? 'ar' : 'en')}</span>
              <span>-{fmt(line.discount_amount)}</span>
            </div>
          ))}
        </section>
      )}

      <section className="print-section">
        <div className="flex justify-between print-row">
          <span className="font-semibold">{tWorkflowReady('totalAmount')}</span>
          <span className="font-semibold">{fmt(order.total)}</span>
        </div>
        {order.paymentSummary && (
          <>
            <div className="flex justify-between print-row">
              <span>{tOrders('paidAmount')}</span>
              <span className="text-green-700">
                {fmt(order.paymentSummary.paid)}
              </span>
            </div>
            <div className="flex justify-between print-row">
              <span>{tWorkflowReady('paymentSection.remainingDue')}</span>
              <span className="text-orange-700">
                {fmt(order.paymentSummary.remaining)}
              </span>
            </div>
          </>
        )}
      </section>

      {receiptPayments.length > 0 && (
        <section className="print-section">
          <h2>{tOrders('payments')}</h2>
          {receiptPayments.map((p) => {
            const lineCurrency = (p.currency_code?.trim() || currencyCode) as string;
            const money = (n: number) =>
              formatMoneyAmountWithCode(n, { currencyCode: lineCurrency, decimalPlaces, locale: moneyLocale });
            const tendered = Number(p.tendered_amount ?? 0);
            const change = Number(p.change_returned_amount ?? 0);
            return (
              <div key={p.id} className="space-y-0.5">
                <div className="flex justify-between print-row">
                  <span>{p.payment_method_name_snapshot ?? p.payment_method_code ?? '—'}</span>
                  <span>{money(Number(p.amount))}</span>
                </div>
                {tendered > Number(p.amount) && (
                  <div className="flex justify-between text-xs text-gray-500 ps-3">
                    <span>{tPaymentsDetail('tenderedAmount')}</span>
                    <span>{money(tendered)}</span>
                  </div>
                )}
                {change > 0 && (
                  <div className="flex justify-between text-xs text-gray-500 ps-3">
                    <span>{tPaymentsDetail('changeReturned')}</span>
                    <span>{money(change)}</span>
                  </div>
                )}
              </div>
            );
          })}
          {cashChangeRows.map((row) => {
            const money = (n: number) =>
              formatMoneyAmountWithCode(n, { currencyCode: row.currencyCode, decimalPlaces, locale: moneyLocale });
            return (
              <div key={row.currencyCode} className="mt-1 space-y-0.5 border-t border-dashed border-gray-300 pt-1 text-xs">
                <div className="flex justify-between">
                  <span>{tPaymentsDetail('exactChange')}</span>
                  <span>{money(row.exactChange)}</span>
                </div>
                <div className="flex justify-between">
                  <span>{row.adjustment > 0 ? tPaymentsDetail('roundingGain') : tPaymentsDetail('roundingLoss')}</span>
                  <span>{money(Math.abs(row.adjustment))}</span>
                </div>
                <div className="flex justify-between font-medium">
                  <span>{tPaymentsDetail('handedOut')}</span>
                  <span>{money(row.handedOut)}</span>
                </div>
              </div>
            );
          })}
        </section>
      )}

      <footer className="print-footer">
        <p>{tCommon('thanks') ?? 'Thank you for your business!'}</p>
      </footer>
    </div>
  );
}

