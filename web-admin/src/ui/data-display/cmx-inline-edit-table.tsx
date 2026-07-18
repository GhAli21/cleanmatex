/**
 * CmxInlineEditTable — compact semantic table for interactive cells
 * (inputs, checkboxes, badges) inside dialogs and small editors.
 *
 * Prefer this over CmxDataTable when you do not need pagination, sort,
 * audit columns, or server-list chrome. Prefer CmxEditableDataTable when
 * you need row insert/delete/bulk-save lifecycle.
 *
 * @module ui/data-display
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { CmxSkeleton } from '../primitives/cmx-skeleton'
import { CmxEmptyState } from './cmx-empty-state'

/**
 * Column definition for an inline-edit table.
 */
export interface CmxInlineEditTableColumn<TData> {
  /** Stable column id (used as React key). */
  key: string
  /** Header label or node. */
  header: React.ReactNode
  /** Cell renderer — return interactive Cmx controls as needed. */
  cell: (row: TData, index: number) => React.ReactNode
  /** Optional width (CSS length or %). Prefer % with tableLayout=fixed. */
  width?: string
  /** Cell alignment. */
  align?: 'start' | 'center' | 'end'
  /** When true, column collapses on very small screens. */
  hideOnMobile?: boolean
}

/**
 * Props for {@link CmxInlineEditTable}.
 */
export interface CmxInlineEditTableProps<TData> {
  columns: CmxInlineEditTableColumn<TData>[]
  data: TData[]
  /** Stable row id for React keys and a11y. */
  getRowId: (row: TData) => string
  loading?: boolean
  /** Skeleton row count while loading. */
  skeletonRows?: number
  emptyTitle?: string
  emptyDescription?: string
  emptyAction?: React.ReactNode
  getRowClassName?: (row: TData, index: number) => string | undefined
  className?: string
  /** Scroll container max-height class. */
  maxHeightClassName?: string
  /** Accessible table caption (visually hidden unless `showCaption`). */
  caption?: string
  showCaption?: boolean
  density?: 'compact' | 'comfortable'
  zebra?: boolean
  /**
   * Fixed layout keeps column widths stable so checkbox columns stay narrow
   * and inputs do not push Ready/Split far apart.
   */
  tableLayout?: 'auto' | 'fixed'
  /** Vertical cell alignment — use `top` when a cell wraps (e.g. preference chips). */
  cellVerticalAlign?: 'middle' | 'top'
}

const alignClass: Record<'start' | 'center' | 'end', string> = {
  start: 'text-start',
  center: 'text-center',
  end: 'text-end',
}

/**
 * Compact editable table for dialog checklists and small inline editors.
 */
export function CmxInlineEditTable<TData>({
  columns,
  data,
  getRowId,
  loading = false,
  skeletonRows = 4,
  emptyTitle,
  emptyDescription,
  emptyAction,
  getRowClassName,
  className,
  maxHeightClassName = 'max-h-[min(50vh,28rem)]',
  caption,
  showCaption = false,
  density = 'compact',
  zebra = true,
  tableLayout = 'fixed',
  cellVerticalAlign = 'middle',
}: CmxInlineEditTableProps<TData>) {
  const cellPad = density === 'compact' ? 'px-3 py-2' : 'px-4 py-3'
  const vAlign =
    cellVerticalAlign === 'top' ? 'align-top' : 'align-middle'

  if (!loading && data.length === 0 && (emptyTitle || emptyDescription)) {
    return (
      <CmxEmptyState
        title={emptyTitle ?? ''}
        description={emptyDescription}
        action={emptyAction}
      />
    )
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-[var(--cmx-radius-md,0.375rem)] border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-card-bg-rgb,255_255_255))] shadow-sm',
        className
      )}
    >
      <div className={cn('overflow-auto', maxHeightClassName)}>
        <table
          className={cn(
            'w-full border-collapse text-sm',
            tableLayout === 'fixed' ? 'table-fixed' : 'min-w-full'
          )}
        >
          {caption ? (
            <caption
              className={cn(
                showCaption
                  ? 'px-3 py-2 text-start text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]'
                  : 'sr-only'
              )}
            >
              {caption}
            </caption>
          ) : null}
          <thead className="sticky top-0 z-[1] bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))] shadow-[0_1px_0_0_rgb(var(--cmx-border-subtle-rgb,226_232_240))]">
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  scope="col"
                  style={col.width ? { width: col.width } : undefined}
                  className={cn(
                    cellPad,
                    'whitespace-nowrap text-[11px] font-semibold uppercase tracking-[0.04em] text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]',
                    alignClass[col.align ?? 'start'],
                    col.hideOnMobile && 'hidden sm:table-cell'
                  )}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: skeletonRows }).map((_, rowIndex) => (
                  <tr
                    key={`sk-${rowIndex}`}
                    className="border-t border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]"
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          cellPad,
                          col.hideOnMobile && 'hidden sm:table-cell'
                        )}
                      >
                        <CmxSkeleton className="h-8 w-full" />
                      </td>
                    ))}
                  </tr>
                ))
              : data.map((row, index) => (
                  <tr
                    key={getRowId(row)}
                    className={cn(
                      'border-t border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] transition-colors hover:bg-[rgb(var(--cmx-table-row-hover-bg-rgb,248_250_252))]',
                      zebra &&
                        index % 2 === 1 &&
                        'bg-[rgb(var(--cmx-muted-rgb,241_245_249)/0.4)]',
                      getRowClassName?.(row, index)
                    )}
                  >
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        style={col.width ? { width: col.width } : undefined}
                        className={cn(
                          cellPad,
                          vAlign,
                          alignClass[col.align ?? 'start'],
                          col.hideOnMobile && 'hidden sm:table-cell'
                        )}
                      >
                        {col.cell(row, index)}
                      </td>
                    ))}
                  </tr>
                ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
