/**
 * Business Vouchers List Page
 * Route: /dashboard/internal_fin/vouchers
 */

import { Suspense } from 'react';
import Link from 'next/link';
import { getTranslations } from 'next-intl/server';
import { getAuthContext } from '@/lib/auth/server-auth';
import { listBizVouchersAction } from '@/app/actions/finance/voucher-actions';
import { VouchersListClient } from '@features/finance/vouchers/ui/vouchers-list-client';
import type { VoucherListFilters } from '@/lib/types/voucher';

const PAGE_SIZE = 20;

interface PageProps {
  searchParams?: Promise<Record<string, string>>;
}

export default async function VouchersPage({ searchParams }: PageProps) {
  const t = await getTranslations('finance.vouchers');
  const tCommon = await getTranslations('common');

  try {
    await getAuthContext();
  } catch (error) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {error instanceof Error ? error.message : tCommon('error')}
        </div>
      </div>
    );
  }

  const params = (await searchParams) ?? {};
  const page = Math.max(1, parseInt(params.page ?? '1', 10) || 1);

  const filters: VoucherListFilters = {
    voucher_type:   params.voucher_type   as VoucherListFilters['voucher_type']   ?? undefined,
    voucher_status: params.voucher_status as VoucherListFilters['voucher_status'] ?? undefined,
    direction:      params.direction      as VoucherListFilters['direction']      ?? undefined,
    date_from:      params.date_from      ?? undefined,
    date_to:        params.date_to        ?? undefined,
    search:         params.search         ?? undefined,
  };

  const result = await listBizVouchersAction(filters, page, PAGE_SIZE);

  if (!result.success) {
    return (
      <div className="space-y-6 p-6">
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          {result.error ?? tCommon('error')}
        </div>
      </div>
    );
  }

  const items = result.data?.items ?? [];
  const total = result.data?.total ?? 0;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">{t('title')}</h1>
          <p className="mt-1 text-sm text-gray-500">
            {tCommon('total')}: {total}
          </p>
        </div>
        <Link
          href="/dashboard/internal_fin/vouchers/new"
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {t('newVoucher')}
        </Link>
      </div>

      <Suspense fallback={<div className="py-8 text-center text-sm text-gray-500">{tCommon('loading')}</div>}>
        <VouchersListClient
          items={items}
          total={total}
          page={page}
          pageSize={PAGE_SIZE}
        />
      </Suspense>
    </div>
  );
}
