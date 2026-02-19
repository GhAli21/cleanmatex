'use client';

import { useState, useTransition } from 'react';
import { useTranslations } from 'next-intl';
import { cancelPaymentAction } from '@/app/actions/payments/payment-crud-actions';

interface CancelPaymentDialogProps {
  paymentId: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CancelPaymentDialog({
  paymentId,
  onClose,
  onSuccess,
}: CancelPaymentDialogProps) {
  const t = useTranslations('payments.cancel');
  const [reason, setReason] = useState('');
  const [isCancelling, startCancelling] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = () => {
    if (!reason.trim()) return;
    setError(null);

    startCancelling(async () => {
      const result = await cancelPaymentAction(paymentId, reason.trim());
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
        <p className="mb-2 text-sm text-gray-600">{t('confirm')}</p>
        <p className="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700">{t('warning')}</p>

        <label className="mb-1 block text-sm font-medium text-gray-700">
          {t('reasonLabel')} <span className="text-red-500">*</span>
        </label>
        <textarea
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder={t('reasonPlaceholder')}
          rows={3}
          maxLength={500}
          className="w-full rounded-md border border-gray-300 p-3 text-sm focus:border-red-500 focus:outline-none focus:ring-1 focus:ring-red-500"
        />

        {error && <p className="mt-2 text-sm text-red-600">{error}</p>}

        <div className="mt-4 flex justify-end gap-3">
          <button
            onClick={onClose}
            disabled={isCancelling}
            className="rounded-md border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            {t('cancelDialog')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={isCancelling || !reason.trim()}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isCancelling ? t('cancelling') : t('submit')}
          </button>
        </div>
      </div>
    </div>
  );
}
