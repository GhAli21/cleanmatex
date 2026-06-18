'use client';

import { useQuery } from '@tanstack/react-query';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Printer } from 'lucide-react';
import { CmxButton } from '@ui/primitives';
import { ArCustomerStatementPrintRprt } from '@features/ar/ui/ar-customer-statement-print-rprt';
import type { ArCustomerStatement } from '@/lib/types/ar-invoice';

/**
 *
 */
export default function ArStatementPrintPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const t = useTranslations('invoices.ar.statementPrint');
  const tCommon = useTranslations('common');
  const customerId = searchParams.get('customerId');
  const dateFrom = searchParams.get('date_from');
  const dateTo = searchParams.get('date_to');

  const queryString = new URLSearchParams();
  if (dateFrom) queryString.set('date_from', dateFrom);
  if (dateTo) queryString.set('date_to', dateTo);

  const { data, isLoading, error } = useQuery({
    queryKey: ['ar-statement-print', customerId, dateFrom, dateTo],
    queryFn: async () => {
      const response = await fetch(`/api/v1/ar/customers/${customerId}/statements/print?${queryString.toString()}`);
      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? t('errors.loadFailed'));
      }
      const payload = (await response.json()) as { data: ArCustomerStatement };
      return payload.data;
    },
    enabled: Boolean(customerId),
  });

  if (!customerId) {
    return null;
  }

  return (
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

      <div className="mx-auto max-w-6xl space-y-6 px-4">
        <div className="print-hidden flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 rtl:flex-row-reverse">
            <CmxButton variant="ghost" size="sm" onClick={() => router.push(`/dashboard/internal_fin/ar/statements?customerId=${customerId}`)}>
              <ArrowLeft className="h-4 w-4" />
              {tCommon('back')}
            </CmxButton>
            <h1 className="text-2xl font-semibold text-slate-950">{t('title')}</h1>
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
        {data ? <ArCustomerStatementPrintRprt statement={data} /> : null}
      </div>
    </div>
  );
}
