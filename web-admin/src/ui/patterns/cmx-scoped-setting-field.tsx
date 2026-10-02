/**
 * CmxScopedSettingField - A setting row that shows where its effective value
 * comes from (inherited vs overridden here) with a reset-to-inherited action.
 *
 * Presentation only (CLF-8-2, plan §4B.10): the caller owns the control
 * (switch, select, input …), the source resolution and all localized text, so
 * this stays domain- and i18n-free and works for any scoped-settings cascade.
 *
 * @module ui/patterns
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { Badge } from '@ui/primitives/badge'
import { CmxButton } from '@ui/primitives'

export interface CmxScopedSettingFieldProps {
  label: string
  description?: string
  /** Localized source text, e.g. "Inherited from Organization" / "Overridden here". */
  sourceLabel: string
  /** True when the value is set at the current scope (shows reset action). */
  isOverridden: boolean
  /** The editable control — rendered at the end of the row. */
  children: React.ReactNode
  /** Clears the override at the current scope. Omit to hide the reset action. */
  onReset?: () => void
  resetLabel?: string
  /** Disables the reset action (e.g. while saving or without permission). */
  disabled?: boolean
  className?: string
}

/**
 * Renders one scoped setting row.
 *
 * @param props - {@link CmxScopedSettingFieldProps}.
 */
export function CmxScopedSettingField({
  label,
  description,
  sourceLabel,
  isOverridden,
  children,
  onReset,
  resetLabel,
  disabled,
  className,
}: CmxScopedSettingFieldProps) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-[rgb(var(--cmx-border-rgb,226_232_240))] p-4 sm:flex-row sm:items-center sm:justify-between',
        className
      )}
    >
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">{label}</span>
          <Badge variant={isOverridden ? 'default' : 'outline'}>{sourceLabel}</Badge>
        </div>
        {description ? (
          <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{description}</p>
        ) : null}
      </div>
      <div className="flex shrink-0 items-center gap-3">
        {children}
        {isOverridden && onReset ? (
          <CmxButton variant="ghost" size="sm" onClick={onReset} disabled={disabled}>
            {resetLabel}
          </CmxButton>
        ) : null}
      </div>
    </div>
  )
}
