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
import { ReactNode, useCallback, useMemo, useRef, useState, useTransition } from 'react'
import { ArrowUpDown, ArrowUp, ArrowDown, UserRound } from 'lucide-react'
import { useTranslations } from 'next-intl'
import { CmxButton } from '../primitives/cmx-button'
import { CmxCard, CmxCardContent, CmxCardFooter } from '../primitives/cmx-card'
import { CmxEmptyState } from './cmx-empty-state'
import { CmxAuditInfoCard } from './cmx-audit-info-card'
import { CmxPagination } from '../navigation/cmx-pagination'
import {
  CmxDialog,
  CmxDialogContent,
  CmxDialogFooter,
  CmxDialogHeader,
  CmxDialogTitle,
} from '../overlays/cmx-dialog'
import { cn } from '@/lib/utils'
import type { AuditActor } from './cmx-audit-info-card'

const ROW_NUM_COL_ID = '__cmx_row_no'
const AUDIT_COL_ID = '__cmx_audit_action'
const AUDIT_KEYS = [
  'created_at',
  'createdAt',
  'created_by',
  'createdBy',
  'updated_at',
  'updatedAt',
  'updated_by',
  'updatedBy',
  'created_info',
  'createdInfo',
  'updated_info',
  'updatedInfo',
  'rec_status',
  'recStatus',
  'rec_order',
  'recOrder',
  'rec_notes',
  'recNotes',
] as const

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

/**
 *
 */
export type CmxDataTablePaginationFooter = 'auto' | 'always' | 'never'

/**
 *
 */
export interface CmxDataTableAuditConfig<TData> {
  /**
   * `auto` enables the action when row objects expose known audit keys.
   * `true` forces the column on and uses either `getRecord` or the raw row.
   */
  enabled?: boolean | 'auto'
  /** Override row-to-record mapping when audit values live under nested fields. */
  getRecord?: (row: TData) => Record<string, unknown> | null
  /** Optional dialog title per row (for example "Voucher Audit"). */
  getTitle?: (row: TData) => string | undefined
  /** Optional row gate when some rows should not expose audit metadata. */
  isEnabled?: (row: TData) => boolean
  /** Override the button label shown in the audit action column. */
  actionLabel?: string
  /** Override the column header label for the audit action. */
  columnHeader?: ReactNode
}

/**
 *
 */
export interface CmxDataTableProps<TData> {
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
  /** Built-in audit action column that opens the shared audit metadata dialog. */
  auditConfig?: boolean | CmxDataTableAuditConfig<TData>
}

interface AuditDialogState<TData> {
  row: TData
  record: Record<string, unknown>
  title?: string
}

