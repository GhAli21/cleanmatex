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
import { listArStatementCycles } from '@/lib/services/ar-statement-cycle.service';
import { ArStatementCyclePanel } from '@features/ar/ui/ar-statement-cycle-panel';
import { ArStatementCyclesTable } from '@features/ar/ui/ar-statement-cycles-table';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { BILLING_INTERNAL_FIN_AR_CYCLES_ACCESS } from '@features/billing/access/billing-access'

interface PageProps {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
    is_active?: string;
    search?: string;
  }>;
}

/**
 *
 * @param root0
 * @param root0.searchParams
 */
export default async function ArStatementCyclesPage({ searchParams }: PageProps) {
  const t = await getTranslations('invoices.ar.v2.cycles');
  const auth = await getAuthContext();
  const resolved = (await searchParams) ?? {};
  const page = Number(resolved.page ?? '1');
  const limit = Number(resolved.limit ?? '20');
  const isActive = resolved.is_active == null ? undefined : resolved.is_active === 'true';

  const cycles = await listArStatementCycles(
    {
      page: Number.isNaN(page) ? 1 : page,
      limit: Number.isNaN(limit) ? 20 : limit,
      is_active: isActive,
      search: resolved.search,
    },
    { tenantId: auth.tenantId }
  );

  const activeCount = cycles.data.filter((row) => row.is_active).length;
  const monthlyCount = cycles.data.filter((row) => row.cadence_cd === 'MONTHLY').length;
  const nextRunCount = cycles.data.filter((row) => row.next_run_at).length;

  return (
    <RequireAnyPermission permissions={BILLING_INTERNAL_FIN_AR_CYCLES_ACCESS.page.permissions ?? []}>
      <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t('title')}</h1>
        <p className="text-sm text-slate-600">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CmxKpiStatCard title={t('kpis.active')} value={activeCount} />
        <CmxKpiStatCard title={t('kpis.monthly')} value={monthlyCount} />
        <CmxKpiStatCard title={t('kpis.nextRuns')} value={nextRunCount} />
      </div>

      <CmxSummaryMessage type="info" title={t('infoTitle')} items={[t('infoBody')]} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,2fr)_minmax(360px,1fr)]">
        <CmxCard>
          <CmxCardHeader>
            <CmxCardTitle>{t('tableTitle')}</CmxCardTitle>
          </CmxCardHeader>
          <CmxCardContent>
            <ArStatementCyclesTable rows={cycles.data} page={cycles.page} limit={cycles.limit} total={cycles.total} />
          </CmxCardContent>
        </CmxCard>

        <ArStatementCyclePanel />
      </div>
    </div>
    </RequireAnyPermission>
  );
}
