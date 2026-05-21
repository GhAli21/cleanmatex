/**
 * CmxFieldShell - Shared label, helper, and error chrome for form controls.
 * Separating the shell from the leaf control keeps custom inputs composable
 * while still giving forms one premium hierarchy and spacing system.
 * @module ui/forms
 */

'use client'

import type { ReactNode } from 'react'
import { cn } from '@/lib/utils'

/** Layout variants supported by the shared field shell. */
export type CmxFieldLayout = 'stacked' | 'inline' | 'compact'
/** Tone variants supported by the shared field shell. */
export type CmxFieldTone = 'default' | 'muted'

/** Props accepted by the shared field shell wrapper. */
export interface CmxFieldShellProps {
  id?: string
  name?: string
  label?: ReactNode
  description?: ReactNode
  hint?: ReactNode
  error?: ReactNode
  required?: boolean
  optionalLabel?: ReactNode
  labelAction?: ReactNode
  counter?: ReactNode
  layout?: CmxFieldLayout
  tone?: CmxFieldTone
  className?: string
  children: ReactNode
}

/**
 * Shared shell keeps labels, meta copy, and validation messaging aligned
 * across pages, dialogs, and drawers without forcing children into one input API.
 *
 * @param root0 Shared field chrome props.
 * @param root0.id Stable input id used by label and helper text.
 * @param root0.name Field name used for focus recovery hooks.
 * @param root0.label Visible field label.
 * @param root0.description Optional contextual copy shown under the label.
 * @param root0.hint Optional helper text shown when the field is not invalid.
 * @param root0.error Validation copy shown when the field is invalid.
 * @param root0.required Whether the field is mandatory.
 * @param root0.optionalLabel Optional badge-like text for non-required fields.
 * @param root0.labelAction Optional action rendered beside the label.
 * @param root0.counter Optional trailing counter or meta text.
 * @param root0.layout Field shell layout variant.
 * @param root0.tone Visual emphasis variant for label and helper text.
 * @param root0.className Optional container className.
 * @param root0.children Field control content.
 * @returns Shared field shell markup.
 */
export function CmxFieldShell({
  id,
  name,
  label,
  description,
  hint,
  error,
  required,
  optionalLabel,
  labelAction,
  counter,
  layout = 'stacked',
  tone = 'default',
  className,
  children,
}: CmxFieldShellProps) {
  const descriptionId = description ? `${id}-desc` : undefined
  const helperId = hint && !error ? `${id}-hint` : undefined
  const errorId = error ? `${id}-error` : undefined
  const footerId = errorId ?? helperId

  return (
    <div
      className={cn(
        'space-y-2',
        layout === 'compact' && 'space-y-1.5',
        layout === 'inline' &&
          'space-y-3 md:grid md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] md:items-start md:gap-4 md:space-y-0',
        className
      )}
      data-cmx-field-name={name}
      data-cmx-tone={tone}
      data-cmx-layout={layout}
      data-cmx-invalid={error ? '' : undefined}
    >
      {(label || description) && (
        <div className={cn(layout === 'inline' && 'md:pt-2')}>
          {label && (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label
                htmlFor={id}
                className={cn(
                  'cmx-type-field-label text-[rgb(var(--cmx-text-primary-rgb,15_23_42))]',
                  tone === 'muted' && 'text-[rgb(var(--cmx-text-secondary-rgb,51_65_85))]'
                )}
              >
                {label}
                {required ? (
                  <span className="ml-1 text-[rgb(var(--cmx-destructive-rgb,220_38_38))]">*</span>
                ) : optionalLabel ? (
                  <span className="ml-2 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                    {optionalLabel}
                  </span>
                ) : null}
              </label>
              {labelAction ? <div className="shrink-0">{labelAction}</div> : null}
            </div>
          )}
          {description ? (
            <p
              id={descriptionId}
              className={cn(
                'cmx-type-field-helper mt-1 text-[rgb(var(--cmx-text-secondary-rgb,51_65_85))]',
                tone === 'muted' && 'text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]'
              )}
            >
              {description}
            </p>
          ) : null}
        </div>
      )}

      <div className="space-y-2">
        <div data-cmx-control>{children}</div>
        {(hint || error || counter) && (
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1 space-y-1">
              {hint && !error ? (
                <p
                  id={helperId}
                  className="cmx-type-field-helper text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]"
                >
                  {hint}
                </p>
              ) : null}
              {error ? (
                <p
                  id={errorId}
                  className="cmx-type-field-error text-[rgb(var(--cmx-destructive-rgb,220_38_38))]"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}
            </div>
            {counter ? (
              <div
                className="cmx-type-field-helper shrink-0 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]"
                aria-live="polite"
              >
                {counter}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {footerId ? (
        <span className="sr-only" id={`${id}-meta`}>
          {footerId}
        </span>
      ) : null}
    </div>
  )
}
