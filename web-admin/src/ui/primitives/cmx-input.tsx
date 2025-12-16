/**
 * CmxInput - Text input primitive
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type CmxInputProps = React.InputHTMLAttributes<HTMLInputElement>

export const CmxInput = React.forwardRef<HTMLInputElement, CmxInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          'flex h-9 w-full rounded-[var(--cmx-radius-md,0.375rem)] border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-input-bg-rgb,255_255_255))] px-3 py-1 text-sm shadow-sm outline-none ring-0 placeholder:text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))] focus-visible:border-[rgb(var(--cmx-primary-rgb,14_165_233))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--cmx-primary-rgb,14_165_233))]/40 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )} 
        {...props}
      />
    )
  },
)

CmxInput.displayName = 'CmxInput'
