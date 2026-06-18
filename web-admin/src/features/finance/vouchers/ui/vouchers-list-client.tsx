'use client';

import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { VouchersTable } from './vouchers-table';
import type { VoucherListItem } from '@/lib/types/voucher';

interface VouchersListClientProps {
  items: VoucherListItem[];
  total: number;
  page: number;
  pageSize: number;
}

/**
 *
 * @param root0
 * @param root0.items
 * @param root0.total
 * @param root0.page
 * @param root0.pageSize
 */
export function VouchersListClient({ items, total, page, pageSize }: VouchersListClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function handlePageChange(newPage: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(newPage));
    router.push(`${pathname}?${params.toString()}`);
  }

  return (
    <VouchersTable
      items={items}
      total={total}
      page={page}
      pageSize={pageSize}
      onPageChange={handlePageChange}
    />
  );
}
