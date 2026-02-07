/**
 * Receipt Voucher Print Page
 * Route: /dashboard/billing/payments/[id]/print/receipt-voucher
 */

'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { getReceiptVoucherDataByPaymentIdAction } from '@/app/actions/payments/voucher-actions';
import { getPaymentById as getPaymentByIdService } from '@/lib/services/payment-service';
import { BillingReceiptVoucherPrintRprt } from '../../components/billing-receipt-voucher-print-rprt';
import type { BillingReceiptVoucherPrintRprtData } from '../../components/billing-receipt-voucher-print-rprt';

export default function ReceiptVoucherPrintPage() {
  const params = useParams<{ id: string }>();
  const tCommon = useTranslations('common');
  const tBilling = useTranslations('billing');
  const paymentId = params?.id;

  const [printData, setPrintData] = useState<BillingReceiptVoucherPrintRprtData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!paymentId) return;
      setLoading(true);
      setError(null);
      try {
        const voucherResult = await getReceiptVoucherDataByPaymentIdAction(paymentId);
        if (!voucherResult.success || !voucherResult.data) {
          setError('Voucher not found');
          return;
        }
        const voucher = voucherResult.data;
        const paymentResult = await getPaymentByIdService(paymentId);
        if (!paymentResult) {
          setError('Payment not found');
          return;
        }
        // Tenant info - simplified for now (can be enhanced later)
        const tenant = { name: 'CleanMateX', phone: null, address: null };

        const data: BillingReceiptVoucherPrintRprtData = {
          voucher,
          payment: {
            id: paymentResult.id,
            payment_method_code: paymentResult.payment_method_code,
            paid_at: paymentResult.paid_at,
            transaction_id: paymentResult.transaction_id,
          },
          invoice: voucher.invoice_id && paymentResult.invoiceNumber
            ? {
                invoice_no: paymentResult.invoiceNumber,
                invoice_date: null, // Can be fetched separately if needed
              }
            : undefined,
          order: voucher.order_id && paymentResult.orderReference
            ? {
                order_no: paymentResult.orderReference,
              }
            : undefined,
          customer: voucher.customer_id && paymentResult.customerName
            ? {
                name: paymentResult.customerName,
                phone: null, // Can be fetched separately if needed
                email: null, // Can be fetched separately if needed
              }
            : undefined,
          tenant,
        };
        setPrintData(data);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load voucher');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [paymentId]);

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page {
              size: A4;
              margin: 10mm;
            }
            @media print {
              html, body {
                margin: 0;
                padding: 0;
                height: auto;
                background: white;
              }
              .min-h-screen {
                min-height: auto !important;
              }
              .print-hidden {
                display: none !important;
              }
            }
            .print-header {
              padding-bottom: 0.75rem;
              margin-bottom: 0.75rem;
              border-bottom: 1px solid #d1d5db;
            }
            .print-title {
              font-size: 16px;
              font-weight: 700;
              margin: 0;
            }
            .print-subtitle {
              font-size: 11px;
              color: #4b5563;
              margin-top: 0.125rem;
            }
            .print-section {
              margin-bottom: 0.75rem;
            }
            .print-section h2 {
              font-size: 12px;
              font-weight: 600;
              margin: 0 0 0.375rem 0;
            }
            .print-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 0.375rem;
            }
            .print-footer {
              margin-top: 1rem;
              padding-top: 0.75rem;
              border-top: 1px dashed #d1d5db;
              font-size: 11px;
              color: #6b7280;
              text-align: center;
            }
            .max-w-a4 {
              max-width: 210mm;
            }
          `,
        }}
      />

      <div className="print-hidden mb-4 flex items-center justify-between px-4">
        <div>
          <h1 className="text-lg font-semibold">{tBilling('receiptVoucher.title') ?? 'Receipt Voucher'}</h1>
          <p className="text-sm text-gray-500">A4 layout • {tCommon('print')}</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            {tCommon('print')}
          </button>
        </div>
      </div>

      {loading && (
        <div className="flex h-40 items-center justify-center text-gray-500">
          {tCommon('loading')}
        </div>
      )}

      {error && (
        <div className="mx-auto max-w-lg rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {!loading && !error && printData && (
        <div className="mx-auto w-full max-w-a4 px-4">
          <BillingReceiptVoucherPrintRprt data={printData} />
        </div>
      )}
    </div>
  );
}
