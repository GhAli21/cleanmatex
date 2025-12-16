/**
 * CmxCheckbox - Checkbox primitive
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CmxCheckboxProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'type'> {
  label?: React.ReactNode
  description?: string
  error?: string
}

export const CmxCheckbox = React.forwardRef<HTMLInputElement, CmxCheckboxProps>(
  ({ label, description, error, className, ...props }, ref) => {
    const checkboxId = React.useId()
    const id = props.id || checkboxId

    return (
      <div className="flex items-start gap-2">
        <div className="relative flex items-center">
          <input
            ref={ref}
            type="checkbox"
            id={id}
            className={cn(
              'peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-[var(--cmx-radius-sm,0.25rem)]',
              'border border-[rgb(var(--cmx-border-rgb,226_232_240))]',
              'bg-white',
              'transition-colors',
              'checked:bg-[rgb(var(--cmx-primary-rgb,14_165_233))]',
              'checked:border-[rgb(var(--cmx-primary-rgb,14_165_233))]',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
              'focus-visible:ring-[rgb(var(--cmx-primary-rgb,14_165_233)/0.2)]',
              'disabled:cursor-not-allowed disabled:opacity-50',
              error && 'border-[rgb(var(--cmx-destructive-rgb,220_38_38))]',
              className
            )}
            {...props}
          />
          {/* Checkmark icon */}
          <svg
            className={cn(
              'pointer-events-none absolute left-0.5 top-0.5 h-3 w-3 stroke-white opacity-0',
              'transition-opacity peer-checked:opacity-100'
            )}
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <path
              d="M3 8L6.5 11.5L13 4.5"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>

        {(label || description || error) && (
          <div className="flex flex-col gap-0.5">
            {label && (
              <label
                htmlFor={id}
                className={cn(
                  'text-sm font-medium leading-none cursor-pointer',
                  'text-[rgb(var(--cmx-foreground-rgb,15_23_42))]',
                  'peer-disabled:cursor-not-allowed peer-disabled:opacity-50'
                )}
              >
                {label}
              </label>
            )}
            {description && (
              <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
                {description}
              </p>
            )}
            {error && (
              <p className="text-xs text-[rgb(var(--cmx-destructive-rgb,220_38_38))]">
                {error}
              </p>
            )}
          </div>
        )}
      </div>
    )
  }
)

CmxCheckbox.displayName = 'CmxCheckbox'
