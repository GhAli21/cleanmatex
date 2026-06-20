'use client';

import { useTranslations } from 'next-intl';
import { CmxDataTable } from '@ui/data-display';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import type { CashDrawerReconReport, CashDrawerReconRow } from '@/lib/types/reconciliation-report';
import { fmtAmount } from './reconciliation-format';

interface Props {
  data: CashDrawerReconReport | null;
  loading: boolean;
  csvHref: string;
}

/**
 * D-09 report 4 — cash drawer movement reconciliation (recomputed expected vs
 * header, close difference, unlinked-movement count).
 *
 * @param props report data, loading flag, CSV export href.
 */
export function ReconciliationCashDrawerRprt({ data, loading, csvHref }: Props) {
  const t = useTranslations('reports.reconciliation');

  const columns = [
    {
      key: 'session',
      header: t('sessionNo'),
      render: (r: CashDrawerReconRow) => <span className="font-mono font-medium">{r.sessionNo}</span>,
    },
    {
      key: 'status',
      header: t('status'),
      render: (r: CashDrawerReconRow) => <Badge variant="outline" className="text-xs">{r.status}</Badge>,
    },
    {
      key: 'opening',
      header: t('openingFloat'),
      render: (r: CashDrawerReconRow) => <span className="font-mono text-sm">{fmtAmount(r.openingFloatAmount, r.currencyCode)}</span>,
    },
    {
      key: 'expected',
      header: t('computedExpected'),
      render: (r: CashDrawerReconRow) => (
        <span className={`font-mono text-sm ${Math.abs(r.expectedDelta) >= 0.01 ? 'text-destructive font-medium' : ''}`}>
          {fmtAmount(r.computedExpectedAmount, r.currencyCode)}
        </span>
      ),
    },
    {
      key: 'counted',
      header: t('counted'),
      render: (r: CashDrawerReconRow) => <span className="font-mono text-sm">{fmtAmount(r.countedCashAmount, r.currencyCode)}</span>,
    },
    {
      key: 'difference',
      header: t('difference'),
      render: (r: CashDrawerReconRow) => (
        <span className={`font-mono text-sm ${r.differenceAmount != null && Math.abs(r.differenceAmount) >= 0.01 ? 'text-destructive font-medium' : ''}`}>
          {r.differenceAmount == null ? '—' : r.differenceAmount.toFixed(3)}
        </span>
      ),
    },
    {
      key: 'unlinked',
      header: t('unlinked'),
      render: (r: CashDrawerReconRow) =>
        r.unlinkedMovementCount > 0
          ? <Badge variant="destructive" className="text-xs">{r.unlinkedMovementCount}</Badge>
          : <span className="tabular-nums text-muted-foreground">0</span>,
    },
    {
      key: 'reconciled',
      header: t('reconciled'),
      render: (r: CashDrawerReconRow) =>
        r.isReconciled
          ? <Badge variant="success" className="text-xs">{t('reconciledYes')}</Badge>
          : <Badge variant="destructive" className="text-xs">{t('reconciledNo')}</Badge>,
    },
  ];

  if (loading) return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  if (!data) return <p className="text-sm text-muted-foreground">{t('notLoaded')}</p>;
  if (data.rows.length === 0) return <p className="text-sm text-muted-foreground">{t('empty')}</p>;

  const s = data.summary;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <CmxCard>
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('sessionCount')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className="text-2xl font-bold">{s.sessionCount}</span></CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('exceptions')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className={`text-2xl font-bold ${s.exceptionCount > 0 ? 'text-destructive' : ''}`}>{s.exceptionCount}</span></CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('totalDifference')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className={`text-2xl font-bold ${Math.abs(s.totalDifference) >= 0.01 ? 'text-destructive' : ''}`}>{s.totalDifference.toFixed(3)}</span></CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('unlinkedTotal')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className={`text-2xl font-bold ${s.totalUnlinkedMovements > 0 ? 'text-destructive' : ''}`}>{s.totalUnlinkedMovements}</span></CmxCardContent>
        </CmxCard>
      </div>

      <CmxDataTable columns={columns} data={data.rows} />

      <div className="flex justify-end">
        <a href={csvHref} className="text-sm text-primary underline">{t('exportCSV')}</a>
      </div>
    </div>
  );
}
