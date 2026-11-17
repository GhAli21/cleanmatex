/* eslint-disable jsdoc/require-jsdoc */
/**
 * CmxButton - Primary button primitive
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cn } from '@/lib/utils'
import { CMX_BUTTON_OUTLINE_CHROME } from '@ui/foundations'

export interface CmxButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'outline' | 'destructive'
  /** `icon` is a square button for a single icon; give it an aria-label. */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'icon'
  loading?: boolean
  asChild?: boolean
}

export const CmxButton = React.forwardRef<HTMLButtonElement, CmxButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading,
      className,
      children,
      disabled,
      asChild = false,
      ...props
    },
    ref
  ) => {
    const base = cn(
      'inline-flex items-center justify-center font-medium transition-colors',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
      CMX_BUTTON_OUTLINE_CHROME.focusRing,
      'disabled:cursor-not-allowed disabled:opacity-60',
      'rounded-[var(--cmx-radius-md,0.375rem)]'
    )

    const variantClass = {
      primary:
        'border-2 border-transparent bg-[rgb(var(--cmx-primary-rgb,14_165_233))] text-[rgb(var(--cmx-primary-fg-rgb))] hover:bg-[rgb(var(--cmx-primary-hover-rgb,3_105_161))]',
      secondary: CMX_BUTTON_OUTLINE_CHROME.secondary,
      ghost:
        'border-2 border-transparent bg-transparent hover:bg-[rgb(var(--cmx-ghost-hover-bg-rgb,241_245_249))]',
      outline: CMX_BUTTON_OUTLINE_CHROME.outline,
      destructive:
        'border-2 border-transparent bg-[rgb(var(--cmx-destructive-rgb,220_38_38))] text-destructive-foreground hover:bg-[rgb(var(--cmx-destructive-hover-rgb,185_28_28))]',
    }[variant]

    const sizeClass = {
      xs: 'h-7 px-2 text-[11px]',
      sm: 'h-8 px-3 text-xs',
      md: 'h-10 px-4 text-sm',
      lg: 'h-11 px-5 text-base',
      icon: 'h-9 w-9 p-0',
    }[size]

    if (asChild) {
      return (
        <Slot
          ref={ref as React.Ref<HTMLElement>}
          className={cn(base, variantClass, sizeClass, className)}
          {...(props as React.ComponentPropsWithoutRef<typeof Slot>)}
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
          <span className="me-2 inline-block h-3 w-3 animate-spin rounded-full border-2 border-current border-e-transparent" />
        )}
        {children}
      </button>
    )
  }
)

CmxButton.displayName = 'CmxButton'
