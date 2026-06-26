import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { CmxSummaryMessage } from '@ui/feedback';
import { CmxButton } from '@ui/primitives';
import {
  CmxCard,
  CmxCardContent,
  CmxCardHeader,
  CmxCardTitle,
} from '@ui/primitives/cmx-card';
import { CmxKpiStatCard } from '@ui/data-display';
import { getAuthContext } from '@/lib/auth/server-auth';
import { getArCustomerStatement } from '@/lib/services/ar-invoice.service';
import { ArStatementTable } from '@features/ar/ui/ar-statement-table';
import { RequireAnyPermission } from '@features/auth/ui/RequirePermission'
import { BILLING_INTERNAL_FIN_AR_STATEMENTS_ACCESS } from '@features/billing/access/billing-access'

interface PageProps {
  searchParams?: Promise<{
    customerId?: string;
    date_from?: string;
    date_to?: string;
  }>;
}

/**
 *
 * @param root0
 * @param root0.searchParams
 */
export default async function ArStatementsPage({ searchParams }: PageProps) {
  const t = await getTranslations('invoices.ar.statements');
  const tCommon = await getTranslations('common');
  const auth = await getAuthContext();
  const resolved = (await searchParams) ?? {};
  const customerId = resolved.customerId;

  if (!customerId) {
    return (
    <RequireAnyPermission permissions={BILLING_INTERNAL_FIN_AR_STATEMENTS_ACCESS.page.permissions ?? []}>
      <div className="space-y-6 p-6">
        <CmxSummaryMessage type="info" title={t('missingCustomerTitle')} items={[t('missingCustomerBody')]} />
        <CmxButton asChild>
          <Link href="/dashboard/internal_fin/ar/customers">{t('browseCustomers')}</Link>
        </CmxButton>
      </div>
    </RequireAnyPermission>
  );
  }

  const statement = await getArCustomerStatement(
    customerId,
    {
      date_from: resolved.date_from,
      date_to: resolved.date_to,
    },
    { tenantId: auth.tenantId }
  );

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t('title')}</h1>
          <p className="text-sm text-slate-600">{t('subtitle')}</p>
        </div>
        <CmxButton asChild variant="outline">
          <Link
            href={{
              pathname: '/dashboard/internal_fin/ar/statements/print',
              query: {
                customerId,
                ...(resolved.date_from ? { date_from: resolved.date_from } : {}),
                ...(resolved.date_to ? { date_to: resolved.date_to } : {}),
              },
            }}
          >
            {tCommon('print')}
          </Link>
        </CmxButton>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CmxKpiStatCard title={t('kpis.opening')} value={statement.opening_balance.toFixed(4)} />
        <CmxKpiStatCard title={t('kpis.closing')} value={statement.closing_balance.toFixed(4)} />
        <CmxKpiStatCard title={t('kpis.lines')} value={statement.lines.length} />
      </div>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('tableTitle')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          <ArStatementTable rows={statement.lines} />
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}
