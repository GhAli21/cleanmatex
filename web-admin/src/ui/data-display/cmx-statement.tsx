/**
 * Statement primitives (D36, PR-01): a money statement that reads top-down
 * like an accountant's — groups of rows, each row expanding in place to its
 * lines. Generic: no order types and no translations; the caller passes
 * labels and formatted amounts (`CmxMoneyText`).
 *
 * - `CmxStatement`         the container (draft outline, print mode, density)
 * - `CmxStatementGroup`    a titled group with an optional closing total row
 * - `CmxStatementRow`      one row in one of four visible modes:
 *                          `total` (amount only), `expandable` (closed),
 *                          `expanded` (open, can close), `detail` (always open)
 * - `CmxStatementLine`     one detail line: label, meta, chip, amount; struck when
 *                          not counted; informational text and was → now in the text
 * - `CmxStatementLineList` caps the lines (`Show all (n)` / `Show less`)
 * @module ui/data-display
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { CmxCollapsibleSection } from './cmx-collapsible-section'

/** The visible row modes (`hidden` rows are simply not rendered). */
export type CmxStatementRowMode = 'total' | 'expandable' | 'expanded' | 'detail'

// ─── Container ────────────────────────────────────────────────────────────

export interface CmxStatementProps extends React.HTMLAttributes<HTMLElement> {
  /** Draft: a dashed outline marks figures that are not saved. */
  draft?: boolean
  /** Print: black and white, every row open, no toggles. */
  print?: boolean
  density?: 'comfortable' | 'compact'
}

/**
 * Statement container; `aria-label` names it for assistive tech.
 * @param props - {@link CmxStatementProps}
 */
export function CmxStatement({ draft, print, density = 'comfortable', className, children, ...rest }: CmxStatementProps) {
  return (
    <section
      {...rest}
      data-print={print || undefined}
      className={cn(
        'flex flex-col',
        density === 'compact' ? 'gap-2 text-sm' : 'gap-4',
        draft && 'rounded-lg border border-dashed border-[rgb(var(--cmx-border-rgb))] p-3',
        print && 'text-black print:text-black',
        className,
      )}
    >
      {children}
    </section>
  )
}

// ─── Group ────────────────────────────────────────────────────────────────

export interface CmxStatementGroupProps {
  title?: React.ReactNode
  /** Closing row of the group, for example "Total 11.475" or "Due at collection 2.475". */
  footer?: { label: React.ReactNode; amount: React.ReactNode; emphasis?: boolean }
  children?: React.ReactNode
  className?: string
}

/**
 * A titled block of rows with an optional closing total.
 * @param props - {@link CmxStatementGroupProps}
 */
export function CmxStatementGroup({ title, footer, children, className }: CmxStatementGroupProps) {
  const headingId = React.useId()
  return (
    <div role="group" aria-labelledby={title ? headingId : undefined} className={cn('flex flex-col', className)}>
      {title && (
        <h3 id={headingId} className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb))]">
          {title}
        </h3>
      )}
      <div className="flex flex-col">{children}</div>
      {footer && (
        <div className={cn('mt-1 flex min-h-11 items-center gap-2 border-t border-[rgb(var(--cmx-border-rgb))] px-2 pt-2 ps-8', footer.emphasis && 'font-semibold')}>
          <span className="flex-1 text-start">{footer.label}</span>
          <span className="text-end">{footer.amount}</span>
        </div>
      )}
    </div>
  )
}

// ─── Row ──────────────────────────────────────────────────────────────────

