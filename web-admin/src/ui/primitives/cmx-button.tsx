/**
 * CmxButton - Primary button primitive
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'

export interface CmxButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive'
  size?: 'xs' | 'sm' | 'md' | 'lg'
  loading?: boolean
  asChild?: boolean
}

export const CmxButton = React.forwardRef<HTMLButtonElement, CmxButtonProps>(
  ({ variant = 'primary', size = 'md', loading, className, children, disabled, asChild = false, ...props }, ref) => {
    const base =
      'inline-flex items-center justify-center font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:opacity-60 disabled:cursor-not-allowed rounded-[var(--cmx-radius-md,0.375rem)]'

    const variantClass = {
      primary: 'bg-[rgb(var(--cmx-primary-rgb,14_165_233))] text-white hover:bg-[rgb(var(--cmx-primary-hover-rgb,3_105_161))]',
      secondary:
        'bg-[rgb(var(--cmx-secondary-bg-rgb,241_245_249))] text-[rgb(var(--cmx-secondary-fg-rgb,15_23_42))] hover:bg-[rgb(var(--cmx-secondary-hover-bg-rgb,226_232_240))]',
      ghost: 'bg-transparent hover:bg-[rgb(var(--cmx-ghost-hover-bg-rgb,241_245_249))]',
      outline:
        'border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-transparent hover:bg-[rgb(var(--cmx-ghost-hover-bg-rgb,241_245_249))]',
      destructive:
        'bg-[rgb(var(--cmx-destructive-rgb,220_38_38))] text-white hover:bg-[rgb(var(--cmx-destructive-hover-rgb,185_28_28))]',
    }[variant]

    const sizeClass = {
      xs: 'h-7 px-2 text-[11px]',
      sm: 'h-8 px-3 text-xs',
      md: 'h-9 px-4 text-sm',
      lg: 'h-10 px-5 text-base',
    }[size]

    if (asChild) {
      return (
        <Slot
          ref={ref as any}
          className={cn(base, variantClass, sizeClass, className)}
          {...(props as any)}
        >
          {children as React.ReactNode}
        </Slot>
      )
    }

    return (
      <button
        ref={ref}
        className={cn(base, variantClass, sizeClass, className)}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <span className="mr-2 inline-block h-3 w-3 animate-spin rounded-full border border-current border-r-transparent" />
        )}
        {children}
      </button>
    )
  },
)

CmxButton.displayName = 'CmxButton'
