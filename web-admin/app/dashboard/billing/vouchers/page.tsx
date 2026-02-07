/**
 * Vouchers List Page
 *
 * Displays a paginated, filterable list of vouchers for the current tenant.
 * Route: /dashboard/billing/vouchers
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { listVouchersAction } from '@/app/actions/payments/voucher-list-actions';
import VoucherFiltersBar from './components/voucher-filters-bar';
import VouchersTable from './components/vouchers-table';

type VouchersSearchParams = {
  page?: string;
  status?: string;
  voucherCategory?: string;
  voucherType?: string;
  startDate?: string;
  endDate?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: string;
};

interface PageProps {
  searchParams?: Promise<VouchersSearchParams>;
}

export default async function VouchersPage({ searchParams }: PageProps) {
  const t = await getTranslations('billing');
  const tCommon = await getTranslations('common');

  const resolvedSearchParams = await searchParams;
  const params: VouchersSearchParams = resolvedSearchParams ?? {};

  let tenantOrgId: string;
  try {
    const authContext = await getAuthContext();
    tenantOrgId = authContext.tenantId;
  } catch (error) {
    console.error('[VouchersPage] Auth error:', error);
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error instanceof Error ? error.message : 'Authentication failed. Please log in again.'}
        </div>
      </div>
    );
  }

  const page =
    params.page && !Number.isNaN(Number.parseInt(params.page, 10))
      ? Number.parseInt(params.page, 10)
      : 1;

  const sortBy = params.sortBy || 'created_at';
  const sortOrder = (params.sortOrder === 'asc' ? 'asc' : 'desc') as 'asc' | 'desc';

  const filters = {
    page,
    limit: 20,
    status: params.status,
    voucherCategory: params.voucherCategory,
    voucherType: params.voucherType,
    fromDate: params.startDate,
    toDate: params.endDate,
    search: params.search,
    sortBy,
    sortOrder,
  };

  const vouchersResult = await listVouchersAction(filters);

  if (!vouchersResult.success) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {vouchersResult.error || 'Failed to load vouchers'}
        </div>
      </div>
    );
  }

  const vouchers = vouchersResult.data?.vouchers || [];
  const pagination = vouchersResult.data?.pagination || {
    page: 1,
    limit: 20,
    totalCount: 0,
    totalPages: 0,
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('receiptVoucher.title') ?? 'Receipt Vouchers'}</h1>
          <p className="mt-1 text-gray-600">{t('receiptVoucher.description') ?? 'View and manage receipt vouchers'}</p>
        </div>
        <Link
          href="/dashboard/billing/vouchers/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('receiptVoucher.newVoucher') ?? 'New Voucher'}
        </Link>
      </div>

      {/* Filters */}
      <VoucherFiltersBar />

      {/* Vouchers Table */}
      <Suspense fallback={<div>{tCommon('loading')}</div>}>
        <VouchersTable
          vouchers={vouchers}
          pagination={pagination}
          sortBy={sortBy}
          sortOrder={sortOrder}
        />
      </Suspense>
    </div>
  );
}
