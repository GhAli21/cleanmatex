/**
 * CmxEmptyState - Empty state placeholder
 * @module ui/data-display
 */

import { ReactNode } from 'react'
import { CmxCard, CmxCardContent } from '../primitives/cmx-card'

interface CmxEmptyStateProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

export function CmxEmptyState({
  icon,
  title,
  description,
  action,
}: CmxEmptyStateProps) {
  return (
    <CmxCard>
      <CmxCardContent className="py-12 text-center">
        {icon && <div className="mx-auto mb-4">{icon}</div>}
        <h3 className="text-lg font-semibold mb-2">{title}</h3>
        {description && (
          <p className="text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
            {description}
          </p>
        )}
        {action && <div className="mt-4">{action}</div>}
      </CmxCardContent>
    </CmxCard>
  )
}
