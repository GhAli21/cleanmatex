'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { refundPaymentAction } from '@/app/actions/payments/payment-crud-actions';

interface RefundPaymentDialogProps {
  paymentId: string;
  maxAmount: number;
  currencyCode: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function RefundPaymentDialog({
  paymentId,
  maxAmount,
  currencyCode,
  onClose,
  onSuccess,
}: RefundPaymentDialogProps) {
  const t = useTranslations('payments.refund');
  const tCommon = useTranslations('common');
  const [reason, setReason] = useState('');
  const [isSubmitting, startSubmitting] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const canSubmit = maxAmount > 0 && reason.trim().length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setError(null);

    startSubmitting(async () => {
      const result = await refundPaymentAction(
        paymentId,
        maxAmount,
        reason.trim()
      );
      if (result.success) {
        onSuccess();
      } else {
        setError(result.error || t('error'));
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="mx-4 w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
        <h3 className="mb-2 text-lg font-semibold text-gray-900">{t('title')}</h3>
        <p className="mb-4 text-sm text-gray-600">{t('confirm')}</p>

        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t('amountLabel')} <span className="text-red-500">*</span>
        </label>
        <div
          className="mb-4 w-full rounded-md border border-gray-200 bg-gray-50 p-3 text-sm font-medium text-gray-900"
          aria-readonly
        >
          {maxAmount.toFixed(3)} {currencyCode}
        </div>

        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t('reasonLabel')} <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('reasonPlaceholder')}
          rows={3}
          maxLength={500}
          className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isSubmitting}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {tCommon('cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isSubmitting || !canSubmit}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {isSubmitting ? t('submitting') : t('submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
