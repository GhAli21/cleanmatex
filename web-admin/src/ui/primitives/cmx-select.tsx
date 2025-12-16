/**
 * CmxSelect - Select dropdown primitive
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
  error?: string
  size?: 'sm' | 'md' | 'lg'
}

export const CmxSelect = React.forwardRef<HTMLSelectElement, CmxSelectProps>(
  ({ options, placeholder, error, size = 'md', className, ...props }, ref) => {
    const sizeClass = {
      sm: 'h-8 text-xs',
      md: 'h-9 text-sm',
      lg: 'h-10 text-base',
    }[size]

    return (
      <div className="relative w-full">
        <select
          ref={ref}
          className={cn(
            'w-full appearance-none rounded-[var(--cmx-radius-md,0.375rem)]',
            'border border-[rgb(var(--cmx-border-rgb,226_232_240))]',
            'bg-white',
            'px-3 pr-8',
            'text-[rgb(var(--cmx-foreground-rgb,15_23_42))]',
            'transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
            'focus-visible:ring-[rgb(var(--cmx-primary-rgb,14_165_233)/0.2)]',
            'focus-visible:border-[rgb(var(--cmx-primary-rgb,14_165_233))]',
            'disabled:cursor-not-allowed disabled:opacity-50 disabled:bg-[rgb(var(--cmx-muted-rgb,241_245_249))]',
            error && 'border-[rgb(var(--cmx-destructive-rgb,220_38_38))]',
            sizeClass,
            className
          )}
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

        {/* Dropdown icon */}
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

        {error && (
          <p className="mt-1 text-xs text-[rgb(var(--cmx-destructive-rgb,220_38_38))]">
            {error}
          </p>
        )}
      </div>
    )
  }
)

CmxSelect.displayName = 'CmxSelect'
