'use client';

import { useTranslations } from 'next-intl';
import { useRTL } from '@/lib/hooks/useRTL';
import { useLocale } from '@/lib/hooks/useLocale';
import type { VoucherData } from '@/lib/types/voucher';

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
}

interface BillingReceiptVoucherPrintRprtProps {
  data: BillingReceiptVoucherPrintRprtData;
}

function formatDate(date: Date | string | null | undefined, locale: string): string {
  if (!date) return '—';
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale === 'ar' ? 'ar-OM' : 'en-OM', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatMoney(amount: number, currency: string = 'OMR'): string {
  return `${amount.toFixed(3)} ${currency}`;
}

export function BillingReceiptVoucherPrintRprt({ data }: BillingReceiptVoucherPrintRprtProps) {
  const tBilling = useTranslations('billing');
  const tCommon = useTranslations('common');
  const tPayments = useTranslations('payments');
  const isRTL = useRTL();
  const locale = useLocale();

  const { voucher, payment, invoice, order, customer, tenant } = data;

  return (
    <div
      className="mx-auto w-full max-w-a4 bg-white text-gray-900 print:bg-white"
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <header className="print-header">
        <div className="flex justify-between print-subtitle">
          <span>{tenant?.name ?? 'CleanMateX'}</span>
          <span>{voucher.voucher_no}</span>
        </div>
        <h1 className="print-title mt-1">
          {tBilling('receiptVoucher.title') ?? 'Receipt Voucher'}
        </h1>
        <p className="print-subtitle text-xs mt-0.5">
          {formatDate(voucher.issued_at ?? voucher.created_at, locale)}
        </p>
      </header>

      {/* Voucher Details */}
      <section className="print-section">
        <h2>{tBilling('receiptVoucher.voucherDetails') ?? 'Voucher Details'}</h2>
        <div className="space-y-1">
          <div className="flex justify-between print-row">
            <span>{tBilling('receiptVoucher.voucherNo') ?? 'Voucher #'}</span>
            <span className="font-mono font-medium">{voucher.voucher_no}</span>
          </div>
          {invoice && (
            <div className="flex justify-between print-row">
              <span>{tBilling('receiptVoucher.invoiceNo') ?? 'Invoice #'}</span>
              <span>{invoice.invoice_no}</span>
            </div>
          )}
          {order && (
            <div className="flex justify-between print-row">
              <span>{tBilling('receiptVoucher.orderNo') ?? 'Order #'}</span>
              <span>{order.order_no}</span>
            </div>
          )}
          <div className="flex justify-between print-row">
            <span>{tCommon('date') ?? 'Date'}</span>
            <span>{formatDate(voucher.issued_at ?? voucher.created_at, locale)}</span>
          </div>
          {payment && (
            <div className="flex justify-between print-row">
              <span>{tPayments('paymentMethod') ?? 'Payment Method'}</span>
              <span>{payment.payment_method_code}</span>
            </div>
          )}
        </div>
      </section>

      {/* Customer Info */}
      {customer && (
        <section className="print-section">
          <h2>{tBilling('receiptVoucher.customerInfo') ?? 'Customer Information'}</h2>
          <div className="space-y-1">
            <div className="flex justify-between print-row">
              <span>{tCommon('name') ?? 'Name'}</span>
              <span>{customer.name}</span>
            </div>
            {customer.phone && (
              <div className="flex justify-between print-row">
                <span>{tCommon('phone') ?? 'Phone'}</span>
                <span>{customer.phone}</span>
              </div>
            )}
            {customer.email && (
              <div className="flex justify-between print-row">
                <span>{tCommon('email') ?? 'Email'}</span>
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
              {tBilling('receiptVoucher.amountPaid') ?? 'Amount Paid'}
            </span>
            <span className="text-2xl font-bold text-gray-900">
              {formatMoney(voucher.total_amount, voucher.currency_code ?? 'OMR')}
            </span>
          </div>
        </div>
      </section>

      {/* Payment Details */}
      {payment && (
        <section className="print-section">
          <h2>{tBilling('receiptVoucher.paymentDetails') ?? 'Payment Details'}</h2>
          <div className="space-y-1">
            {payment.transaction_id && (
              <div className="flex justify-between print-row">
                <span>{tPayments('transactionId') ?? 'Transaction ID'}</span>
                <span className="font-mono text-xs">{payment.transaction_id}</span>
              </div>
            )}
            <div className="flex justify-between print-row">
              <span>{tCommon('status') ?? 'Status'}</span>
              <span className="capitalize">{voucher.status}</span>
            </div>
          </div>
        </section>
      )}

      {/* Tenant Info */}
      {tenant && (
        <section className="print-section">
          <h2>{tBilling('receiptVoucher.businessInfo') ?? 'Business Information'}</h2>
          <div className="space-y-1">
            <div className="flex justify-between print-row">
              <span>{tCommon('name') ?? 'Name'}</span>
              <span>{tenant.name}</span>
            </div>
            {tenant.phone && (
              <div className="flex justify-between print-row">
                <span>{tCommon('phone') ?? 'Phone'}</span>
                <span>{tenant.phone}</span>
              </div>
            )}
            {tenant.address && (
              <div className="flex justify-between print-row">
                <span>{tCommon('address') ?? 'Address'}</span>
                <span>{tenant.address}</span>
              </div>
            )}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="print-footer">
        <p>{tBilling('receiptVoucher.thankYou') ?? 'Thank you for your business!'}</p>
        {voucher.status === 'voided' && voucher.void_reason && (
          <p className="text-red-600 text-sm mt-2">
            {tBilling('receiptVoucher.voided') ?? 'VOIDED'} — {voucher.void_reason}
          </p>
        )}
      </footer>
    </div>
  );
}
