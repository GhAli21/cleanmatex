import { getTranslations } from 'next-intl/server';
import { CmxSummaryMessage } from '@ui/feedback';
import { CmxKpiStatCard } from '@ui/data-display';
import {
  CmxCard,
  CmxCardContent,
  CmxCardHeader,
  CmxCardTitle,
} from '@ui/primitives/cmx-card';
import { getAuthContext } from '@/lib/auth/server-auth';
import { getArAgingReport } from '@/lib/services/ar-invoice.service';
import { ArAgingTable } from '@features/ar/ui/ar-aging-table';

interface PageProps {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
    as_of_date?: string;
  }>;
}

/**
 *
 * @param root0
 * @param root0.searchParams
 */
export default async function ArAgingPage({ searchParams }: PageProps) {
  const t = await getTranslations('invoices.ar.aging');
  const auth = await getAuthContext();
  const resolved = (await searchParams) ?? {};
  const page = Number(resolved.page ?? '1');
  const limit = Number(resolved.limit ?? '20');

  const report = await getArAgingReport(
    {
      page: Number.isNaN(page) ? 1 : page,
      limit: Number.isNaN(limit) ? 20 : limit,
      as_of_date: resolved.as_of_date,
    },
    { tenantId: auth.tenantId }
  );

  const totalOutstanding = report.data.reduce((sum, row) => sum + row.total_outstanding_amount, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t('title')}</h1>
        <p className="text-sm text-slate-600">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CmxKpiStatCard title={t('kpis.customers')} value={report.total} />
        <CmxKpiStatCard title={t('kpis.asOfDate')} value={report.as_of_date} />
        <CmxKpiStatCard title={t('kpis.totalOutstanding')} value={totalOutstanding.toFixed(4)} />
      </div>

      <CmxSummaryMessage
        type="info"
        title={t('infoTitle')}
        items={[t('infoBody')]}
      />

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('tableTitle')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          <ArAgingTable rows={report.data} page={report.page} limit={report.limit} total={report.total} />
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}
