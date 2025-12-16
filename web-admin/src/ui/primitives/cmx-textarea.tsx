/**
 * CmxTextarea - Multi-line text input primitive
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type CmxTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const CmxTextarea = React.forwardRef<HTMLTextAreaElement, CmxTextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[80px] w-full rounded-[var(--cmx-radius-md,0.375rem)] border border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-input-bg-rgb,255_255_255))] px-3 py-2 text-sm shadow-sm outline-none ring-0 placeholder:text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))] focus-visible:border-[rgb(var(--cmx-primary-rgb,14_165_233))] focus-visible:ring-2 focus-visible:ring-[rgb(var(--cmx-primary-rgb,14_165_233))]/40 disabled:cursor-not-allowed disabled:opacity-50',
          className,
        )}
        {...props}
      />
    )
  },
)

CmxTextarea.displayName = 'CmxTextarea'
