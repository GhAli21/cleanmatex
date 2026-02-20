/**
 * CmxSelect - Select dropdown primitive with optional label, error, and helpText
 * Replaces compat Select with a single API; supports full-width and accessibility.
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CmxSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface CmxSelectProps
  extends Omit<React.SelectHTMLAttributes<HTMLSelectElement>, 'size'> {
  options: CmxSelectOption[]
  placeholder?: string
  /** Optional label shown above the select */
  label?: string
  /** Error message shown below the select; also applies error styling */
  error?: string
  /** Helper text shown below the select when there is no error */
  helpText?: string
  /** When true (default), container uses w-full */
  fullWidth?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export const CmxSelect = React.forwardRef<HTMLSelectElement, CmxSelectProps>(
  (
    {
      options,
      placeholder,
      label,
      error,
      helpText,
      fullWidth = true,
      size = 'md',
      className,
      id: idProp,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const selectId = idProp ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : generatedId)
    const hasError = !!error

    const sizeClass = {
      sm: 'h-8 text-xs',
      md: 'h-9 text-sm',
      lg: 'h-10 text-base',
    }[size]

    return (
      <div className={fullWidth ? 'w-full' : undefined}>
        {label && (
          <label
            htmlFor={selectId}
            className="block text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))] mb-1"
          >
            {label}
            {props.required && <span className="text-[rgb(var(--cmx-destructive-rgb,220_38_38))] ml-1">*</span>}
          </label>
        )}

        <div className="relative w-full">
          <select
            ref={ref}
            id={selectId}
            className={cn(
              'w-full appearance-none rounded-[var(--cmx-radius-md,0.375rem)]',
              'border border-[rgb(var(--cmx-border-rgb,226_232_240))]',
              'bg-white px-3 pr-8',
              'text-[rgb(var(--cmx-foreground-rgb,15_23_42))]',
              'transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              'focus-visible:ring-[rgb(var(--cmx-primary-rgb,14_165_233)/0.2)]',
              'focus-visible:border-[rgb(var(--cmx-primary-rgb,14_165_233))]',
              'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[rgb(var(--cmx-muted-rgb,241_245_249))]',
              hasError && 'border-[rgb(var(--cmx-destructive-rgb,220_38_38))]',
              sizeClass,
              className
            )}
            aria-invalid={hasError}
            aria-describedby={
              error ? `${selectId}-error` : helpText ? `${selectId}-help` : undefined
            }
            {...props}
          >
            {placeholder && (
              <option key="__placeholder__" value="" disabled>
                {placeholder}
              </option>
            )}
            {options.map((option, index) => (
              <option
                key={option.value || `option-${index}`}
                value={option.value}
                disabled={option.disabled}
              >
                {option.label}
              </option>
            ))}
          </select>

          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2">
            <svg
              className="h-4 w-4 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]"
              fill="none"
              viewBox="0 0 20 20"
              xmlns="http://www.w3.org/2000/svg"
              aria-hidden="true"
            >
              <path
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
                d="m6 8 4 4 4-4"
              />
            </svg>
          </div>
        </div>

        {error && (
          <p id={`${selectId}-error`} className="mt-1 text-xs text-[rgb(var(--cmx-destructive-rgb,220_38_38))]">
            {error}
          </p>
        )}

        {helpText && !error && (
          <p id={`${selectId}-help`} className="mt-1 text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {helpText}
          </p>
        )}
      </div>
    )
  }
)

CmxSelect.displayName = 'CmxSelect'
