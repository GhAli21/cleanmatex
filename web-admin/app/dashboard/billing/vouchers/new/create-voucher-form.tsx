'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createAndIssueReceiptVoucherAction } from '@/app/actions/payments/voucher-crud-actions';

export default function CreateVoucherForm() {
  const t = useTranslations('billing.receiptVoucher.create');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isSubmitting, startSubmitting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form state
  const [invoiceId, setInvoiceId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [amount, setAmount] = useState('');
  const [currencyCode, setCurrencyCode] = useState('OMR');
  const [reasonCode, setReasonCode] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    // Validation
    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFieldErrors({ amount: t('amountInvalid') ?? 'Amount must be greater than zero' });
      return;
    }

    if (!invoiceId && !orderId && !customerId) {
      setError(t('atLeastOneReference') ?? 'At least one of Invoice, Order, or Customer is required');
      return;
    }

    startSubmitting(async () => {
      const result = await createAndIssueReceiptVoucherAction({
        invoice_id: invoiceId || undefined,
        order_id: orderId || undefined,
        customer_id: customerId || undefined,
        total_amount: parsedAmount,
        currency_code: currencyCode || undefined,
        reason_code: reasonCode || undefined,
      });

      if (result.success && result.data) {
        router.push(`/dashboard/billing/vouchers`);
      } else {
        setError(result.error || (t('error') ?? 'Failed to create voucher'));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="space-y-4">
          {/* Invoice */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('invoice') ?? 'Invoice ID'} <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={invoiceId}
              onChange={(e) => {
                setInvoiceId(e.target.value);
                setFieldErrors((prev) => ({ ...prev, invoice_id: undefined }));
              }}
              placeholder={t('invoicePlaceholder') ?? 'Enter invoice ID'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-invalid={!!fieldErrors.invoice_id}
            />
            {fieldErrors.invoice_id && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.invoice_id}</p>
            )}
          </div>

          {/* Order */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('order') ?? 'Order ID'} <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={orderId}
              onChange={(e) => {
                setOrderId(e.target.value);
                setFieldErrors((prev) => ({ ...prev, order_id: undefined }));
              }}
              placeholder={t('orderPlaceholder') ?? 'Enter order ID'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-invalid={!!fieldErrors.order_id}
            />
            {fieldErrors.order_id && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.order_id}</p>
            )}
          </div>

          {/* Customer */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('customer') ?? 'Customer ID'} <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={customerId}
              onChange={(e) => {
                setCustomerId(e.target.value);
                setFieldErrors((prev) => ({ ...prev, customer_id: undefined }));
              }}
              placeholder={t('customerPlaceholder') ?? 'Enter customer ID'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-invalid={!!fieldErrors.customer_id}
            />
            {fieldErrors.customer_id && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.customer_id}</p>
            )}
          </div>

          {/* Amount */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('amount') ?? 'Amount'} <span className="text-red-500">*</span>
            </label>
            <input
              type="number"
              step="0.001"
              min="0.001"
              value={amount}
              onChange={(e) => {
                setAmount(e.target.value);
                setFieldErrors((prev) => ({ ...prev, amount: undefined }));
              }}
              placeholder={t('amountPlaceholder') ?? '0.000'}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-invalid={!!fieldErrors.amount}
            />
            {fieldErrors.amount && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.amount}</p>
            )}
          </div>

          {/* Currency */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('currency') ?? 'Currency'}
            </label>
            <input
              type="text"
              value={currencyCode}
              onChange={(e) => setCurrencyCode(e.target.value.toUpperCase())}
              placeholder="OMR"
              maxLength={3}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Reason Code (optional) */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('reasonCode') ?? 'Reason Code'} <span className="text-gray-400">(optional)</span>
            </label>
            <input
              type="text"
              value={reasonCode}
              onChange={(e) => setReasonCode(e.target.value)}
              placeholder={t('reasonCodePlaceholder') ?? 'Enter reason code if applicable'}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <Link
          href="/dashboard/billing/vouchers"
          className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tCommon('cancel')}
        </Link>
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? (t('creating') ?? 'Creating...') : (t('create') ?? 'Create Voucher')}
        </button>
      </div>
    </form>
  );
}
