/**
 * Payment Detail Page — Server Component
 *
 * Fetches a single payment and passes it to the client component.
 * Route: /dashboard/billing/payments/[id]
 */

import { notFound } from 'next/navigation';
import { getAuthContext } from '@/lib/auth/server-auth';
import { getPaymentAction } from '@/app/actions/payments/payment-crud-actions';
import { getPaymentAuditLog } from '@/lib/services/payment-audit.service';
import PaymentDetailClient from './payment-detail-client';

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; invoiceId?: string }>;
}

export default async function PaymentDetailPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { from, invoiceId } = await searchParams;

  await getAuthContext();

  const [result, auditEntries] = await Promise.all([
    getPaymentAction(id),
    getPaymentAuditLog(id),
  ]);

  if (!result.success || !result.data) {
    notFound();
  }

  const returnToInvoiceId = from === 'invoice' && invoiceId ? invoiceId : undefined;

  return (
    <PaymentDetailClient
      payment={result.data}
      auditEntries={auditEntries}
      returnToInvoiceId={returnToInvoiceId}
    />
  );
}
