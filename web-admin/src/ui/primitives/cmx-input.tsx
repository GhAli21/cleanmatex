/**
 * CmxInput - Text input primitive with optional label, error, helpText, and icons
 * Replaces compat Input with a single API; supports full-width and accessibility.
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

const inputBaseClasses =
  'flex h-9 w-full rounded-[var(--cmx-radius-md,0.375rem)] border bg-[rgb(var(--cmx-input-bg-rgb,255_255_255))] px-3 py-1 text-sm shadow-sm outline-none ring-0 placeholder:text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))] focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 transition-colors'

export interface CmxInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  /** Optional label shown above the input */
  label?: string
  /** Error message shown below the input; also applies error styling */
  error?: string
  /** Helper text shown below the input when there is no error */
  helpText?: string
  /** Icon or element rendered to the left of the input */
  leftIcon?: React.ReactNode
  /** Icon or element rendered to the right of the input */
  rightIcon?: React.ReactNode
  /** When true (default), input container uses w-full */
  fullWidth?: boolean
}

export const CmxInput = React.forwardRef<HTMLInputElement, CmxInputProps>(
  (
    {
      label,
      error,
      helpText,
      leftIcon,
      rightIcon,
      fullWidth = true,
      className = '',
      id: idProp,
      ...props
    },
    ref
  ) => {
    const generatedId = React.useId()
    const inputId = idProp ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : generatedId)
    const hasError = !!error

    const inputClassName = cn(
      inputBaseClasses,
      'border-[rgb(var(--cmx-border-rgb,226_232_240))]',
      'focus-visible:border-[rgb(var(--cmx-primary-rgb,14_165_233))] focus-visible:ring-[rgb(var(--cmx-primary-rgb,14_165_233))]/40',
      hasError &&
        'border-[rgb(var(--cmx-destructive-rgb,220_38_38))] focus-visible:border-[rgb(var(--cmx-destructive-rgb,220_38_38))] focus-visible:ring-[rgb(var(--cmx-destructive-rgb,220_38_38))]/40',
      leftIcon && 'pl-10',
      rightIcon && 'pr-10',
      className
    )

    return (
      <div className={fullWidth ? 'w-full' : undefined}>
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))] mb-1"
          >
            {label}
            {props.required && <span className="text-[rgb(var(--cmx-destructive-rgb,220_38_38))] ml-1">*</span>}
          </label>
        )}

        <div className="relative">
          {leftIcon && (
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {leftIcon}
            </div>
          )}

          <input
            ref={ref}
            id={inputId}
            className={inputClassName}
            aria-invalid={hasError}
            aria-describedby={
              error ? `${inputId}-error` : helpText ? `${inputId}-help` : undefined
            }
            {...props}
          />

          {rightIcon && (
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
              {rightIcon}
            </div>
          )}
        </div>

        {error && (
          <p id={`${inputId}-error`} className="mt-1 text-sm text-[rgb(var(--cmx-destructive-rgb,220_38_38))]">
            {error}
          </p>
        )}

        {helpText && !error && (
          <p id={`${inputId}-help`} className="mt-1 text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {helpText}
          </p>
        )}
      </div>
    )
  }
)

CmxInput.displayName = 'CmxInput'
