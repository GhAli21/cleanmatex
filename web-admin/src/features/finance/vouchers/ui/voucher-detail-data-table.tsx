'use client';

import { CmxDataTable, type CmxDataTableSimpleColumn } from '@ui/data-display';
import { CmxCopyableCell } from '@ui/data-display/cmx-copyable-cell';
import { cn } from '@/lib/utils';

interface VoucherDetailCopyValueProps {
  value: string | number | null | undefined;
  displayValue?: string;
  maxLength?: number;
  align?: 'left' | 'right';
  className?: string;
}

interface VoucherDetailDataTableProps<TData> {
  columns: CmxDataTableSimpleColumn<TData>[];
  data: TData[];
  emptyStateTitle: string;
  emptyStateDescription?: string;
  className?: string;
  scrollAreaClassName?: string;
}

export function VoucherDetailCopyValue({
  value,
  displayValue,
  maxLength,
  align = 'left',
  className,
}: VoucherDetailCopyValueProps) {
  return (
    <CmxCopyableCell
      as="span"
      value={value}
      displayValue={displayValue}
      maxLength={maxLength}
      align={align}
      className={cn('px-0 py-0 text-sm text-foreground', className)}
    />
  );
}

export function VoucherDetailDataTable<TData>({
  columns,
  data,
  emptyStateTitle,
  emptyStateDescription,
  className,
  scrollAreaClassName,
}: VoucherDetailDataTableProps<TData>) {
  return (
    <CmxDataTable
      columns={columns}
      data={data}
      emptyStateTitle={emptyStateTitle}
      emptyStateDescription={emptyStateDescription}
      paginationFooter="never"
      enableZebraStriping
      className={cn('rounded-none border-0 shadow-none', className)}
      scrollAreaClassName={cn('max-h-[28rem] overflow-auto', scrollAreaClassName)}
    />
  );
}
