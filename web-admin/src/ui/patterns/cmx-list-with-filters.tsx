/**
 * CmxListWithFilters - List view with filters pattern
 * @module ui/patterns
 */

import { ReactNode } from 'react'

interface CmxListWithFiltersProps {
  title: string
  subtitle?: string
  toolbar?: ReactNode
  filters?: ReactNode
  table: ReactNode
}

export function CmxListWithFilters({
  title,
  subtitle,
  toolbar,
  filters,
  table,
}: CmxListWithFiltersProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">{title}</h2>
          {subtitle && (
            <p className="text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
              {subtitle}
            </p>
          )}
        </div>
        {toolbar && <div>{toolbar}</div>}
      </div>
      {filters && (
        <div className="rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-card-bg-rgb,255_255_255))] p-3 md:p-4">
          {filters}
        </div>
      )}
      {table}
    </div>
  )
}
