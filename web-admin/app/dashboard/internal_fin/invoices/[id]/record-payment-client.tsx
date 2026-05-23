'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Banknote } from 'lucide-react';
import type { PaymentKind, PaymentMethodCode } from '@/lib/types/payment';
import { useTenantCurrency } from '@/lib/context/tenant-currency-context';
import {
  Alert,
  AlertDescription,
  CmxButton,
  CmxInput,
  CmxTextarea,
  Label,
} from '@ui/primitives';
import {
  CmxCard,
  CmxCardContent,
  CmxCardHeader,
  CmxCardTitle,
} from '@ui/primitives/cmx-card';

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
    notes: string;
    remaining: string;
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
  const { decimalPlaces, formatMoneyWithCode } = useTenantCurrency();
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

  const handleSubmit = () => {
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
    <CmxCard className="overflow-hidden border-emerald-100 shadow-sm ring-1 ring-emerald-50">
      <CmxCardHeader className="border-b border-emerald-100 bg-gradient-to-r from-emerald-50 to-teal-50/50 px-4 py-3">
        <CmxCardTitle className="flex items-center gap-2 text-base font-semibold text-slate-800">
          <Banknote className="h-5 w-5 text-emerald-600" />
          {t.recordPayment}
        </CmxCardTitle>
      </CmxCardHeader>
      <CmxCardContent className="space-y-4 p-4">
        <div>
          <CmxInput
            type="number"
            label={t.amount}
            step={10 ** -decimalPlaces}
            min={0}
            max={remainingBalance}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value) || 0)}
            className="border-emerald-200 text-right font-medium text-slate-900"
            helpText={`${formatMoneyWithCode(remainingBalance)} ${t.remaining}`}
          />
        </div>

        <div>
          <Label className="block text-sm font-medium text-slate-700">
            {t.paymentMethod}
          </Label>
          <div className="mt-2 flex gap-2">
            <CmxButton
              type="button"
              onClick={() => setMethod('CASH')}
              variant={method === 'CASH' ? 'primary' : 'outline'}
              className="flex-1"
            >
              {t.cash}
            </CmxButton>
            <CmxButton
              type="button"
              onClick={() => setMethod('CARD')}
              variant={method === 'CARD' ? 'primary' : 'outline'}
              className="flex-1"
            >
              {t.card}
            </CmxButton>
          </div>
        </div>

        <div>
          <Label className="mb-1 block text-sm font-medium text-slate-700">
            {t.notes}
          </Label>
          <CmxTextarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            className="border-slate-200"
          />
        </div>

        {error && (
          <Alert variant="error">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert variant="success">
            <AlertDescription>{success}</AlertDescription>
          </Alert>
        )}

        <div className="flex items-center justify-end gap-2 pt-2">
          <CmxButton
            type="button"
            onClick={() => {
              setAmount(remainingBalance);
              setNotes('');
              setError(null);
              setSuccess(null);
            }}
            variant="outline"
          >
            {t.cancel}
          </CmxButton>
          <CmxButton
            type="button"
            onClick={handleSubmit}
            loading={isPending}
          >
            {isPending ? t.cancelling : t.submit}
          </CmxButton>
        </div>
      </CmxCardContent>
    </CmxCard>
  );
}
