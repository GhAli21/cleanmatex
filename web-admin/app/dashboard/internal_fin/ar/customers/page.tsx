import { getTranslations } from 'next-intl/server';
import {
  CmxCard,
  CmxCardContent,
  CmxCardHeader,
  CmxCardTitle,
} from '@ui/primitives/cmx-card';
import { CmxKpiStatCard } from '@ui/data-display';
import { getAuthContext } from '@/lib/auth/server-auth';
import { listArCustomerBalances } from '@/lib/services/ar-invoice.service';
import { ArCustomerBalancesTable } from '@features/ar/ui/ar-customer-balances-table';

interface PageProps {
  searchParams?: Promise<{
    page?: string;
    limit?: string;
    search?: string;
  }>;
}

export default async function ArCustomersPage({ searchParams }: PageProps) {
  const t = await getTranslations('invoices.ar.customers');
  const auth = await getAuthContext();
  const resolved = (await searchParams) ?? {};
  const page = Number(resolved.page ?? '1');
  const limit = Number(resolved.limit ?? '20');

  const balances = await listArCustomerBalances(
    {
      page: Number.isNaN(page) ? 1 : page,
      limit: Number.isNaN(limit) ? 20 : limit,
      search: resolved.search,
    },
    { tenantId: auth.tenantId }
  );

  const aggregateOutstanding = balances.data.reduce((sum, row) => sum + row.total_outstanding_amount, 0);
  const aggregateCredit = balances.data.reduce((sum, row) => sum + row.unapplied_credit_amount, 0);

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t('title')}</h1>
        <p className="text-sm text-slate-600">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CmxKpiStatCard title={t('kpis.customers')} value={balances.total} />
        <CmxKpiStatCard title={t('kpis.outstanding')} value={aggregateOutstanding.toFixed(4)} />
        <CmxKpiStatCard title={t('kpis.unappliedCredit')} value={aggregateCredit.toFixed(4)} />
      </div>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('tableTitle')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          <ArCustomerBalancesTable
            rows={balances.data}
            page={balances.page}
            limit={balances.limit}
            total={balances.total}
          />
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}
