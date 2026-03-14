/**
 * B2B Statement Detail Page
 * View statement and print/PDF
 */

'use client';

import { useParams, useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { ArrowLeft, Printer } from 'lucide-react';
import { Button } from '@ui/primitives/button';
import { Card, CardContent, CardHeader, CardTitle } from '@ui/primitives/card';
import { B2BStatementsPrintRprt } from '@features/b2b/ui/b2b-statements-print-rprt';
import type { StatementForPrint } from '@/lib/services/b2b-statements.service';

export default function B2BStatementDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const t = useTranslations('b2b');
  const tCommon = useTranslations('common');
  const id = params?.id;

  const { data, isLoading, error } = useQuery({
    queryKey: ['b2b-statement-print', id],
    queryFn: async () => {
      const res = await fetch(`/api/v1/b2b-statements/${id}/print`);
      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error ?? 'Failed to load statement');
      }
      const json = await res.json();
      return json.data as StatementForPrint;
    },
    enabled: !!id,
  });

  const handlePrint = () => {
    window.print();
  };

  if (!id) {
    return (
      <div className="space-y-6">
        <p className="text-gray-500">{tCommon('notFound') ?? 'Not found'}</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/b2b/statements')}>
          {t('statements') ?? 'Back to Statements'}
        </Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-8 bg-gray-200 rounded w-1/4 animate-pulse" />
        <div className="h-64 bg-gray-200 rounded animate-pulse" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <p className="text-red-600">{error instanceof Error ? error.message : 'Failed to load statement'}</p>
        <Button variant="outline" onClick={() => router.push('/dashboard/b2b/statements')}>
          {t('statements') ?? 'Back to Statements'}
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @page { size: A4; margin: 10mm; }
            @media print {
              html, body { margin: 0; padding: 0; height: auto; background: white; }
              .min-h-screen { min-height: auto !important; }
              .print-hidden { display: none !important; }
            }
            .print-header { padding-bottom: 0.75rem; margin-bottom: 0.75rem; border-bottom: 1px solid #d1d5db; }
            .print-title { font-size: 16px; font-weight: 700; margin: 0; }
            .print-subtitle { font-size: 11px; color: #4b5563; margin-top: 0.125rem; }
            .print-section { margin-bottom: 0.75rem; }
            .print-section h2 { font-size: 12px; font-weight: 600; margin: 0 0 0.375rem 0; }
            .print-row { display: flex; justify-content: space-between; margin-bottom: 0.375rem; }
            .print-footer { margin-top: 1rem; padding-top: 0.75rem; border-top: 1px dashed #d1d5db; font-size: 11px; color: #6b7280; text-align: center; }
            .max-w-a4 { max-width: 210mm; }
          `,
        }}
      />
      <div className="space-y-6 px-4">
      <div className="print-hidden flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.push('/dashboard/b2b/statements')}
            aria-label={tCommon('back') ?? 'Back'}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold">
            {t('statementTitle') ?? 'Statement'}: {data.statement.statementNo}
          </h1>
        </div>
        <Button onClick={handlePrint} className="flex items-center gap-2">
          <Printer className="h-4 w-4" />
          {tCommon('print') ?? 'Print'}
        </Button>
      </div>

      <div className="print-hidden">
        <Card>
          <CardHeader>
            <CardTitle>{t('statementDetails') ?? 'Statement Details'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-2 text-sm">
              <span className="text-gray-500">{t('statementNo') ?? 'Statement No'}</span>
              <span>{data.statement.statementNo}</span>
              <span className="text-gray-500">{t('periodFrom') ?? 'Period From'}</span>
              <span>{data.statement.periodFrom ? new Date(data.statement.periodFrom).toLocaleDateString() : '—'}</span>
              <span className="text-gray-500">{t('periodTo') ?? 'Period To'}</span>
              <span>{data.statement.periodTo ? new Date(data.statement.periodTo).toLocaleDateString() : '—'}</span>
              <span className="text-gray-500">{t('dueDate') ?? 'Due Date'}</span>
              <span>{data.statement.dueDate ? new Date(data.statement.dueDate).toLocaleDateString() : '—'}</span>
              <span className="text-gray-500">{t('totalAmount') ?? 'Total'}</span>
              <span>{Number(data.statement.totalAmount).toLocaleString()}</span>
              <span className="text-gray-500">{t('balanceAmount') ?? 'Balance'}</span>
              <span className="font-medium">{Number(data.statement.balanceAmount).toLocaleString()}</span>
            </div>
            <div className="pt-4">
              <Button onClick={handlePrint} variant="outline">
                <Printer className="h-4 w-4 mr-2" />
                {tCommon('print') ?? 'Print'}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 mx-auto max-w-a4">
        <B2BStatementsPrintRprt data={data} />
      </div>
      </div>
    </div>
  );
}
