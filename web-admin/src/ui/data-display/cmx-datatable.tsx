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
import { CmxSpinner } from '../primitives/cmx-spinner'

interface CmxDataTableProps<TData> {
  columns: ColumnDef<TData, unknown>[]
  data: TData[]
  loading?: boolean
  page: number
  pageSize: number
  total: number
  onPageChange?: (page: number) => void
  onPageSizeChange?: (size: number) => void
}

export function CmxDataTable<TData>({
  columns,
  data,
  loading,
  page,
  pageSize,
  total,
  onPageChange,
  onPageSizeChange,
}: CmxDataTableProps<TData>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / pageSize),
    state: {
      pagination: { pageIndex: page, pageSize },
    },
    onPaginationChange: (updater) => {
      const next =
        typeof updater === 'function'
          ? updater({ pageIndex: page, pageSize })
          : updater
      onPageChange?.(next.pageIndex)
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
                  <th key={header.id} className="px-3 py-2 text-left font-medium">
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
            {loading ? (
              <tr>
                <td
                  colSpan={columns.length}
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
                  colSpan={columns.length}
                  className="px-3 py-8 text-center text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]"
                >
                  No data to display.
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
