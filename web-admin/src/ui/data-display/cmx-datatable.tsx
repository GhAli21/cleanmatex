/**
 * CmxDataTable - Server-side paginated data table with enhanced UX
 * @module ui/data-display
 */

'use client'

import type { ColumnDef, HeaderContext } from '@tanstack/react-table'
import {
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

const ROW_NUM_COL_ID = '__cmx_row_no'

/**
 * Lightweight column descriptor used by feature screens.
 * Internally translated into TanStack `ColumnDef` so callers don't need to
 * know about the underlying table library.
 */
export interface CmxDataTableSimpleColumn<TData> {
  key: string
  header: ReactNode
  render: (row: TData) => ReactNode
  /** Default true except `key === 'actions'`. Set false to disable header sort. */
  sortable?: boolean
  align?: 'left' | 'center' | 'right'
}

type AnyColumn<TData> =
  | ColumnDef<TData, unknown>
  | CmxDataTableSimpleColumn<TData>

export type CmxDataTablePaginationFooter = 'auto' | 'always' | 'never'

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
  /** When true, TanStack sorts the current `data` client-side when headers change (use for small local lists). */
  clientSideSorting?: boolean
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
  /**
   * Scroll both axes inside the card. Uses a max height so tall tables scroll vertically.
   * Set `false` or pass `scrollAreaClassName` without max-h to only rely on horizontal overflow.
   */
  scrollable?: boolean
  /** Tailwind / arbitrary classes for the scroll wrapper (merged with overflow). Default includes max-height. */
  scrollAreaClassName?: string
  /** First column with 1-based row index (offset for server pagination = pageIndex * pageSize). */
  showRowNumbers?: boolean
  /** Label for the row number column header. */
  rowNumberHeader?: ReactNode
  /** Zero-based global offset added to displayed row index (defaults to current page start). */
  rowNumberOffset?: number
  /**
   * When to show the pagination footer (`auto`: only when total &gt; pageSize).
   * `always` shows rows-per-page + range (and page controls when multiple pages).
   */
  paginationFooter?: CmxDataTablePaginationFooter
  /** Optional class(es) applied to each `<tr>`. Return undefined to apply no extra class. */
  getRowClassName?: (row: TData, index: number) => string | undefined
}

function isSimpleColumn<TData>(
  col: AnyColumn<TData>,
): col is CmxDataTableSimpleColumn<TData> {
  return typeof (col as CmxDataTableSimpleColumn<TData>).render === 'function'
}

function isSortableSimpleColumn<TData>(col: CmxDataTableSimpleColumn<TData>): boolean {
  if (col.sortable === false) return false
  return col.key !== 'actions'
}

