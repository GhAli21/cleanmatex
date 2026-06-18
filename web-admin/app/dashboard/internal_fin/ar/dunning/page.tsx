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
import { listArDunningRuns } from '@/lib/services/ar-dunning-ops.service';
import { ArDunningRunPanel } from '@features/ar/ui/ar-dunning-run-panel';
import { ArDunningTable } from '@features/ar/ui/ar-dunning-table';

interface PageProps {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
    customer_id?: string;
    invoice_id?: string;
    status_cd?: string;
  }>;
}

/**
 *
 * @param root0
 * @param root0.searchParams
 */
export default async function ArDunningPage({ searchParams }: PageProps) {
  const t = await getTranslations('invoices.ar.v2.dunning');
  const auth = await getAuthContext();
  const resolved = (await searchParams) ?? {};
  const page = Number(resolved.page ?? '1');
  const limit = Number(resolved.limit ?? '20');

  const runs = await listArDunningRuns(
    {
      page: Number.isNaN(page) ? 1 : page,
      limit: Number.isNaN(limit) ? 20 : limit,
      customer_id: resolved.customer_id,
      invoice_id: resolved.invoice_id,
      status_cd: resolved.status_cd,
    },
    { tenantId: auth.tenantId }
  );

  const sentCount = runs.data.filter((row) => row.status_cd === 'SENT').length;
  const failedCount = runs.data.filter((row) => row.status_cd === 'FAILED').length;
  const holdCount = runs.data.filter((row) => row.action_cd === 'HOLD').length;

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t('title')}</h1>
        <p className="text-sm text-slate-600">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CmxKpiStatCard title={t('kpis.sent')} value={sentCount} />
        <CmxKpiStatCard title={t('kpis.failed')} value={failedCount} />
        <CmxKpiStatCard title={t('kpis.holds')} value={holdCount} />
      </div>

      <CmxSummaryMessage type="info" title={t('infoTitle')} items={[t('infoBody')]} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('tableTitle')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent>
            <ArDunningTable rows={runs.data} page={runs.page} limit={runs.limit} total={runs.total} />
          </CmxCardContent>
        </CmxCard>

        <ArDunningRunPanel />
      </div>
    </div>
  );
}
