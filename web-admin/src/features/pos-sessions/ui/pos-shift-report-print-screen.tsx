/**
 * POS shift report print preview body (80mm thermal or A4).
 * Rendered by /dashboard/internal_fin/pos-sessions/[sessionId]/report/print?kind=x|z&layout=thermal|a4,
 * whose server page performs the permission gate.
 */

'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  fetchPosShiftXReport,
  fetchPosShiftZReport,
  posShiftXReportKey,
  posShiftZReportKey,
} from '@features/pos-sessions/api/pos-shift-report-api';
import { PosShiftReportRprt, type PosShiftReportLayout } from '@features/pos-sessions/ui/pos-shift-report-rprt';

export function PosShiftReportPrintScreen() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const searchParams = useSearchParams();
  const t = useTranslations('posShiftReport');
  const tCommon = useTranslations('common');

  const wantsZ = searchParams.get('kind') === 'z';
  const layout: PosShiftReportLayout = searchParams.get('layout') === 'thermal' ? 'thermal' : 'a4';

  const zQuery = useQuery({
    queryKey: posShiftZReportKey(sessionId),
    queryFn: () => fetchPosShiftZReport(sessionId),
    enabled: wantsZ,
  });
  const xQuery = useQuery({
    queryKey: posShiftXReportKey(sessionId),
    queryFn: () => fetchPosShiftXReport(sessionId),
    // The live report is the fallback only when no stored Z-report is wanted or exists.
    enabled: !wantsZ || (zQuery.isSuccess && zQuery.data === null),
  });

  const loading = zQuery.isLoading || xQuery.isLoading;
  const error = (zQuery.error ?? xQuery.error) as Error | null;
  const zReport = wantsZ ? (zQuery.data ?? null) : null;
  const snapshot = zReport ? zReport.snapshot : xQuery.data;

  return (
    <div className="min-h-screen bg-gray-100 py-6 print:bg-white print:py-0">
      <div className="mx-auto mb-4 flex max-w-3xl items-center justify-between px-4 print:hidden">
        <div>
          <h1 className="text-lg font-semibold">{zReport ? t('zTitle') : t('xTitle')}</h1>
          <p className="text-sm text-gray-500">
            {layout === 'thermal' ? t('layoutThermal') : t('layoutA4')} • {tCommon('print')}
          </p>
        </div>
        <button
          type="button"
          onClick={() => window.print()}
          disabled={!snapshot}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {tCommon('print')}
        </button>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center text-gray-500">{tCommon('loading')}</div>
      ) : null}

      {!loading && error ? (
        <div className="mx-auto max-w-lg rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error.message}
        </div>
      ) : null}

      {!loading && !error && snapshot ? (
        <div className="print-document px-4">
          <PosShiftReportRprt snapshot={snapshot} zReport={zReport} layout={layout} />
        </div>
      ) : null}
    </div>
  );
}
