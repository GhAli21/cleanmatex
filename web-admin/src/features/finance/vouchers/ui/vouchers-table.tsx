'use client';

import { useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import Link from 'next/link';
import { Eye, Pencil } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { CmxDataGrid } from '@ui/data-display';
import { CmxButton } from '@ui/primitives/cmx-button';
import { VoucherStatusBadge } from './voucher-status-badge';
import { VoucherDirectionBadge } from './voucher-direction-badge';
import { VoucherEditDialog } from './voucher-edit-dialog';
import type { VoucherListItem } from '@/lib/types/voucher';
import { VOUCHER_STATUS } from '@/lib/constants/voucher';

interface VouchersTableProps {
  items: VoucherListItem[];
  total: number;
  page: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}

export function VouchersTable({ items, total, page, pageSize, onPageChange }: VouchersTableProps) {
  const t = useTranslations('finance.vouchers');
  const tCommon = useTranslations('common');
  const locale = useLocale();
  const isRtl = locale === 'ar';
  const dir = isRtl ? 'rtl' : 'ltr';
  const totalPages = Math.ceil(total / pageSize);

  const [editVoucher, setEditVoucher] = useState<VoucherListItem | null>(null);

  const voucherTypeLabels: Record<string, string> = {
    RECEIPT_VOUCHER:    t('voucherTypeLabels.RECEIPT_VOUCHER'),
    PAYMENT_VOUCHER:    t('voucherTypeLabels.PAYMENT_VOUCHER'),
    REFUND_VOUCHER:     t('voucherTypeLabels.REFUND_VOUCHER'),
    ADJUSTMENT_VOUCHER: t('voucherTypeLabels.ADJUSTMENT_VOUCHER'),
    TRANSFER_VOUCHER:   t('voucherTypeLabels.TRANSFER_VOUCHER'),
  };

  const columns: ColumnDef<VoucherListItem, unknown>[] = [
    {
      accessorKey: 'voucher_no',
      header: t('voucherNo'),
      cell: ({ getValue }) => (
        <span className="font-mono text-sm font-medium text-blue-700">{getValue() as string}</span>
      ),
      meta: { isCopyable: true },
    },
    {
      accessorKey: 'voucher_type',
      header: t('voucherType'),
      cell: ({ getValue }) => {
        const val = getValue() as string;
        return <span className="text-gray-700">{voucherTypeLabels[val] ?? val}</span>;
      },
    },
    {
      accessorKey: 'direction',
      header: t('direction'),
      cell: ({ getValue }) => <VoucherDirectionBadge direction={getValue() as string | null} />,
      meta: { disableFilter: true },
      enableSorting: false,
    },
    {
      accessorKey: 'party_name',
      header: t('party'),
      cell: ({ getValue }) => (
        <span className="text-gray-700">{(getValue() as string | null) ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'total_amount',
      header: t('totalAmount'),
      cell: ({ row }) => (
        <span className="font-mono font-medium tabular-nums text-gray-900">
          {row.original.total_amount.toLocaleString(isRtl ? 'ar' : 'en', { minimumFractionDigits: 2 })}
          {row.original.currency_code && (
            <span className="ms-1 text-xs text-gray-400">{row.original.currency_code}</span>
          )}
        </span>
      ),
      meta: { disableFilter: true },
      enableSorting: false,
    },
    {
      accessorKey: 'voucher_date',
      header: t('voucherDate'),
      cell: ({ row }) => (
        <span className="text-gray-600">
          {row.original.voucher_date ??
            new Date(row.original.created_at).toLocaleDateString(isRtl ? 'ar' : 'en')}
        </span>
      ),
    },
    {
      accessorKey: 'voucher_status',
      header: tCommon('status'),
      cell: ({ getValue }) => <VoucherStatusBadge status={getValue() as string} />,
      meta: { disableFilter: true },
      enableSorting: false,
    },
    {
      id: 'actions',
      header: '',
      cell: ({ row }) => {
        const voucher = row.original;
        const isDraft = voucher.voucher_status === VOUCHER_STATUS.DRAFT;
        return (
          <div className="flex items-center gap-1">
            {isDraft && (
              <CmxButton
                variant="ghost"
                size="sm"
                onClick={() => setEditVoucher(voucher)}
                title={t('actions.edit')}
              >
                <Pencil className="h-4 w-4" />
              </CmxButton>
            )}
            <Link href={`/dashboard/internal_fin/vouchers/${voucher.id}`}>
              <CmxButton variant="ghost" size="sm" title={tCommon('view')}>
                <Eye className="h-4 w-4" />
              </CmxButton>
            </Link>
          </div>
        );
      },
      meta: { disableFilter: true },
      enableSorting: false,
      enableHiding: false,
    },
  ];

  return (
    <>
      <div className="space-y-3">
        <CmxDataGrid
          data={items}
          columns={columns}
          getRowId={(row) => row.id}
          dir={dir}
          initialPageSize={pageSize}
          pageSizeOptions={[pageSize]}
          enableGlobalSearch
          enableColumnVisibility
          enableDensityToggle
          enableStickyFirstColumn
          enableScrollEdgeHints
          tableWrapperClassName="max-h-[calc(100vh-22rem)]"
          labels={{
            globalSearchPlaceholder: tCommon('search'),
            empty: t('noVouchers'),
          }}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between rounded-lg border border-gray-200 px-4 py-3">
            <span className="text-sm text-gray-600">
              {tCommon('pagination', { page, totalPages })}
            </span>
            <div className="flex gap-2 rtl:flex-row-reverse">
              <CmxButton
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page - 1)}
                disabled={page <= 1}
              >
                {tCommon('previous')}
              </CmxButton>
              <CmxButton
                variant="outline"
                size="sm"
                onClick={() => onPageChange(page + 1)}
                disabled={page >= totalPages}
              >
                {tCommon('next')}
              </CmxButton>
            </div>
          </div>
        )}
      </div>

      <VoucherEditDialog
        open={!!editVoucher}
        voucher={editVoucher}
        onClose={() => setEditVoucher(null)}
      />
    </>
  );
}
