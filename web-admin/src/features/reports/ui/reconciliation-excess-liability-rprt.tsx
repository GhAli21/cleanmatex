'use client';

import { useTranslations } from 'next-intl';
import { CmxDataTable } from '@ui/data-display';
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '@ui/primitives';
import { Badge } from '@ui/primitives/badge';
import { EXCESS_LIABILITY_SOURCES } from '@/lib/constants/reconciliation-reports';
import type { ExcessLiabilityReport, ExcessLiabilityRow } from '@/lib/types/reconciliation-report';
import { fmtAmount, fmtDate } from './reconciliation-format';

interface Props {
  data: ExcessLiabilityReport | null;
  loading: boolean;
  csvHref: string;
}

/**
 * D-09 report 1 — unallocated excess / customer stored-value liability snapshot.
 *
 * @param props report data, loading flag, CSV export href.
 */
export function ReconciliationExcessLiabilityRprt({ data, loading, csvHref }: Props) {
  const t = useTranslations('reports.reconciliation');

  const sourceBadge = (source: string) => {
    const label =
      source === EXCESS_LIABILITY_SOURCES.WALLET
        ? t('sourceWallet')
        : source === EXCESS_LIABILITY_SOURCES.ADVANCE
        ? t('sourceAdvance')
        : t('sourceCreditNote');
    return <Badge variant="outline" className="text-xs">{label}</Badge>;
  };

  const columns = [
    {
      key: 'customer',
      header: t('customer'),
      render: (r: ExcessLiabilityRow) => (
        <div>
          <div className="font-medium">{r.customerName ?? '—'}</div>
          <div className="font-mono text-xs text-muted-foreground">{r.customerId.slice(0, 8)}</div>
        </div>
      ),
    },
    { key: 'source', header: t('source'), render: (r: ExcessLiabilityRow) => sourceBadge(r.source) },
    {
      key: 'outstanding',
      header: t('outstanding'),
      render: (r: ExcessLiabilityRow) => (
        <span className="font-mono font-medium">{fmtAmount(r.outstandingAmount, r.currencyCode)}</span>
      ),
    },
    {
      key: 'lastActivity',
      header: t('lastActivity'),
      render: (r: ExcessLiabilityRow) => <span className="text-sm">{fmtDate(r.lastActivityAt)}</span>,
    },
  ];

  if (loading) return <p className="text-sm text-muted-foreground">{t('loading')}</p>;
  if (!data || data.rows.length === 0) return <p className="text-sm text-muted-foreground">{t('emptyExcess')}</p>;

  const s = data.summary;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <CmxCard>
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('totalOutstanding')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className="text-2xl font-bold">{s.totalOutstanding.toFixed(3)}</span></CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('sourceWallet')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className="text-2xl font-bold">{s.walletTotal.toFixed(3)}</span></CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('sourceAdvance')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className="text-2xl font-bold">{s.advanceTotal.toFixed(3)}</span></CmxCardContent>
        </CmxCard>
        <CmxCard>
          <CmxCardHeader><CmxCardTitle className="text-sm font-medium text-muted-foreground">{t('sourceCreditNote')}</CmxCardTitle></CmxCardHeader>
          <CmxCardContent><span className="text-2xl font-bold">{s.creditNoteTotal.toFixed(3)}</span></CmxCardContent>
        </CmxCard>
      </div>

      <CmxDataTable columns={columns} data={data.rows} />

      <div className="flex justify-end">
        <a href={csvHref} className="text-sm text-primary underline">{t('exportCSV')}</a>
      </div>
    </div>
  );
}
