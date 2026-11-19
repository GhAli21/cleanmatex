/**
 * CmxCrudPageShell - the canonical dashboard workspace frame (PR-05).
 * Order: breadcrumb -> page title + primary actions -> KPI strip -> filters -> content (the table).
 * Every slot but `children` is optional. No hooks, so server pages can use it; logical classes only.
 * @module ui/patterns
 */

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Props of {@link CmxCrudPageShell}. */
export interface CmxCrudPageShellProps {
  /** Page heading (rendered as the page's h1). */
  title?: ReactNode
  subtitle?: ReactNode
  /** Breadcrumb trail, rendered above the title. */
  breadcrumb?: ReactNode
  /** Primary call to action and other page actions, at the end of the title row. */
  actions?: ReactNode
  /** KPI cards strip. */
  kpis?: ReactNode
  /** Filter bar, framed as one surface. */
  filters?: ReactNode
  /** The page content, normally the data table. */
  children: ReactNode
  className?: string
}

/**
 * Workspace frame for list and CRUD pages.
 * @param props See {@link CmxCrudPageShellProps}.
 */
export function CmxCrudPageShell({ title, subtitle, breadcrumb, actions, kpis, filters, children, className }: CmxCrudPageShellProps) {
  return (
    <div className={cn('space-y-6', className)}>
      {breadcrumb}
      {(title || actions) && (
        <header className="flex flex-wrap items-start justify-between gap-4">
          {title && (
            <div className="min-w-0">
              <h1 className="cmx-type-page-title">{title}</h1>
              {subtitle && <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>}
            </div>
          )}
          {actions && <div className="flex flex-wrap items-center gap-3">{actions}</div>}
        </header>
      )}
      {kpis}
      {filters && <div className="rounded-lg border border-border bg-card p-3 md:p-4">{filters}</div>}
      {children}
    </div>
  )
}
