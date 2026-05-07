/**
 * CmxDataTable - Server-side paginated data table
 * @module ui/data-display
 */

'use client'

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ReactNode, useMemo } from 'react'
import { CmxSpinner } from '../primitives/cmx-spinner'

/**
 * Lightweight column descriptor used by feature screens.
 * Internally translated into TanStack `ColumnDef` so callers don't need to
 * know about the underlying table library.
 */
export interface CmxDataTableSimpleColumn<TData> {
  key: string
  header: ReactNode
  render: (row: TData) => ReactNode
}

type AnyColumn<TData> =
  | ColumnDef<TData, unknown>
  | CmxDataTableSimpleColumn<TData>

interface CmxDataTableProps<TData> {
  columns: AnyColumn<TData>[]
  data: TData[]
  /** Preferred name. `isLoading` is accepted as an alias for ergonomics. */
  loading?: boolean
  isLoading?: boolean
  /** Zero-based page index. `currentPage` (1-based) is accepted as an alias. */
  page?: number
  currentPage?: number
  pageSize?: number
  /** Preferred name. `totalCount` is accepted as an alias. */
  total?: number
  totalCount?: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
  emptyMessage?: ReactNode
}

function isSimpleColumn<TData>(
  col: AnyColumn<TData>,
): col is CmxDataTableSimpleColumn<TData> {
  return typeof (col as CmxDataTableSimpleColumn<TData>).render === 'function'
}

export function CmxDataTable<TData>({
  columns,
  data,
  loading,
  isLoading,
  page,
  currentPage,
  pageSize = 25,
  total,
  totalCount,
  onPageChange,
  onPageSizeChange,
  emptyMessage,
}: CmxDataTableProps<TData>) {
  const effectiveLoading = loading ?? isLoading ?? false
  const effectiveTotal = total ?? totalCount ?? 0
  // `currentPage` is 1-based (UI convention); TanStack expects 0-based.
  const effectivePageIndex = page ?? (currentPage != null ? currentPage - 1 : 0)

  const tanstackColumns = useMemo<ColumnDef<TData, unknown>[]>(
    () =>
      columns.map((col) => {
        if (isSimpleColumn(col)) {
          return {
            id: col.key,
            header: () => col.header,
            cell: ({ row }) => col.render(row.original),
          }
        }
        return col
      }),
    [columns],
  )

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: Math.max(1, Math.ceil(effectiveTotal / pageSize)),
    state: {
      pagination: { pageIndex: effectivePageIndex, pageSize },
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex: effectivePageIndex, pageSize })
          : updater
      // Mirror the input convention back to the caller: if they passed
      // 1-based `currentPage`, hand back 1-based; otherwise 0-based.
      if (currentPage != null) onPageChange?.(next.pageIndex + 1)
      else onPageChange?.(next.pageIndex)
      onPageSizeChange?.(next.pageSize)
    },
  })

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]">
        <table className="min-w-full text-sm">
          <thead className="bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))] text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th key={header.id} className="px-3 py-2 text-left font-medium rtl:text-right">
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext(),
                        )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {effectiveLoading ? (
              <tr>
                <td
                  colSpan={tanstackColumns.length}
                  className="px-3 py-8 text-center text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]"
                >
                  <CmxSpinner />
                </td>
              </tr>
            ) : table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-t border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] hover:bg-[rgb(var(--cmx-table-row-hover-bg-rgb,248_250_252))]"
                >
                  {row.getVisibleCells().map((cell) => (
                    <td key={cell.id} className="px-3 py-2">
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            ) : (
              <tr>
                <td
                  colSpan={tanstackColumns.length}
                  className="px-3 py-8 text-center text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]"
                >
                  {emptyMessage ?? 'No data to display.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {/* Pagination component (CmxDataTablePagination) would go here */}
    </div>
  )
}
