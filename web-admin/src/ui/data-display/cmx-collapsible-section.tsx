/**
 * CmxCollapsibleSection - an accessible disclosure row (title, trailing slot, body).
 *
 * A button carries `aria-expanded` / `aria-controls`; Enter and Space toggle it
 * (native button). The chevron points to the reading direction and turns down
 * when open, mirrored in RTL. Motion respects `prefers-reduced-motion`.
 * Controlled (`open` + `onOpenChange`) or uncontrolled (`defaultOpen`).
 * `collapsible={false}` renders a static header with the body always shown.
 * @module ui/data-display
 */

'use client'

import * as React from 'react'
import { ChevronRight } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CmxCollapsibleSectionProps {
  /** Header content (title, count, chips). */
  title: React.ReactNode
  /** End-aligned header content, for example an amount. */
  trailing?: React.ReactNode
  /** Body; rendered only while open. */
  children?: React.ReactNode
  /** Controlled open state. */
  open?: boolean
  /** Initial state when uncontrolled. */
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  /** False: no toggle, the body is always shown. */
  collapsible?: boolean
  className?: string
  headerClassName?: string
  bodyClassName?: string
}

/**
 * Disclosure row used by statements, settings groups and detail panels.
 * @param props - {@link CmxCollapsibleSectionProps}
 */
export function CmxCollapsibleSection({
  title,
  trailing,
  children,
  open,
  defaultOpen = false,
  onOpenChange,
  collapsible = true,
  className,
  headerClassName,
  bodyClassName,
}: CmxCollapsibleSectionProps) {
  const [inner, setInner] = React.useState(defaultOpen)
  const isOpen = !collapsible || (open ?? inner)
  const bodyId = React.useId()

  const toggle = () => {
    const next = !isOpen
    if (open === undefined) setInner(next)
    onOpenChange?.(next)
  }

  const header = (
    <>
      {collapsible && (
        <ChevronRight
          aria-hidden="true"
          className={cn(
            'h-4 w-4 shrink-0 text-[rgb(var(--cmx-muted-foreground-rgb))] motion-safe:transition-transform rtl:-scale-x-100',
            isOpen && 'rotate-90 rtl:-rotate-90',
          )}
        />
      )}
      <span className="min-w-0 flex-1 text-start">{title}</span>
      {trailing != null && <span className="shrink-0 text-end">{trailing}</span>}
    </>
  )

  return (
    <div className={className}>
      {collapsible ? (
        <button
          type="button"
          aria-expanded={isOpen}
          aria-controls={bodyId}
          onClick={toggle}
          className={cn(
            'flex w-full min-h-11 items-center gap-2 rounded-md px-2 py-1.5 text-sm',
            'hover:bg-[rgb(var(--cmx-ghost-hover-bg-rgb))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--cmx-focus-ring-rgb))]',
            headerClassName,
          )}
        >
          {header}
        </button>
      ) : (
        <div className={cn('flex w-full min-h-11 items-center gap-2 px-2 py-1.5 text-sm', headerClassName)}>{header}</div>
      )}
      {isOpen && children != null && (
        <div id={bodyId} className={cn('ps-8 pe-2 pb-2', bodyClassName)}>
          {children}
        </div>
      )}
    </div>
  )
}
