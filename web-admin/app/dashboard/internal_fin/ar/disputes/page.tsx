import { getTranslations } from 'next-intl/server';
import { CmxKpiStatCard } from '@ui/data-display';
import { CmxSummaryMessage } from '@ui/feedback';
import {
  CmxCard,
  CmxCardContent,
  CmxCardHeader,
  CmxCardTitle,
} from '@ui/primitives/cmx-card';
import { getAuthContext } from '@/lib/auth/server-auth';
import { listArDisputes } from '@/lib/services/ar-dispute.service';
import { ArDisputePanel } from '@features/ar/ui/ar-dispute-panel';
import { ArDisputesTable } from '@features/ar/ui/ar-disputes-table';

interface PageProps {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
    status_cd?: string;
    customer_id?: string;
    invoice_id?: string;
    search?: string;
  }>;
}

/**
 *
 * @param root0
 * @param root0.searchParams
 */
export default async function ArDisputesPage({ searchParams }: PageProps) {
  const t = await getTranslations('invoices.ar.v2.disputes');
  const auth = await getAuthContext();
  const resolved = (await searchParams) ?? {};
  const page = Number(resolved.page ?? '1');
  const limit = Number(resolved.limit ?? '20');

  const disputes = await listArDisputes(
    {
      page: Number.isNaN(page) ? 1 : page,
      limit: Number.isNaN(limit) ? 20 : limit,
      status_cd: resolved.status_cd,
      customer_id: resolved.customer_id,
      invoice_id: resolved.invoice_id,
      search: resolved.search,
    },
    { tenantId: auth.tenantId }
  );

  const openCount = disputes.data.filter((row) => row.status_cd === 'OPEN' || row.status_cd === 'UNDER_REVIEW').length;
  const resolvedCount = disputes.data.filter((row) => row.status_cd === 'RESOLVED').length;
  const totalDisputed = disputes.data.reduce((sum, row) => sum + row.disputed_amount, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t('title')}</h1>
        <p className="text-sm text-slate-600">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CmxKpiStatCard title={t('kpis.open')} value={openCount} />
        <CmxKpiStatCard title={t('kpis.resolved')} value={resolvedCount} />
        <CmxKpiStatCard title={t('kpis.amount')} value={totalDisputed.toFixed(4)} />
      </div>

      <CmxSummaryMessage type="info" title={t('infoTitle')} items={[t('infoBody')]} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('tableTitle')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent>
            <ArDisputesTable rows={disputes.data} page={disputes.page} limit={disputes.limit} total={disputes.total} />
          </CmxCardContent>
        </CmxCard>

        <ArDisputePanel />
      </div>
    </div>
  );
}