export interface CmxStatementRowProps {
  title: React.ReactNode
  /** Number of lines, shown as "(n)". */
  count?: number
  /** State chips ("1 pending", "1 voided"): text plus icon, never color alone. */
  chips?: React.ReactNode
  /** End-aligned amount (formatted). */
  amount?: React.ReactNode
  mode: CmxStatementRowMode
  /** Controlled open state (expand all / collapse all); ignored in `total` and `detail`. */
  open?: boolean
  onOpenChange?: (open: boolean) => void
  /** Replaces the lines, for example an error with Retry or a muted "None". */
  status?: React.ReactNode
  /** Inline warning marker shown after the title. */
  marker?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

/**
 * One statement row in one of the visible modes.
 * @param props - {@link CmxStatementRowProps}
 */
export function CmxStatementRow({ title, count, chips, amount, mode, open, onOpenChange, status, marker, children, className }: CmxStatementRowProps) {
  const heading = (
    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-1">
      <span>{title}{count != null && <span className="text-[rgb(var(--cmx-muted-foreground-rgb))]"> ({count})</span>}</span>
      {marker}
      {chips}
    </span>
  )
  const body = status ?? children
  if (mode === 'total' || body == null) {
    return (
      <div className={cn('flex min-h-11 items-center gap-2 px-2 py-1.5 ps-8 text-sm', className)}>
        <span className="min-w-0 flex-1 text-start">{heading}</span>
        {amount != null && <span className="shrink-0 text-end">{amount}</span>}
      </div>
    )
  }
  return (
    <CmxCollapsibleSection
      className={className}
      title={heading}
      trailing={amount}
      collapsible={mode !== 'detail'}
      defaultOpen={mode === 'expanded'}
      open={mode === 'detail' ? true : open}
      onOpenChange={onOpenChange}
    >
      {body}
    </CmxCollapsibleSection>
  )
}

// ─── Lines ────────────────────────────────────────────────────────────────

export interface CmxStatementLineProps {
  label: React.ReactNode
  /** Method, date, short reference. */
  meta?: React.ReactNode
  chip?: React.ReactNode
  /** End-aligned amount; only for lines that belong to the section's sum. */
  amount?: React.ReactNode
  /** Informational text (document totals, points, was → now): in the text, never the amount column. */
  note?: React.ReactNode
  /** Shown but not counted: struck and muted. */
  struck?: boolean
  muted?: boolean
  className?: string
}

/**
 * One detail line of a statement row.
 * @param props - {@link CmxStatementLineProps}
 */
export function CmxStatementLine({ label, meta, chip, amount, note, struck, muted, className }: CmxStatementLineProps) {
  return (
    <li className={cn('flex min-h-9 items-start gap-2 py-1 text-sm', (struck || muted) && 'text-[rgb(var(--cmx-muted-foreground-rgb))]', className)}>
      <span className="min-w-0 flex-1 text-start">
        <span className={cn(struck && 'line-through')}>{label}</span>
        {meta && <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb))]"> · {meta}</span>}
        {chip && <span className="ms-2 inline-flex align-middle">{chip}</span>}
        {note && <span className="block text-xs text-[rgb(var(--cmx-muted-foreground-rgb))]">{note}</span>}
      </span>
      {amount != null && <span className="shrink-0 text-end">{amount}</span>}
    </li>
  )
}

export interface CmxStatementLineListProps {
  children: React.ReactNode
  /** Lines shown before "Show all"; omit or 0 for no cap (audit, print). */
  cap?: number
  showAllLabel?: (total: number) => string
  showLessLabel?: string
}

/**
 * The lines of a row, capped with Show all / Show less.
 * @param props - {@link CmxStatementLineListProps}
 */
export function CmxStatementLineList({ children, cap, showAllLabel, showLessLabel }: CmxStatementLineListProps) {
  const items = React.Children.toArray(children)
  const [all, setAll] = React.useState(false)
  const capped = cap && cap > 0 && items.length > cap && !all
  return (
    <>
      <ul className="flex flex-col">{capped ? items.slice(0, cap) : items}</ul>
      {cap && cap > 0 && items.length > cap && showAllLabel && showLessLabel && (
        <button
          type="button"
          onClick={() => setAll((v) => !v)}
          className="mt-1 min-h-9 self-start rounded px-1 text-xs font-medium text-[rgb(var(--cmx-primary-rgb))] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--cmx-focus-ring-rgb))]"
        >
          {all ? showLessLabel : showAllLabel(items.length)}
        </button>
      )}
    </>
  )
}
