/**
 * CmxFormActions - Form submit and cancel actions
 * @module ui/forms
 */

import type { ReactNode } from 'react'
import { CmxButton } from '../primitives/cmx-button'
import { cn } from '@/lib/utils'

interface CmxFormActionsProps {
  primaryLabel: string
  secondaryLabel?: string
  loading?: boolean
  onSecondaryClick?: () => void
  primary?: ReactNode
  secondary?: ReactNode
  tertiary?: ReactNode
  destructive?: ReactNode
  sticky?: boolean
  align?: 'start' | 'end' | 'between'
  mobileStack?: boolean
  isDirty?: boolean
  dirtyLabel?: string
  className?: string
}

/**
 * Action bar scales from single-column mobile submits to richer desktop footers
 * so long operational forms retain a strong primary CTA without sacrificing safety.
 *
 * @param root0 Action bar props.
 * @param root0.primaryLabel Primary submit label when a custom node is not supplied.
 * @param root0.secondaryLabel Secondary action label when a custom node is not supplied.
 * @param root0.loading Whether the primary action is pending.
 * @param root0.onSecondaryClick Optional click handler for the stock secondary action.
 * @param root0.primary Custom primary action node.
 * @param root0.secondary Custom secondary action node.
 * @param root0.tertiary Optional tertiary action content.
 * @param root0.destructive Optional destructive action content.
 * @param root0.sticky Whether the action bar sticks to the viewport bottom.
 * @param root0.align Desktop alignment strategy for the action row.
 * @param root0.mobileStack Whether actions stack on smaller viewports.
 * @param root0.isDirty Whether the form currently has unsaved changes.
 * @param root0.dirtyLabel Optional dirty-state badge text.
 * @param root0.className Optional wrapper className.
 * @returns Responsive form action bar.
 */
export function CmxFormActions({
  primaryLabel,
  secondaryLabel,
  loading,
  onSecondaryClick,
  primary,
  secondary,
  tertiary,
  destructive,
  sticky = false,
  align = 'end',
  mobileStack = true,
  isDirty = false,
  dirtyLabel,
  className,
}: CmxFormActionsProps) {
  const alignmentClass = {
    start: 'justify-start',
    end: 'justify-end',
    between: 'justify-between',
  }[align]

  return (
    <div
      className={cn(
        'rounded-[var(--cmx-radius-lg,1.125rem)] border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgba(255,255,255,0.94)] p-4 shadow-[var(--cmx-shadow-sm,0_8px_24px_rgba(15,23,42,0.06))] backdrop-blur-sm',
        sticky && 'sticky bottom-0 z-10',
        className
      )}
    >
      <div
        className={cn(
          'flex gap-3',
          mobileStack ? 'flex-col md:flex-row md:items-center' : 'flex-wrap items-center',
          alignmentClass
        )}
      >
        {(isDirty && dirtyLabel) || tertiary || (align === 'between' && (secondary || secondaryLabel || destructive)) ? (
          <div className="flex flex-1 flex-wrap items-center gap-2">
            {isDirty && dirtyLabel ? (
              <span className="cmx-type-field-helper rounded-full bg-[rgb(var(--cmx-warning-bg-rgb,255_251_235))] px-3 py-1 text-[rgb(var(--cmx-warning-darker-rgb,146_64_14))]">
                {dirtyLabel}
              </span>
            ) : null}
            {tertiary}
          </div>
        ) : null}

        <div className={cn('flex flex-col gap-3 md:flex-row', mobileStack && 'w-full md:w-auto')}>
          {destructive}
          {secondary ?? (
            secondaryLabel ? (
              <CmxButton type="button" variant="ghost" onClick={onSecondaryClick} className={cn(mobileStack && 'w-full md:w-auto')}>
                {secondaryLabel}
              </CmxButton>
            ) : null
          )}
          {primary ?? (
            <CmxButton type="submit" loading={loading} className={cn(mobileStack && 'w-full md:w-auto')}>
              {primaryLabel}
            </CmxButton>
          )}
        </div>
      </div>
    </div>
  )
}
