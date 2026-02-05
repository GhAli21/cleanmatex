'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote } from 'lucide-react';
import type { PaymentKind, PaymentMethodCode } from '@/lib/types/payment';

interface RecordPaymentClientProps {
  tenantOrgId: string;
  userId: string;
  invoiceId: string;
  orderId?: string;
  customerId?: string;
  paymentKind?: PaymentKind;// 'invoice' | 'deposit' | 'advance' | 'pos';
  paymentTypeCode?: string;
  currencyCode?: string;
  currencyExRate?: number;
  branchId?: string;
  subtotal?: number;
  discountAmount?: number;
  vatRate?: number;
  vatAmount?: number;
  taxAmount?: number;
  finalTotal?: number;
  remainingBalance: number;
  /** When true, apply payment across all order invoices with balance (FIFO) instead of a single invoice */
  distributeAcrossInvoices?: boolean;
  processPaymentAction: (
    tenantOrgId: string,
    userId: string,
    input: {
      orderId: string;
      invoiceId?: string;
      paymentMethod: PaymentMethodCode;
      amount: number;
      notes?: string;
      distributeAcrossInvoices?: boolean;
    } & Record<string, unknown>
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
  customerId,
  paymentKind = 'invoice',
  paymentTypeCode,
  currencyCode,
  currencyExRate,
  branchId,
  subtotal,
  discountAmount,
  vatRate,
  vatAmount,
  taxAmount,
  finalTotal,
  remainingBalance,
  distributeAcrossInvoices,
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

  // Sync amount when remainingBalance changes (e.g. after page refresh post-payment)
  useEffect(() => {
    setAmount(remainingBalance);
  }, [remainingBalance]);

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
        invoiceId: distributeAcrossInvoices ? undefined : invoiceId,
        customerId,
        paymentKind,
        paymentMethod: method,
        amount,
        notes,
        distributeAcrossInvoices,
        paymentTypeCode,
        currencyCode,
        currencyExRate,
        branchId,
        subtotal,
        discountAmount,
        vatRate,
        vatAmount,
        taxAmount,
        finalTotal,
      });

      if (!result.success) {
        setError(result.error || t.error);
        return;
      }

      setSuccess(t.success);
      setNotes('');
      setMethod('CASH');
      router.refresh();
    });
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-xl border border-emerald-100 bg-white shadow-sm ring-1 ring-emerald-50"
    >
      <div className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50/50 px-4 py-3">
        <h3 className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <Banknote className="h-5 w-5 text-emerald-600" />
          {t.recordPayment}
        </h3>
      </div>
      <div className="space-y-4 p-4">
        <div>
          <label className="block text-sm font-medium text-slate-700">
            {t.amount}
          </label>
          <input
            type="number"
            step="0.001"
            min={0}
            max={remainingBalance}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className="mt-1 w-full rounded-lg border border-emerald-200 bg-white px-3 py-2.5 text-right font-medium text-slate-900 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
          <p className="mt-1.5 text-xs font-medium text-emerald-700">
            {remainingBalance.toFixed(3)} OMR remaining
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            {t.paymentMethod}
          </label>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => setMethod('CASH')}
              className={`flex-1 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                method === 'CASH'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/50'
              }`}
            >
              {t.cash}
            </button>
            <button
              type="button"
              onClick={() => setMethod('CARD')}
              className={`flex-1 rounded-lg border-2 px-3 py-2.5 text-sm font-medium transition-colors ${
                method === 'CARD'
                  ? 'border-emerald-500 bg-emerald-50 text-emerald-800'
                  : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-200 hover:bg-emerald-50/50'
              }`}
            >
              {t.card}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        {error && (
          <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-800">
            {error}
          </div>
        )}

        {success && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-800">
            {success}
          </div>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={() => {
              setAmount(remainingBalance);
              setNotes('');
              setError(null);
              setSuccess(null);
            }}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            {t.cancel}
          </button>
          <button
            type="submit"
            disabled={isPending}
            className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-50"
          >
            {isPending ? t.cancelling : t.submit}
          </button>
        </div>
      </div>
    </form>
  );
}