function isRecordLike(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function hasAuditFields(record: Record<string, unknown> | null): boolean {
  if (!record) {
    return false
  }

  return AUDIT_KEYS.some((key) => Object.prototype.hasOwnProperty.call(record, key))
}

function getDefaultAuditRecord<TData>(row: TData): Record<string, unknown> | null {
  return isRecordLike(row) ? row : null
}

function isAuditActorObject(value: unknown): value is Exclude<AuditActor, string> {
  return typeof value === 'object' && value !== null
}

function normalizeActorValue(value: unknown): AuditActor | null {
  if (value == null) {
    return null
  }

  if (typeof value === 'string') {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }

  if (!isAuditActorObject(value)) {
    return null
  }

  const actor = value as Record<string, unknown>
  return {
    id: typeof actor.id === 'string' ? actor.id : null,
    label: typeof actor.label === 'string' ? actor.label : null,
    displayName:
      typeof actor.displayName === 'string'
        ? actor.displayName
        : typeof actor.display_name === 'string'
          ? actor.display_name
          : null,
    email: typeof actor.email === 'string' ? actor.email : null,
    phone: typeof actor.phone === 'string' ? actor.phone : null,
  }
}

function collectAuditActorIds(record: Record<string, unknown>): string[] {
  const candidates = [record.created_by, record.createdBy, record.updated_by, record.updatedBy]

  return candidates.flatMap((candidate) => {
    const actor = normalizeActorValue(candidate)
    if (actor == null) {
      return []
    }

    if (typeof actor === 'string') {
      return [actor]
    }

    const hasResolvedIdentity =
      typeof actor.label === 'string' ||
      typeof actor.displayName === 'string' ||
      typeof actor.email === 'string'

    if (hasResolvedIdentity || !actor.id) {
      return []
    }

    return [actor.id]
  })
}

function withResolvedActorDetails(
  record: Record<string, unknown>,
  actorsById: Map<string, { displayName: string | null; email: string | null; phone: string | null }>,
): Record<string, unknown> {
  const nextRecord = { ...record }

  for (const key of ['created_by', 'createdBy', 'updated_by', 'updatedBy'] as const) {
    const actor = normalizeActorValue(nextRecord[key])

    if (actor == null) {
      continue
    }

    if (typeof actor === 'string') {
      const resolvedActor = actorsById.get(actor)
      if (!resolvedActor) {
        continue
      }

      nextRecord[key] = {
        id: actor,
        displayName: resolvedActor.displayName,
        email: resolvedActor.email,
        phone: resolvedActor.phone,
      } satisfies Exclude<AuditActor, string>
      continue
    }

    if (!actor.id || actor.displayName || actor.label || actor.email) {
      continue
    }

    const resolvedActor = actorsById.get(actor.id)
    if (!resolvedActor) {
      continue
    }

    nextRecord[key] = {
      ...actor,
      displayName: actor.displayName ?? resolvedActor.displayName,
      email: actor.email ?? resolvedActor.email,
      phone: actor.phone ?? resolvedActor.phone,
    } satisfies Exclude<AuditActor, string>
  }

  return nextRecord
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

/**
 *
 * @param root0
 * @param root0.columns
 * @param root0.data
 * @param root0.loading
 * @param root0.isLoading
 * @param root0.page
 * @param root0.currentPage
 * @param root0.pageSize
 * @param root0.total
 * @param root0.totalCount
 * @param root0.onPageChange
 * @param root0.onPageSizeChange
 * @param root0.sorting
 * @param root0.onSortingChange
 * @param root0.clientSideSorting
 * @param root0.emptyStateTitle
 * @param root0.emptyStateDescription
 * @param root0.emptyStateIcon
 * @param root0.emptyStateAction
 * @param root0.skeletonRows
 * @param root0.className
 * @param root0.enableZebraStriping
 * @param root0.emptyMessage
 * @param root0.scrollable
 * @param root0.scrollAreaClassName
 * @param root0.showRowNumbers
 * @param root0.rowNumberHeader
 * @param root0.rowNumberOffset
 * @param root0.paginationFooter
 * @param root0.getRowClassName
 * @param root0.auditConfig
 */
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
  auditConfig,
}: CmxDataTableProps<TData>) {
  const tCommon = useTranslations('common')
  const effectiveLoading = loading ?? isLoading ?? false
  const effectiveTotal = total ?? totalCount ?? 0
  // `currentPage` is 1-based (UI convention); TanStack expects 0-based.
  const effectivePageIndex = page ?? (currentPage != null ? currentPage - 1 : 0)
  const resolvedRowNumberOffset =
    rowNumberOffsetProp ?? effectivePageIndex * pageSize

  const [internalSorting, setInternalSorting] = useState<SortingState>(sorting ?? [])
  const [auditDialog, setAuditDialog] = useState<AuditDialogState<TData> | null>(null)
  const [, startAuditActorsTransition] = useTransition()
  const auditLookupRequestRef = useRef(0)

  const resolvedAuditConfig = useMemo<CmxDataTableAuditConfig<TData> | null>(() => {
    if (auditConfig === false) {
      return null
    }

    if (auditConfig === true) {
      return { enabled: true }
    }

    return {
      enabled: 'auto',
      ...(auditConfig ?? {}),
    }
  }, [auditConfig])

  const resolveAuditRecord = useCallback((row: TData): Record<string, unknown> | null => {
    const record = resolvedAuditConfig?.getRecord?.(row) ?? getDefaultAuditRecord(row)
    return isRecordLike(record) ? record : null
  }, [resolvedAuditConfig])

  const resolveAuditTitle = useCallback((row: TData): string | undefined => {
    return resolvedAuditConfig?.getTitle?.(row)
  }, [resolvedAuditConfig])

  const handleAuditOpen = useCallback((row: TData) => {
    const record = resolveAuditRecord(row)
    if (!record) {
      return
    }

    const title = resolveAuditTitle(row)
    setAuditDialog({ row, record, title })

    const actorIds = collectAuditActorIds(record)
    if (actorIds.length === 0) {
      return
    }

    const requestId = auditLookupRequestRef.current + 1
    auditLookupRequestRef.current = requestId

    startAuditActorsTransition(async () => {
      try {
        const params = new URLSearchParams()
        actorIds.forEach((actorId) => params.append('id', actorId))

        const response = await fetch(`/api/v1/audit/actors?${params.toString()}`)
        if (!response.ok) {
          return
        }

        const payload = (await response.json()) as {
          success?: boolean
          data?: Array<{ id: string; displayName: string | null; email: string | null; phone: string | null }>
        }

        if (!payload.success || !payload.data || auditLookupRequestRef.current !== requestId) {
          return
        }

        const actorsById = new Map(
          payload.data
            .filter((actor) => typeof actor.id === 'string')
            .map((actor) => [
              actor.id,
              {
                displayName: actor.displayName ?? null,
                email: actor.email ?? null,
                phone: actor.phone ?? null,
              },
            ]),
        )

        for (const actorId of actorIds) {
          if (!actorsById.has(actorId)) {
            actorsById.set(actorId, {
              displayName: tCommon('auditCard.missingActor'),
              email: null,
              phone: null,
            })
          }
        }

        if (actorsById.size === 0) {
          return
        }

        setAuditDialog((previous) => {
          if (!previous || previous.row !== row) {
            return previous
          }

          return {
            ...previous,
            record: withResolvedActorDetails(previous.record, actorsById),
          }
        })
      } catch {
        // Audit actor name resolution is progressive enhancement only.
      }
    })
  }, [resolveAuditRecord, resolveAuditTitle, tCommon])

  const canShowAuditForRow = useCallback((row: TData): boolean => {
    if (!resolvedAuditConfig) {
      return false
    }

    if (resolvedAuditConfig.isEnabled && !resolvedAuditConfig.isEnabled(row)) {
      return false
    }

    const record = resolveAuditRecord(row)
    if (resolvedAuditConfig.enabled === true) {
      return record !== null
    }

    return hasAuditFields(record)
  }, [resolveAuditRecord, resolvedAuditConfig])

  const showAuditColumn = useMemo(
    () => !!resolvedAuditConfig && data.some((row) => canShowAuditForRow(row)),
    [canShowAuditForRow, data, resolvedAuditConfig],
  )

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

    if (showAuditColumn) {
      mapped.push({
        id: AUDIT_COL_ID,
        enableSorting: false,
        header: () => (
          <span className="sr-only">
            {resolvedAuditConfig?.columnHeader ?? tCommon('auditCard.actionLabel')}
          </span>
        ),
        cell: ({ row }) => {
          const originalRow = row.original
          const rowCanShowAudit = canShowAuditForRow(originalRow)

          if (!rowCanShowAudit) {
            return null
          }

          const actionLabel = resolvedAuditConfig?.actionLabel ?? tCommon('auditCard.actionLabel')

          return (
            <div className="flex justify-end">
              <CmxButton
                type="button"
                variant="ghost"
                size="sm"
                title={actionLabel}
                aria-label={actionLabel}
                className="h-10 w-10 rounded-full px-0 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))] hover:bg-[rgb(var(--cmx-muted-rgb,241_245_249))]"
                onClick={() => handleAuditOpen(originalRow)}
              >
                <UserRound className="h-5 w-5" aria-hidden />
              </CmxButton>
            </div>
          )
        },
      } as ColumnDef<TData, unknown>)
    }

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
  }, [
    columns,
    showRowNumbers,
    rowNumberHeader,
    resolvedRowNumberOffset,
    showAuditColumn,
    canShowAuditForRow,
    resolvedAuditConfig?.actionLabel,
    resolvedAuditConfig?.columnHeader,
    tCommon,
  ])

  // TanStack Table is not React Compiler memoizable — see react-hooks/incompatible-library
  // eslint-disable-next-line react-hooks/incompatible-library -- @tanstack/react-table useReactTable
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
  const selectedAuditRecord = auditDialog?.record ?? null
  const auditDialogTitle = auditDialog?.title

  return (
    <>
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
                          header.column.id === AUDIT_COL_ID && 'w-14 text-right rtl:text-left',
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
                              cell.column.id === AUDIT_COL_ID && 'w-14 text-right rtl:text-left',
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

      {auditDialog && selectedAuditRecord && (
        <CmxDialog
          open
          onOpenChange={(open) => {
            if (!open) {
              auditLookupRequestRef.current += 1
              setAuditDialog(null)
            }
          }}
        >
          <CmxDialogContent className="max-w-2xl">
            <CmxDialogHeader>
              <CmxDialogTitle>
                {auditDialogTitle ?? tCommon('auditCard.actionLabel')}
              </CmxDialogTitle>
            </CmxDialogHeader>
            <div className="py-4">
              <CmxAuditInfoCard
                title={tCommon('auditCard.title')}
                record={selectedAuditRecord}
                defaultExpanded
                collapsibleExtras={false}
                className="shadow-none"
              />
            </div>
            <CmxDialogFooter>
              <CmxButton
                variant="outline"
                onClick={() => {
                  auditLookupRequestRef.current += 1
                  setAuditDialog(null)
                }}
              >
                {tCommon('close')}
              </CmxButton>
            </CmxDialogFooter>
          </CmxDialogContent>
        </CmxDialog>
      )}
    </>
  )
}
