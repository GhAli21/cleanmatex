'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useLocale } from '@/lib/hooks/useLocale';
import type { VoucherData } from '@/lib/types/voucher';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';
import { VoucherStatusBadge } from '@features/finance/vouchers/ui/voucher-status-badge';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import { formatMoneyAmountWithCode } from '@/lib/money/format-money';
import type {
  OrderChargeRow,
  OrderTaxRow,
  OrderPaymentRow,
  OrderDiscountRow,
} from '@/app/actions/orders/get-order-financial';

/**
 *
 */
export interface BillingReceiptVoucherPrintRprtData {
  voucher: VoucherData;
  payment?: {
    id: string;
    payment_method_code: string;
    paid_at: Date | null;
    transaction_id?: string | null;
  };
  invoice?: {
    invoice_no: string;
    invoice_date: Date | null;
  };
  order?: {
    order_no: string;
  };
  customer?: {
    name: string;
    phone?: string | null;
    email?: string | null;
  };
  tenant?: {
    name: string;
    phone?: string | null;
    address?: string | null;
  };
  financial?: {
    charges: OrderChargeRow[];
    taxes: OrderTaxRow[];
    discounts: OrderDiscountRow[];
    paymentLegs: OrderPaymentRow[];
  };
}

interface BillingReceiptVoucherPrintRprtProps {
  data: BillingReceiptVoucherPrintRprtData;
}

function formatDate(date: Date | string | null | undefined, locale: string): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale === 'ar' ? 'ar' : 'en', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 *
 * @param root0
 * @param root0.data
 */
