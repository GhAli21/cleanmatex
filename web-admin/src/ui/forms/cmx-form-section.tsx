/**
 * CmxFormSection - Visual section grouping for forms
 * @module ui/forms
 */

'use client'

import { useState, type ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface CmxFormSectionProps {
  title: ReactNode
  description?: ReactNode
  children: ReactNode
  layout?: 'single' | 'twoColumn' | 'autoFit'
  collapsible?: boolean
  defaultCollapsed?: boolean
  status?: 'default' | 'complete' | 'warning' | 'danger'
  badge?: ReactNode
  aside?: ReactNode
  className?: string
  contentClassName?: string
}

/**
 * Section creates a richer surface hierarchy so complex forms stay scannable
 * across full pages, modals, and narrow operational drawers.
 *
 * @param root0 Section props.
 * @param root0.title Section title content.
 * @param root0.description Optional section description.
 * @param root0.children Section body content.
 * @param root0.layout Field layout strategy inside the section.
 * @param root0.collapsible Whether the section can be collapsed.
 * @param root0.defaultCollapsed Initial collapsed state.
 * @param root0.status Accent state used by the section header bar.
 * @param root0.badge Optional badge rendered beside the title.
 * @param root0.aside Optional supporting content rendered in a side panel.
 * @param root0.className Optional outer className.
 * @param root0.contentClassName Optional className for the section body grid.
 * @returns Styled section shell for grouped form content.
 */
export function CmxFormSection({
  title,
  description,
  children,
  layout = 'single',
  collapsible = false,
  defaultCollapsed = false,
  status = 'default',
  badge,
  aside,
  className,
  contentClassName,
}: CmxFormSectionProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed)

  const statusAccentClass = {
    default: 'from-[rgba(37,99,235,0.15)] via-transparent to-transparent',
    complete: 'from-[rgba(22,163,74,0.16)] via-transparent to-transparent',
    warning: 'from-[rgba(217,119,6,0.16)] via-transparent to-transparent',
    danger: 'from-[rgba(220,38,38,0.16)] via-transparent to-transparent',
  }[status]

  const layoutClass = {
    single: 'space-y-4',
    twoColumn: 'grid gap-4 md:grid-cols-2',
    autoFit: 'grid gap-4 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))]',
  }[layout]

  return (
    <section
      className={cn(
        'overflow-hidden rounded-[var(--cmx-radius-lg,1.125rem)] border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-surface-rgb,255_255_255))] shadow-[var(--cmx-shadow-sm,0_8px_24px_rgba(15,23,42,0.06))]',
        className
      )}
    >
      <div className={cn('h-1 w-full bg-gradient-to-r', statusAccentClass)} />
      <div className={cn('grid gap-5 p-5 md:p-6', aside && 'xl:grid-cols-[minmax(0,1fr)_minmax(0,16rem)]')}>
        <div className="space-y-5">
          <header className="flex items-start justify-between gap-4 border-b border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] pb-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="cmx-type-section-title text-[rgb(var(--cmx-text-primary-rgb,15_23_42))]">
                  {title}
                </h2>
                {badge ? <div className="shrink-0">{badge}</div> : null}
              </div>
              {description ? (
                <p className="mt-2 max-w-3xl text-sm text-[rgb(var(--cmx-text-secondary-rgb,51_65_85))]">
                  {description}
                </p>
              ) : null}
            </div>
            {collapsible ? (
              <button
                type="button"
                onClick={() => setCollapsed((current) => !current)}
                className="inline-flex h-11 w-11 items-center justify-center rounded-[var(--cmx-radius-md,0.875rem)] border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-surface-muted-rgb,236_242_248))] text-[rgb(var(--cmx-text-secondary-rgb,51_65_85))] transition hover:bg-[rgb(var(--cmx-secondary-bg-rgb,239_246_255))] focus:outline-none focus:ring-2 focus:ring-[rgb(var(--cmx-focus-ring-rgb,59_130_246))]/30"
                aria-expanded={!collapsed}
                aria-label="Toggle section"
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', collapsed && '-rotate-90')} />
              </button>
            ) : null}
          </header>
          {!collapsed ? (
            <div className={cn(layoutClass, contentClassName)}>
              {children}
            </div>
          ) : null}
        </div>
        {aside ? (
          <aside className={cn('rounded-[var(--cmx-radius-md,0.875rem)] border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-surface-muted-rgb,236_242_248))] p-4')}>
            {aside}
          </aside>
        ) : null}
      </div>
    </section>
  )
}
