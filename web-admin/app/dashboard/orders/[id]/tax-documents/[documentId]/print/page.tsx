'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Printer } from 'lucide-react';
import { CmxButton } from '@ui/primitives/cmx-button';
import { TaxDocumentPrintRprt } from '@features/orders/ui/order-financial/tax-document-print-rprt';
import { RequirePermission } from '@features/auth/ui/RequirePermission';
import type { TaxDocumentPrintDetail } from '@/lib/services/tax-document-read.service';

/**
 *
 */
export default function TaxDocumentPrintPage() {
  const params = useParams<{ id: string; documentId: string }>();
  const router = useRouter();
  const t = useTranslations('taxDocuments.print');
  const tCommon = useTranslations('common');
  const orderId = params?.id;
  const documentId = params?.documentId;

  const { data, isLoading, error } = useQuery({
    queryKey: ['tax-document-print', orderId, documentId],
    queryFn: async () => {
      const response = await fetch(`/api/v1/orders/${orderId}/tax-documents/${documentId}/print`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? t('errors.loadFailed'));
      }
      const payload = (await response.json()) as { data: TaxDocumentPrintDetail };
      return payload.data;
    },
    enabled: Boolean(orderId && documentId),
  });

  if (!orderId || !documentId) {
    return null;
  }

  return (
    <RequirePermission resource="orders" action="view_financial_breakdown">
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page { size: A4; margin: 12mm; }
            @media print {
              html, body { margin: 0; padding: 0; background: white; }
              .print-hidden { display: none !important; }
            }
          `,
        }}
      />

      <div className="mx-auto max-w-5xl space-y-6 px-4">
        <div className="print-hidden flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 rtl:flex-row-reverse">
            <CmxButton variant="ghost" size="sm" onClick={() => router.push(`/dashboard/orders/${orderId}`)}>
              <ArrowLeft className="h-4 w-4" />
              {tCommon('back')}
            </CmxButton>
            <h1 className="text-2xl font-semibold text-slate-950">{t('documentLabel')}</h1>
          </div>
          <CmxButton onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
            {tCommon('print')}
          </CmxButton>
        </div>

        {isLoading ? <div className="h-72 animate-pulse rounded-2xl bg-slate-200" /> : null}
        {error instanceof Error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
            {error.message}
          </div>
        ) : null}
        {data ? <TaxDocumentPrintRprt detail={data} /> : null}
      </div>
    </div>
    </RequirePermission>
  );
}