export function BillingReceiptVoucherPrintRprt({ data }: BillingReceiptVoucherPrintRprtProps) {
  const tBilling = useTranslations('billing');
  const tCommon = useTranslations('common');
  const tPayments = useTranslations('payments');
  const isRTL = useRTL();
  const locale = useLocale();
  const { currencyCode: tenantCurrency, decimalPlaces } = useTenantCurrency();
  const moneyLocale = locale === 'ar' ? 'ar' : 'en';

  const { voucher, payment, invoice, order, customer, tenant, financial } = data;
  const voucherCurrency = (voucher.currency_code?.trim() || tenantCurrency) as string;

  return (
    <div
      className="mx-auto w-full max-w-a4 bg-white text-gray-900 print:bg-white"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <header className="print-header">
        <div className="flex justify-between print-subtitle">
          <span>{tenant?.name ?? tBilling('receiptVoucher.defaultBusinessName')}</span>
          <span>{voucher.voucher_no}</span>
        </div>
        <h1 className="print-title mt-1">
          {tBilling('receiptVoucher.title')}
        </h1>
        <p className="print-subtitle text-xs mt-0.5">
          {formatDate(voucher.issued_at ?? voucher.created_at, locale)}
        </p>
      </header>

      {/* Voucher Details */}
      <section className="print-section">
        <h2>{tBilling('receiptVoucher.voucherDetails')}</h2>
        <div className="space-y-1">
          <div className="flex justify-between print-row">
            <span>{tBilling('receiptVoucher.voucherNo')}</span>
            <span className="font-mono font-medium">{voucher.voucher_no}</span>
          </div>
          {invoice && (
            <div className="flex justify-between print-row">
              <span>{tBilling('receiptVoucher.invoiceNo')}</span>
              <span>{invoice.invoice_no}</span>
            </div>
          )}
          {order && (
            <div className="flex justify-between print-row">
              <span>{tBilling('receiptVoucher.orderNo')}</span>
              <span>{order.order_no}</span>
            </div>
          )}
          <div className="flex justify-between print-row">
            <span>{tCommon('date')}</span>
            <span>{formatDate(voucher.issued_at ?? voucher.created_at, locale)}</span>
          </div>
          {payment && (
            <div className="flex justify-between print-row">
              <span>{tPayments('paymentMethod')}</span>
              <span>{payment.payment_method_code}</span>
            </div>
          )}
        </div>
      </section>

      {/* Customer Info */}
      {customer && (
        <section className="print-section">
          <h2>{tBilling('receiptVoucher.customerInfo')}</h2>
          <div className="space-y-1">
            <div className="flex justify-between print-row">
              <span>{tCommon('name')}</span>
              <span>{customer.name}</span>
            </div>
            {customer.phone && (
              <div className="flex justify-between print-row">
                <span>{tCommon('phone')}</span>
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.email && (
              <div className="flex justify-between print-row">
                <span>{tCommon('email')}</span>
                <span>{customer.email}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Payment Amount */}
      <section className="print-section">
        <div className="rounded-lg border-2 border-gray-300 bg-gray-50 p-4">
          <div className="flex justify-between items-center">
            <span className="text-lg font-semibold">
              {tBilling('receiptVoucher.amountPaid')}
            </span>
            <span className="text-2xl font-bold text-gray-900">
              {formatMoneyAmountWithCode(Number(voucher.total_amount ?? 0), {
                currencyCode: voucherCurrency,
                decimalPlaces,
                locale: moneyLocale,
              })}
            </span>
          </div>
        </div>
      </section>

      {/* Charges breakdown */}
      {financial && financial.charges.length > 0 && (
        <section className="print-section">
          <h2>{tBilling('receiptVoucher.charges')}</h2>
          <div className="space-y-1">
            {financial.charges.map((c) => (
              <div key={c.id} className="flex justify-between print-row">
                <span>{c.label || c.charge_type}</span>
                <span className="tabular-nums">
                  {formatMoneyAmountWithCode(c.amount, { currencyCode: c.currency_code || voucherCurrency, decimalPlaces, locale: moneyLocale })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Discounts / credits applied */}
      {financial && financial.discounts.length > 0 && (
        <section className="print-section">
          <h2>{tBilling('receiptVoucher.discounts')}</h2>
          <div className="space-y-1">
            {financial.discounts.map((d) => (
              <div key={d.id} className="flex justify-between print-row text-green-700">
                <span>{d.source_name || d.source_type}</span>
                <span className="tabular-nums">
                  −{formatMoneyAmountWithCode(d.discount_amount, { currencyCode: voucherCurrency, decimalPlaces, locale: moneyLocale })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Tax breakdown */}
      {financial && financial.taxes.length > 0 && (
        <section className="print-section">
          <h2>{tBilling('receiptVoucher.taxes')}</h2>
          <div className="space-y-1">
            {financial.taxes.map((t) => (
              <div key={t.id} className="flex justify-between print-row">
                <span>{t.label} ({t.rate}%)</span>
                <span className="tabular-nums">
                  {formatMoneyAmountWithCode(t.tax_amount, { currencyCode: t.currency_code || voucherCurrency, decimalPlaces, locale: moneyLocale })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Multi-leg payment breakdown */}
      {financial && financial.paymentLegs.length > 1 && (
        <section className="print-section">
          <h2>{tBilling('receiptVoucher.paymentBreakdown')}</h2>
          <div className="space-y-1">
            {financial.paymentLegs.map((leg) => (
              <div key={leg.id} className="flex justify-between print-row">
                <span>{leg.payment_method_code || '—'}</span>
                <span className="tabular-nums">
                  {formatMoneyAmountWithCode(leg.amount, { currencyCode: voucherCurrency, decimalPlaces, locale: moneyLocale })}
                </span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Payment Details */}
      {payment && (
        <section className="print-section">
          <h2>{tBilling('receiptVoucher.paymentDetails')}</h2>
          <div className="space-y-1">
            {payment.transaction_id && (
              <div className="flex justify-between print-row">
                <span>{tPayments('transactionId')}</span>
                <span className="font-mono text-xs">{payment.transaction_id}</span>
              </div>
            )}
            <div className="flex justify-between print-row">
              <span>{tCommon('status')}</span>
              <VoucherStatusBadge status={voucher.voucher_status ?? 'DRAFT'} />
            </div>
          </div>
        </section>
      )}

      {/* Tenant Info */}
      {tenant && (
        <section className="print-section">
          <h2>{tBilling('receiptVoucher.businessInfo')}</h2>
          <div className="space-y-1">
            <div className="flex justify-between print-row">
              <span>{tCommon('name')}</span>
              <span>{tenant.name}</span>
            </div>
            {tenant.phone && (
              <div className="flex justify-between print-row">
                <span>{tCommon('phone')}</span>
                <span>{tenant.phone}</span>
              </div>
            )}
            {tenant.address && (
              <div className="flex justify-between print-row">
                <span>{tCommon('address')}</span>
                <span>{tenant.address}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="print-footer">
        <p>{tBilling('receiptVoucher.thankYou')}</p>
        {voucher.voucher_status === VOUCHER_STATUS.CANCELLED && voucher.void_reason && (
          <p className="text-red-600 text-sm mt-2">
            {tBilling('receiptVoucher.voided')} — {voucher.void_reason}
          </p>
        )}
      </footer>
    </div>
  );
}