function withSortableColumnHeader<TData>(
  def: ColumnDef<TData, unknown>,
): ColumnDef<TData, unknown> {
  const meta = def.meta as { disableSort?: boolean } | undefined
  if (def.enableSorting === false || meta?.disableSort) return def
  const id = typeof def.id === 'string' ? def.id : undefined
  if (id === 'actions' || id?.endsWith('_actions')) return def

  const origHeader = def.header
  return {
    ...def,
    enableSorting: (def as { enableSorting?: boolean }).enableSorting !== false,
    header: (ctx: HeaderContext<TData, unknown>) => {
      const label =
        typeof origHeader === 'function'
          ? (origHeader as (c: HeaderContext<TData, unknown>) => ReactNode)(ctx)
          : (origHeader ?? ctx.column.id)
      const { column } = ctx
      if (!column.getCanSort()) {
        return <span className="inline-flex items-center gap-1">{label}</span>
      }
      const sorted = column.getIsSorted()
      return (
        <CmxButton
          type="button"
          variant="ghost"
          size="sm"
          className="h-auto min-h-8 w-full justify-start gap-1 p-0 font-medium hover:bg-transparent rtl:justify-end"
          aria-sort={
            sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
          }
          onClick={() => column.toggleSorting()}
        >
          <span className="inline-flex items-center gap-1">
            {label}
            {sorted === 'asc' ? <ArrowUp className="h-3 w-3 shrink-0" aria-hidden /> : null}
            {sorted === 'desc' ? <ArrowDown className="h-3 w-3 shrink-0" aria-hidden /> : null}
            {sorted !== 'asc' && sorted !== 'desc' ? (
              <ArrowUpDown className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
            ) : null}
          </span>
        </CmxButton>
      )
    },
  } as ColumnDef<TData, unknown>
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
  clientSideSorting = false,
  emptyStateTitle,
  emptyStateDescription,
  emptyStateIcon,
  emptyStateAction,
  skeletonRows = 5,
  className,
  enableZebraStriping = false,
  emptyMessage,
  scrollable = true,
  scrollAreaClassName,
  showRowNumbers = false,
  rowNumberHeader = '#',
  rowNumberOffset: rowNumberOffsetProp,
  paginationFooter = 'auto',
  getRowClassName,
}: CmxDataTableProps<TData>) {
  const effectiveLoading = loading ?? isLoading ?? false
  const effectiveTotal = total ?? totalCount ?? 0
  // `currentPage` is 1-based (UI convention); TanStack expects 0-based.
  const effectivePageIndex = page ?? (currentPage != null ? currentPage - 1 : 0)
  const resolvedRowNumberOffset =
    rowNumberOffsetProp ?? effectivePageIndex * pageSize

  const [internalSorting, setInternalSorting] = useState<SortingState>(sorting ?? [])

  const tanstackColumns = useMemo<ColumnDef<TData, unknown>[]>(() => {
    const mapped = columns.map((col) => {
      if (isSimpleColumn(col)) {
        const sortable = isSortableSimpleColumn(col)
        return {
          id: col.key,
          header: ({ column }) => {
            if (!sortable) {
              return col.header
            }
            const sorted = column.getIsSorted()
            return (
              <CmxButton
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto min-h-8 w-full justify-start gap-1 p-0 font-medium hover:bg-transparent rtl:justify-end"
                aria-sort={
                  sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : 'none'
                }
                onClick={() => column.toggleSorting()}
              >
                <span className="inline-flex items-center gap-1">
                  {col.header}
                  {sorted === 'asc' ? <ArrowUp className="h-3 w-3 shrink-0" aria-hidden /> : null}
                  {sorted === 'desc' ? <ArrowDown className="h-3 w-3 shrink-0" aria-hidden /> : null}
                  {sorted !== 'asc' && sorted !== 'desc' ? (
                    <ArrowUpDown className="h-3 w-3 shrink-0 opacity-50" aria-hidden />
                  ) : null}
                </span>
              </CmxButton>
            )
          },
          cell: ({ row }) => col.render(row.original),
          enableSorting: sortable,
        } as ColumnDef<TData, unknown>
      }
      return withSortableColumnHeader(col as ColumnDef<TData, unknown>)
    })

    if (!showRowNumbers) return mapped

    const rowNoCol: ColumnDef<TData, unknown> = {
      id: ROW_NUM_COL_ID,
      enableSorting: false,
      header: () => rowNumberHeader,
      cell: ({ row }) => (
        <span
          className="tabular-nums text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]"
          aria-label={`Row ${resolvedRowNumberOffset + row.index + 1}`}
        >
          {resolvedRowNumberOffset + row.index + 1}
        </span>
      ),
    }
    return [rowNoCol, ...mapped]
  }, [columns, showRowNumbers, rowNumberHeader, resolvedRowNumberOffset])

  const table = useReactTable({
    data,
    columns: tanstackColumns,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    manualSorting: !clientSideSorting,
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

  const defaultScrollClasses =
    scrollable === false
      ? 'overflow-x-auto'
      : 'max-h-[min(70vh,42rem)] overflow-auto'

  const scrollWrapperClass = cn(defaultScrollClasses, scrollAreaClassName)

  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize))
  const showPaginationBlock =
    paginationFooter !== 'never' &&
    (paginationFooter === 'always' || effectiveTotal > pageSize)

  const noopPageSize = () => {}

  return (
    <CmxCard className={className}>
      <CmxCardContent className="p-0">
        <div className={scrollWrapperClass}>
          <table className="min-w-full text-sm">
            <thead className="sticky top-0 z-[1] bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] shadow-[0_1px_0_0_rgb(var(--cmx-border-subtle-rgb,226_232_240))]">
              {table.getHeaderGroups().map((headerGroup) => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map((header) => (
                    <th
                      key={header.id}
                      scope="col"
                      className={cn(
                        'px-4 py-4 text-left text-xs font-semibold uppercase tracking-[0.02em] rtl:text-right',
                        header.column.id === ROW_NUM_COL_ID && 'w-14 text-right tabular-nums rtl:text-left',
                      )}
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
                      enableZebraStriping && index % 2 === 1 && 'bg-[rgb(var(--cmx-muted-rgb,241_245_249))]',
                      getRowClassName?.(row.original, index),
                    )}
                  >
                    {row.getVisibleCells().map((cell) => {
                      const simpleCol = columns.find(
                        (col) => isSimpleColumn(col) && col.key === cell.column.id,
                      ) as CmxDataTableSimpleColumn<TData> | undefined
                      const alignClass = simpleCol?.align ? `text-${simpleCol.align}` : ''
                      return (
                        <td
                          key={cell.id}
                          className={cn(
                            'px-4 py-4 align-middle',
                            alignClass,
                            cell.column.id === ROW_NUM_COL_ID && 'w-14 text-right tabular-nums rtl:text-left',
                          )}
                        >
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

      {showPaginationBlock && (
        <CmxCardFooter className="flex flex-col gap-3 border-t border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] sm:flex-row sm:items-center sm:justify-between">
          <div className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
            {effectiveTotal > 0 ? (
              <>
                Showing {(effectivePageIndex * pageSize) + 1} -{' '}
                {Math.min((effectivePageIndex + 1) * pageSize, effectiveTotal)} of {effectiveTotal}
              </>
            ) : (
              'No rows'
            )}
          </div>
          <div className="min-w-0 flex-1 sm:flex sm:justify-end">
            <CmxPagination
              currentPage={effectivePageIndex + 1}
              totalPages={totalPages}
              pageSize={pageSize}
              totalItems={effectiveTotal}
              onPageChange={(p) => {
                if (currentPage != null) onPageChange?.(p)
                else onPageChange?.(p - 1)
              }}
              onPageSizeChange={onPageSizeChange ?? noopPageSize}
              showWhenSinglePage={paginationFooter === 'always'}
            />
          </div>
        </CmxCardFooter>
      )}
    </CmxCard>
  )
}
