'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from 'next/navigation';
import { createStandalonePaymentAction } from '@/app/actions/payments/payment-crud-actions';
import { createStandalonePaymentSchema } from '@/lib/validations/payment-crud-schemas';

interface PaymentMethodOption {
  code: string;
  name: string;
}

interface PaymentTypeOption {
  code: string;
  name: string;
}

interface CreatePaymentFormProps {
  paymentMethods: PaymentMethodOption[];
  paymentTypes: PaymentTypeOption[];
  defaultCurrencyCode: string;
}

const PAYMENT_KINDS = ['invoice', 'deposit', 'advance', 'pos'] as const;

export default function CreatePaymentForm({
  paymentMethods,
  paymentTypes,
  defaultCurrencyCode,
}: CreatePaymentFormProps) {
  const t = useTranslations('payments.create');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const [isSubmitting, startSubmitting] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Form state
  const [paymentKind, setPaymentKind] = useState<string>('invoice');
  const [customerId, setCustomerId] = useState('');
  const [orderId, setOrderId] = useState('');
  const [invoiceId, setInvoiceId] = useState('');
  const [amount, setAmount] = useState('');
  const [currencyCode, setCurrencyCode] = useState(defaultCurrencyCode);
  const [methodCode, setMethodCode] = useState('');
  const [paymentTypeCode, setPaymentTypeCode] = useState('');
  const [transDesc, setTransDesc] = useState('');
  const [notes, setNotes] = useState('');
  const [checkNumber, setCheckNumber] = useState('');
  const [checkBank, setCheckBank] = useState('');
  const [checkDate, setCheckDate] = useState('');

  const showCheckFields = methodCode === 'CHECK';
  const showCustomer = paymentKind === 'advance';
  const showOrder = paymentKind === 'deposit' || paymentKind === 'pos';
  const showInvoice = paymentKind === 'invoice';

  const kindTranslationKey: Record<string, string> = {
    invoice: 'kindInvoice',
    deposit: 'kindDeposit',
    advance: 'kindAdvance',
    pos: 'kindPos',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setFieldErrors({ amount: 'Amount must be greater than zero' });
      return;
    }

    const payload = {
      payment_kind: paymentKind as 'invoice' | 'deposit' | 'advance' | 'pos',
      payment_method_code: methodCode,
      amount: parsedAmount,
      customer_id: customerId || undefined,
      order_id: orderId || undefined,
      invoice_id: invoiceId || undefined,
      currency_code: currencyCode || undefined,
      payment_type_code: paymentTypeCode || undefined,
      trans_desc: transDesc.trim() || undefined,
      notes: notes || undefined,
      check_number: showCheckFields ? checkNumber : undefined,
      check_bank: showCheckFields ? checkBank : undefined,
      check_date: showCheckFields && checkDate ? checkDate : undefined,
    };

    const parsed = createStandalonePaymentSchema.safeParse(payload);
    if (!parsed.success) {
      const errors: Record<string, string> = {};
      for (const err of parsed.error.errors) {
        const field = err.path?.[0] as string | undefined;
        if (field) errors[field] = err.message ?? 'Invalid';
      }
      setFieldErrors(errors);
      setError(parsed.error.errors[0]?.message ?? 'Invalid input');
      return;
    }

    startSubmitting(async () => {
      const result = await createStandalonePaymentAction(parsed.data as Record<string, unknown>);

      if (result.success) {
        if (result.paymentId) {
          router.push(`/dashboard/billing/payments/${result.paymentId}`);
        } else {
          router.push('/dashboard/billing/payments');
        }
      } else {
        setError(result.error || t('error'));
      }
    });
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-2xl space-y-6">
      <div className="rounded-lg border border-gray-200 bg-white p-6">
        <div className="space-y-4">
          {/* Payment Kind */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('paymentKind')} <span className="text-red-500">*</span>
            </label>
            <select
              value={paymentKind}
              onChange={(e) => setPaymentKind(e.target.value)}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            >
              {PAYMENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {t(kindTranslationKey[k])}
                </option>
              ))}
            </select>
          </div>

          {/* Customer (shown for advance) */}
          {showCustomer && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('customer')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={customerId}
                onChange={(e) => {
                  setCustomerId(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, customer_id: undefined }));
                }}
                placeholder={t('customerPlaceholder')}
                required={paymentKind === 'advance'}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-invalid={!!fieldErrors.customer_id}
              />
              {fieldErrors.customer_id && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.customer_id}</p>
              )}
            </div>
          )}

          {/* Order (shown for deposit/pos) */}
          {showOrder && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('order')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={orderId}
                onChange={(e) => {
                  setOrderId(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, order_id: undefined }));
                }}
                placeholder={t('orderPlaceholder')}
                required={paymentKind === 'deposit' || paymentKind === 'pos'}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-invalid={!!fieldErrors.order_id}
              />
              {fieldErrors.order_id && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.order_id}</p>
              )}
            </div>
          )}

          {/* Invoice (shown for invoice kind) */}
          {showInvoice && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('invoice')} <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={invoiceId}
                onChange={(e) => {
                  setInvoiceId(e.target.value);
                  setFieldErrors((prev) => ({ ...prev, invoice_id: undefined }));
                }}
                placeholder={t('invoicePlaceholder')}
                required={paymentKind === 'invoice'}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                aria-invalid={!!fieldErrors.invoice_id}
              />
              {fieldErrors.invoice_id && (
                <p className="mt-1 text-sm text-red-600">{fieldErrors.invoice_id}</p>
              )}
            </div>
          )}

          {/* Amount */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('amount')} <span className="text-red-500">*</span>
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
              placeholder={t('amountPlaceholder')}
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
              {t('currency')}
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

          {/* Payment Method */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('method')} <span className="text-red-500">*</span>
            </label>
            <select
              value={methodCode}
              onChange={(e) => {
                setMethodCode(e.target.value);
                setFieldErrors((prev) => ({ ...prev, payment_method_code: undefined }));
              }}
              required
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              aria-invalid={!!fieldErrors.payment_method_code}
            >
              <option value="">-- {t('method')} --</option>
              {paymentMethods.map((m) => (
                <option key={m.code} value={m.code}>
                  {m.name}
                </option>
              ))}
            </select>
            {fieldErrors.payment_method_code && (
              <p className="mt-1 text-sm text-red-600">{fieldErrors.payment_method_code}</p>
            )}
          </div>

          {/* Payment Type (optional) */}
          {paymentTypes.length > 0 && (
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                {t('type')}
              </label>
              <select
                value={paymentTypeCode}
                onChange={(e) => setPaymentTypeCode(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                <option value="">-- {t('typePlaceholder')} --</option>
                {paymentTypes.map((pt) => (
                  <option key={pt.code} value={pt.code}>
                    {pt.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Check fields (conditional) */}
          {showCheckFields && (
            <div className="space-y-4 rounded-md border border-gray-200 bg-gray-50 p-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('checkNumber')}
                </label>
                <input
                  type="text"
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('checkBank')}
                </label>
                <input
                  type="text"
                  value={checkBank}
                  onChange={(e) => setCheckBank(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">
                  {t('checkDate')}
                </label>
                <input
                  type="date"
                  value={checkDate}
                  onChange={(e) => setCheckDate(e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          )}

          {/* Transaction description */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('transDesc')}
            </label>
            <input
              type="text"
              value={transDesc}
              onChange={(e) => setTransDesc(e.target.value)}
              placeholder={t('transDescPlaceholder')}
              maxLength={500}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="mb-1 block text-sm font-medium text-gray-700">
              {t('notes')}
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('notesPlaceholder')}
              rows={3}
              maxLength={1000}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={isSubmitting}
          className="rounded-md bg-blue-600 px-6 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {isSubmitting ? t('submitting') : t('submit')}
        </button>
        <button
          type="button"
          onClick={() => router.push('/dashboard/billing/payments')}
          className="rounded-md border border-gray-300 px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {tCommon('cancel')}
        </button>
      </div>
    </form>
  );
}
