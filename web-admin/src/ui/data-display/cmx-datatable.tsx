/**
 * CmxDataTable - Server-side paginated data table with enhanced UX
 * @module ui/data-display
 */

'use client'

import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from '@tanstack/react-table'
import { ReactNode, useMemo, useState } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { CmxButton } from '../primitives/cmx-button'
import { CmxCard, CmxCardContent, CmxCardFooter } from '../primitives/cmx-card'
import { CmxEmptyState } from './cmx-empty-state'
import { CmxPagination } from '../navigation/cmx-pagination'
import { cn } from '@/lib/utils'

/**
 * Lightweight column descriptor used by feature screens.
 * Internally translated into TanStack `ColumnDef` so callers don't need to
 * know about the underlying table library.
 */
export interface CmxDataTableSimpleColumn<TData> {
  key: string
  header: ReactNode
  render: (row: TData) => ReactNode
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
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
  /** Sorting support */
  sorting?: SortingState
  onSortingChange?: (sorting: SortingState) => void
  /** Enhanced empty state */
  emptyStateTitle?: string
  emptyStateDescription?: string
  emptyStateIcon?: ReactNode
  emptyStateAction?: ReactNode
  /** Loading configuration */
  skeletonRows?: number
  /** Table styling */
  className?: string
  enableZebraStriping?: boolean
  /** Legacy empty message (deprecated, use emptyState* props) */
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
  sorting,
  onSortingChange,
  emptyStateTitle,
  emptyStateDescription,
  emptyStateIcon,
  emptyStateAction,
  skeletonRows = 5,
  className,
  enableZebraStriping = false,
  emptyMessage,
}: CmxDataTableProps<TData>) {
  const effectiveLoading = loading ?? isLoading ?? false
  const effectiveTotal = total ?? totalCount ?? 0
  // `currentPage` is 1-based (UI convention); TanStack expects 0-based.
  const effectivePageIndex = page ?? (currentPage != null ? currentPage - 1 : 0)

  const [internalSorting, setInternalSorting] = useState<SortingState>(sorting ?? [])

  const tanstackColumns = useMemo<ColumnDef<TData, unknown>[]>(
    () =>
      columns.map((col) => {
        if (isSimpleColumn(col)) {
          return {
            id: col.key,
            header: ({ column }) => {
              if (!col.sortable) {
                return col.header
              }
              return (
                <CmxButton
                  variant="ghost"
                  size="sm"
                  className="h-auto p-0 font-medium hover:bg-transparent"
                  onClick={() => column.toggleSorting()}
                >
                  {col.header}
                  {column.getIsSorted() === 'asc' && <ArrowUp className="ml-1 h-3 w-3" />}
                  {column.getIsSorted() === 'desc' && <ArrowDown className="ml-1 h-3 w-3" />}
                  {column.getIsSorted() === false && <ArrowUpDown className="ml-1 h-3 w-3 opacity-50" />}
                </CmxButton>
              )
            },
            cell: ({ row }) => col.render(row.original),
            enableSorting: col.sortable,
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
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: true,
    pageCount: Math.max(1, Math.ceil(effectiveTotal / pageSize)),
    state: {
      pagination: { pageIndex: effectivePageIndex, pageSize },
      sorting: sorting ?? internalSorting,
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
    onSortingChange: (updater) => {
      const next = typeof updater === 'function' ? updater(sorting ?? internalSorting) : updater
      if (onSortingChange) {
        onSortingChange(next)
      } else {
        setInternalSorting(next)
      }
    },
  })

  return (
    <CmxCard className={className}>
      <CmxCardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      className="px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.02em] rtl:text-right"
                    >
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
                Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                  <tr
                    key={rowIndex}
                    className="border-t border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-card-bg-rgb,255_255_255))] transition-colors"
                  >
                    {tanstackColumns.map((_, cellIndex) => (
                      <td key={cellIndex} className="px-4 py-4">
                        <div className="h-3 rounded-full bg-[rgb(var(--cmx-muted-rgb,241_245_249))] animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : table.getRowModel().rows.length ? (
                table.getRowModel().rows.map((row, index) => (
                  <tr
                    key={row.id}
                    className={cn(
                      'border-t border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] transition-colors hover:bg-[rgb(var(--cmx-table-row-hover-bg-rgb,248_250_252))]',
                      enableZebraStriping && index % 2 === 1 && 'bg-[rgb(var(--cmx-muted-rgb,241_245_249))]'
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const simpleCol = columns.find(
                        (col) => isSimpleColumn(col) && col.key === cell.column.id,
                      ) as CmxDataTableSimpleColumn<TData> | undefined
                      const alignClass = simpleCol?.align ? `text-${simpleCol.align}` : ''
                      return (
                        <td key={cell.id} className={cn('px-4 py-4 align-middle', alignClass)}>
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </td>
                      )
                    })}
                  </tr>
                ))
              ) : emptyStateTitle || emptyStateDescription || emptyStateIcon || emptyStateAction ? (
                <tr>
                  <td colSpan={tanstackColumns.length} className="p-0">
                    <CmxEmptyState
                      icon={emptyStateIcon}
                      title={emptyStateTitle ?? 'No data found'}
                      description={emptyStateDescription}
                      action={emptyStateAction}
                    />
                  </td>
                </tr>
              ) : (
                <tr>
                  <td
                    colSpan={tanstackColumns.length}
                    className="px-4 py-12 text-center text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]"
                  >
                    {emptyMessage ?? 'No data to display.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </CmxCardContent>

      {effectiveTotal > pageSize && (
        <CmxCardFooter className="justify-between gap-4">
          <div className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
            Showing {(effectivePageIndex * pageSize) + 1} -{' '}
            {Math.min((effectivePageIndex + 1) * pageSize, effectiveTotal)} of {effectiveTotal}
          </div>
          <CmxPagination
            currentPage={effectivePageIndex + 1}
            totalPages={Math.ceil(effectiveTotal / pageSize)}
            pageSize={pageSize}
            totalItems={effectiveTotal}
            onPageChange={(page) => {
              if (currentPage != null) onPageChange?.(page)
              else onPageChange?.(page - 1)
            }}
            onPageSizeChange={onPageSizeChange}
          />
        </CmxCardFooter>
      )}
    </CmxCard>
  )
}
