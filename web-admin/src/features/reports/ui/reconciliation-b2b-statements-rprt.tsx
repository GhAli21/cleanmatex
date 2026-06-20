'use client';

import { useTranslations } from 'next-intl';
import { CmxDataTable } from '@ui/data-display';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import type { B2bStatementReconReport, B2bStatementReconRow } from '@/lib/types/reconciliation-report';
import { fmtAmount } from './reconciliation-format';

interface Props {
  data: B2bStatementReconReport | null;
  loading: boolean;
  csvHref: string;
}

/**
 * D-09 report 2 — B2B statement payment reconciliation (header paid vs detail sum).
 *
 * @param props report data, loading flag, CSV export href.
 */
export function ReconciliationB2bStatementsRprt({ data, loading, csvHref }: Props) {
  const t = useTranslations('reports.reconciliation');

  const columns = [
    {
      key: 'statement',
      header: t('statementNo'),
      render: (r: B2bStatementReconRow) => <span className="font-mono font-medium">{r.statementNo}</span>,
    },
    {
      key: 'status',
      header: t('status'),
      render: (r: B2bStatementReconRow) =>
        r.statusCode ? <Badge variant="outline" className="text-xs">{r.statusCode}</Badge> : <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'headerPaid',
      header: t('headerPaid'),
      render: (r: B2bStatementReconRow) => <span className="font-mono">{fmtAmount(r.headerPaidAmount, r.currencyCode)}</span>,
    },
    {
      key: 'detailPaid',
      header: t('detailPaid'),
      render: (r: B2bStatementReconRow) => <span className="font-mono">{fmtAmount(r.detailPaidAmount, r.currencyCode)}</span>,
    },
    {
      key: 'delta',
      header: t('delta'),
      render: (r: B2bStatementReconRow) => (
        <span className={`font-mono font-medium ${r.isReconciled ? '' : 'text-destructive'}`}>{r.delta.toFixed(3)}</span>
      ),
    },
    {
      key: 'reconciled',
      header: t('reconciled'),
      render: (r: B2bStatementReconRow) =>
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
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('statementCount')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className="text-2xl font-bold">{s.statementCount}</span></CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('exceptions')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className={`text-2xl font-bold ${s.exceptionCount > 0 ? 'text-destructive' : ''}`}>{s.exceptionCount}</span></CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('totalDetailPaid')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className="text-2xl font-bold">{s.totalDetailPaid.toFixed(3)}</span></CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('totalDelta')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className={`text-2xl font-bold ${Math.abs(s.totalDelta) >= 0.01 ? 'text-destructive' : ''}`}>{s.totalDelta.toFixed(3)}</span></CmxCardContent>
        </CmxCard>
      </div>

      <CmxDataTable columns={columns} data={data.rows} />

      <div className="flex justify-end">
        <a href={csvHref} className="text-sm text-primary underline">{t('exportCSV')}</a>
      </div>
    </div>
  );
}
