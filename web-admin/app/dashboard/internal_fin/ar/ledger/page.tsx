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
import {
  getArCustomerBalance,
  getArCustomerLedger,
} from '@/lib/services/ar-invoice.service';
import { ArLedgerTable } from '@features/ar/ui/ar-ledger-table';

interface PageProps {
  searchParams?: Promise<{
    customerId?: string;
    page?: string;
    limit?: string;
  }>;
}

export default async function ArLedgerPage({ searchParams }: PageProps) {
  const t = await getTranslations('invoices.ar.ledger');
  const auth = await getAuthContext();
  const resolved = (await searchParams) ?? {};
  const customerId = resolved.customerId;

  if (!customerId) {
    return (
      <div className="space-y-6 p-6">
        <CmxSummaryMessage type="info" title={t('missingCustomerTitle')} items={[t('missingCustomerBody')]} />
        <CmxButton asChild>
          <Link href="/dashboard/internal_fin/ar/customers">{t('browseCustomers')}</Link>
        </CmxButton>
      </div>
    );
  }

  const page = Number(resolved.page ?? '1');
  const limit = Number(resolved.limit ?? '20');
  const [balance, ledger] = await Promise.all([
    getArCustomerBalance(customerId, { tenantId: auth.tenantId }),
    getArCustomerLedger(
      customerId,
      {
        page: Number.isNaN(page) ? 1 : page,
        limit: Number.isNaN(limit) ? 20 : limit,
      },
      { tenantId: auth.tenantId }
    ),
  ]);

  return (
    <div className="space-y-6 p-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t('title')}</h1>
        <p className="text-sm text-slate-600">{t('subtitle')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <CmxKpiStatCard title={t('kpis.openInvoices')} value={balance.open_invoice_count} />
        <CmxKpiStatCard title={t('kpis.outstanding')} value={balance.total_outstanding_amount.toFixed(4)} />
        <CmxKpiStatCard title={t('kpis.netBalance')} value={balance.net_balance_amount.toFixed(4)} />
      </div>

      <CmxCard>
        <CmxCardHeader>
          <CmxCardTitle>{t('tableTitle')}</CmxCardTitle>
        </CmxCardHeader>
        <CmxCardContent>
          <ArLedgerTable rows={ledger.data} page={ledger.page} limit={ledger.limit} total={ledger.total} />
        </CmxCardContent>
      </CmxCard>
    </div>
  );
}
