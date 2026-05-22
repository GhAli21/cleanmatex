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
import { listArCredits } from '@/lib/services/ar-credit.service';
import { ArCreditApplyPanel } from '@features/ar/ui/ar-credit-apply-panel';
import { ArCreditsTable } from '@features/ar/ui/ar-credits-table';

interface PageProps {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
    customer_id?: string;
    search?: string;
  }>;
}

export default async function ArCreditsPage({ searchParams }: PageProps) {
  const t = await getTranslations('invoices.ar.v2.credits');
  const auth = await getAuthContext();
  const resolved = (await searchParams) ?? {};
  const page = Number(resolved.page ?? '1');
  const limit = Number(resolved.limit ?? '20');

  const credits = await listArCredits(
    {
      page: Number.isNaN(page) ? 1 : page,
      limit: Number.isNaN(limit) ? 20 : limit,
      customer_id: resolved.customer_id,
      search: resolved.search,
    },
    { tenantId: auth.tenantId }
  );

  const totalAvailable = credits.data.reduce((sum, row) => sum + row.available_credit_amount, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t('title')}</h1>
        <p className="text-sm text-slate-600">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CmxKpiStatCard title={t('kpis.creditSources')} value={credits.total} />
        <CmxKpiStatCard title={t('kpis.availableAmount')} value={totalAvailable.toFixed(4)} />
        <CmxKpiStatCard title={t('kpis.customers')} value={new Set(credits.data.map((row) => row.customer_id)).size} />
      </div>

      <CmxSummaryMessage type="info" title={t('infoTitle')} items={[t('infoBody')]} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('tableTitle')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent>
            <ArCreditsTable rows={credits.data} page={credits.page} limit={credits.limit} total={credits.total} />
          </CmxCardContent>
        </CmxCard>

        <ArCreditApplyPanel />
      </div>
    </div>
  );
}
