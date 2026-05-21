/* eslint-disable jsdoc/require-jsdoc */
/**
 * CmxSkeleton - Loading skeleton component
 * @module ui/primitives
 */

import { cn } from '@/lib/utils'

interface CmxSkeletonProps {
  className?: string
}

export function CmxSkeleton({ className }: CmxSkeletonProps) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-[rgb(var(--cmx-muted-rgb,241_245_249))]',
        className
      )}
    />
  )
}

interface CmxSkeletonTableProps {
  rows?: number
  columns?: number
  showHeader?: boolean
}

export function CmxSkeletonTable({
  rows = 5,
  columns = 4,
  showHeader = true
}: CmxSkeletonTableProps) {
  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]">
        <table className="min-w-full">
          {showHeader && (
            <thead className="bg-[rgb(var(--cmx-table-header-bg-rgb,248_250_252))]">
              <tr>
                {Array.from({ length: columns }).map((_, i) => (
                  <th key={i} className="px-3 py-2">
                    <CmxSkeleton className="h-4 w-20" />
                  </th>
                ))}
              </tr>
            </thead>
          )}
          <tbody>
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex} className="border-t border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))]">
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="px-3 py-2">
                    <CmxSkeleton className="h-4 w-full max-w-32" />
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
