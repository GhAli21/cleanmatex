'use client';

import { useTranslations } from 'next-intl';
import { CmxDataTable } from '@ui/data-display';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import type {
  OverpaymentDispositionReconReport,
  OverpaymentDispositionReconRow,
} from '@/lib/types/reconciliation-report';
import { fmtAmount } from './reconciliation-format';

interface Props {
  data: OverpaymentDispositionReconReport | null;
  loading: boolean;
  csvHref: string;
}

/**
 * D-09 report 3 — overpayment disposition reconciliation grouped by resolution
 * code, posted vs orphan (no voucher line).
 *
 * @param props report data, loading flag, CSV export href.
 */
export function ReconciliationOverpaymentDispositionRprt({ data, loading, csvHref }: Props) {
  const t = useTranslations('reports.reconciliation');

  const columns = [
    {
      key: 'resolution',
      header: t('resolutionCode'),
      render: (r: OverpaymentDispositionReconRow) => <Badge variant="outline" className="text-xs">{r.resolutionCode}</Badge>,
    },
    {
      key: 'count',
      header: t('count'),
      render: (r: OverpaymentDispositionReconRow) => <span className="tabular-nums">{r.count}</span>,
    },
    {
      key: 'total',
      header: t('totalAmount'),
      render: (r: OverpaymentDispositionReconRow) => <span className="font-mono font-medium">{fmtAmount(r.totalAmount, r.currencyCode)}</span>,
    },
    {
      key: 'posted',
      header: t('posted'),
      render: (r: OverpaymentDispositionReconRow) => (
        <span className="font-mono text-sm">{r.postedCount} · {fmtAmount(r.postedAmount, r.currencyCode)}</span>
      ),
    },
    {
      key: 'orphan',
      header: t('orphan'),
      render: (r: OverpaymentDispositionReconRow) => (
        <span className={`font-mono text-sm ${r.orphanCount > 0 ? 'text-destructive font-medium' : ''}`}>
          {r.orphanCount} · {fmtAmount(r.orphanAmount, r.currencyCode)}
        </span>
      ),
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
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('dispositionCount')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className="text-2xl font-bold">{s.totalCount}</span></CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('totalAmount')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className="text-2xl font-bold">{s.totalAmount.toFixed(3)}</span></CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('orphanCount')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className={`text-2xl font-bold ${s.orphanCount > 0 ? 'text-destructive' : ''}`}>{s.orphanCount}</span></CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('orphanAmount')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className={`text-2xl font-bold ${s.orphanAmount >= 0.01 ? 'text-destructive' : ''}`}>{s.orphanAmount.toFixed(3)}</span></CmxCardContent>
        </CmxCard>
      </div>

      <CmxDataTable columns={columns} data={data.rows} />

      <div className="flex justify-end">
        <a href={csvHref} className="text-sm text-primary underline">{t('exportCSV')}</a>
      </div>
    </div>
  );
}
