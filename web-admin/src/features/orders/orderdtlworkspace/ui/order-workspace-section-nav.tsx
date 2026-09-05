import { Activity, CircleDollarSign, ClipboardList, ListChecks, UserRound, Workflow } from 'lucide-react'

import { cn } from '@lib/utils'
import { CmxButton } from '@ui/primitives/cmx-button'

import type { OrderWorkspaceSectionId } from './order-workspace-types'

/**
 * Props for the workspace section navigator.
 *
 * Labels and counts are supplied by the tenant-scoped workspace shell so this
 * navigation primitive does not become a second source of order data.
 */
interface OrderWorkspaceSectionNavProps {
  activeSection: OrderWorkspaceSectionId
  onChange: (section: OrderWorkspaceSectionId) => void
  labels: Record<OrderWorkspaceSectionId, string>
  counts?: Partial<Record<OrderWorkspaceSectionId, number>>
}

const sectionIcons = {
  overview: Workflow,
  work: ClipboardList,
  customer: UserRound,
  financials: CircleDollarSign,
  activity: Activity,
  actions: ListChecks,
} as const

/** Keeps high-frequency workspace sections discoverable on every viewport. */
export function OrderWorkspaceSectionNav({ activeSection, onChange, labels, counts }: OrderWorkspaceSectionNavProps) {
  const sections: OrderWorkspaceSectionId[] = ['overview', 'work', 'customer', 'financials', 'activity', 'actions']

  return (
    <nav aria-label="Order workspace sections" className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex min-w-max gap-1 rounded-lg bg-[rgb(var(--cmx-muted-rgb,248_250_252))] p-1" role="tablist">
        {sections.map((section) => {
          const Icon = sectionIcons[section]
          const selected = activeSection === section
          const count = counts?.[section]
          return (
            <CmxButton
              key={section}
              type="button"
              role="tab"
              aria-selected={selected}
              variant={selected ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => onChange(section)}
              className={cn('gap-1.5 whitespace-nowrap', selected && 'shadow-sm')}
            >
              <Icon aria-hidden="true" className="h-4 w-4" />
              <span>{labels[section]}</span>
              {typeof count === 'number' ? <span className="rounded-full bg-[rgb(var(--cmx-background-rgb,255_255_255))] px-1.5 text-[10px]">{count}</span> : null}
            </CmxButton>
          )
        })}
      </div>
    </nav>
  )
}
