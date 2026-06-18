import Link from 'next/link';
import type { SortingState } from '@tanstack/react-table';
import { getTranslations } from 'next-intl/server';
import { CmxButton } from '@ui/primitives';
import { CmxKpiStatCard } from '@ui/data-display';
import { getAuthContext } from '@/lib/auth/server-auth';
import {
  getArInvoiceHubStats,
  listArInvoices,
} from '@/lib/services/ar-invoice.service';
import { ArInvoiceHubFilters } from '@features/ar/ui/ar-invoice-hub-filters';
import { ArInvoicesHubTable } from '@features/ar/ui/ar-invoices-hub-table';

interface InvoicesSearchParams {
  page?: string;
  limit?: string;
  search?: string;
  status?: string;
  invoiceType?: string;
  invoice_type_cd?: string;
  fromDate?: string;
  toDate?: string;
  date_from?: string;
  date_to?: string;
  sortBy?: string;
  sortOrder?: string;
  sort_by?: string;
  sort_order?: string;
}

interface PageProps {
  searchParams?: Promise<InvoicesSearchParams>;
}

function normalizePositiveInt(value: string | undefined, fallback: number) {
  const parsed = Number(value ?? '');
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/**
 *
 * @param root0
 * @param root0.searchParams
 */
export default async function InvoicesPage({ searchParams }: PageProps) {
  const t = await getTranslations('invoices');
  const tHub = await getTranslations('invoices.ar.hub');
  const auth = await getAuthContext();
  const resolved = (await searchParams) ?? {};
  const page = normalizePositiveInt(resolved.page, 1);
  const limit = normalizePositiveInt(resolved.limit, 20);
  const status = resolved.status?.trim() || undefined;
  const invoiceType = resolved.invoice_type_cd?.trim() || resolved.invoiceType?.trim() || undefined;
  const dateFrom = resolved.date_from?.trim() || resolved.fromDate?.trim() || undefined;
  const dateTo = resolved.date_to?.trim() || resolved.toDate?.trim() || undefined;
  const sortBy = resolved.sort_by?.trim() || resolved.sortBy?.trim() || 'created_at';
  const sortOrder = resolved.sort_order === 'asc' || resolved.sortOrder === 'asc' ? 'asc' : 'desc';

  const [stats, invoices] = await Promise.all([
    getArInvoiceHubStats({ tenantId: auth.tenantId }),
    listArInvoices(
      {
        page,
        limit,
        status,
        invoice_type_cd: invoiceType,
        search: resolved.search?.trim() || undefined,
        date_from: dateFrom,
        date_to: dateTo,
        sort_by: sortBy,
        sort_order: sortOrder,
      },
      { tenantId: auth.tenantId }
    ),
  ]);

  const sorting: SortingState = sortBy
    ? [{ id: sortBy, desc: sortOrder === 'desc' }]
    : [];
  const exportParams = new URLSearchParams();
  if (resolved.search?.trim()) exportParams.set('search', resolved.search.trim());
  if (status) exportParams.set('status', status);
  if (invoiceType) exportParams.set('invoice_type_cd', invoiceType);
  if (dateFrom) exportParams.set('date_from', dateFrom);
  if (dateTo) exportParams.set('date_to', dateTo);
  if (sortBy) exportParams.set('sort_by', sortBy);
  if (sortOrder) exportParams.set('sort_order', sortOrder);

  return (
    <div className="space-y-6 p-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-sky-50 p-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">{t('title')}</h1>
          <p className="max-w-3xl text-sm text-slate-600">{tHub('subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 rtl:flex-row-reverse">
          <CmxButton asChild variant="outline">
            <Link href={`/api/v1/ar/invoices/export?${exportParams.toString()}`}>{tHub('actions.export')}</Link>
          </CmxButton>
          <CmxButton asChild>
            <Link href="/dashboard/internal_fin/invoices/new">{t('ar.create.actions.create')}</Link>
          </CmxButton>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <CmxKpiStatCard title={t('stats.total')} value={stats.total_invoices} />
        <CmxKpiStatCard title={tHub('kpis.draft')} value={stats.draft_invoices} />
        <CmxKpiStatCard title={tHub('kpis.open')} value={stats.open_invoices} />
        <CmxKpiStatCard title={t('stats.paid')} value={stats.paid_invoices} />
        <CmxKpiStatCard title={tHub('kpis.outstanding')} value={stats.total_outstanding_amount.toFixed(4)} />
      </div>

      <ArInvoiceHubFilters />

      <ArInvoicesHubTable
        invoices={invoices.data}
        page={invoices.page}
        limit={invoices.limit}
        total={invoices.total}
        sorting={sorting}
      />
    </div>
  );
}
