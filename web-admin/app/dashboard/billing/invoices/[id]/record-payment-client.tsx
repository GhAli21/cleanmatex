'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PaymentMethodCode } from '@/lib/types/payment';

interface RecordPaymentClientProps {
  tenantOrgId: string;
  userId: string;
  invoiceId: string;
  orderId: string;
  remainingBalance: number;
  processPaymentAction: (
    tenantOrgId: string,
    userId: string,
    input: {
      orderId: string;
      invoiceId?: string;
      paymentMethod: PaymentMethodCode;
      amount: number;
      notes?: string;
    }
  ) => Promise<{
    success: boolean;
    error?: string;
  }>;
  t: {
    recordPayment: string;
    amount: string;
    paymentMethod: string;
    cash: string;
    card: string;
    submit: string;
    cancelling: string;
    cancel: string;
    success: string;
    error: string;
  };
}

export function RecordPaymentClient({
  tenantOrgId,
  userId,
  invoiceId,
  orderId,
  remainingBalance,
  processPaymentAction,
  t,
}: RecordPaymentClientProps) {
  const router = useRouter();
  const [amount, setAmount] = useState<number>(remainingBalance);
  const [method, setMethod] = useState<PaymentMethodCode>('CASH');
  const [notes, setNotes] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (amount <= 0) {
      setError(t.error);
      return;
    }

    if (amount > remainingBalance) {
      setError(t.error);
      return;
    }

    startTransition(async () => {
      const result = await processPaymentAction(tenantOrgId, userId, {
        orderId,
        invoiceId,
        paymentMethod: method,
        amount,
        notes,
      });

      if (!result.success) {
        setError(result.error || t.error);
        return;
      }

      setSuccess(t.success);
      router.refresh();
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 rounded-lg border border-gray-200 bg-white p-4">
      <h3 className="text-base font-semibold text-gray-900">
        {t.recordPayment}
      </h3>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t.amount}
        </label>
        <input
          type="number"
          step="0.001"
          min={0}
          max={remainingBalance}
          value={amount}
          onChange={(e) => setAmount(Number(e.target.value) || 0)}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-right"
        />
        <p className="mt-1 text-xs text-gray-500">
          {remainingBalance.toFixed(3)} OMR remaining
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          {t.paymentMethod}
        </label>
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => setMethod('CASH')}
            className={`flex-1 rounded-md border px-3 py-2 text-sm ${
              method === 'CASH'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            {t.cash}
          </button>
          <button
            type="button"
            onClick={() => setMethod('CARD')}
            className={`flex-1 rounded-md border px-3 py-2 text-sm ${
              method === 'CARD'
                ? 'border-blue-600 bg-blue-50 text-blue-700'
                : 'border-gray-300 bg-white text-gray-700'
            }`}
          >
            {t.card}
          </button>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={3}
          className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      {success && (
        <div className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700">
          {success}
        </div>
      )}

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => {
            setAmount(remainingBalance);
            setNotes('');
            setError(null);
            setSuccess(null);
          }}
          className="rounded-md border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          {t.cancel}
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? t.cancelling : t.submit}
        </button>
      </div>
    </form>
  );
}
