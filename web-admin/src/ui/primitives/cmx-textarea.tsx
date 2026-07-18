/* eslint-disable jsdoc/require-jsdoc */
/**
 * CmxTextarea - Multi-line text input primitive
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'
import { cmxFieldChrome } from '@ui/foundations'

export type CmxTextareaProps = React.TextareaHTMLAttributes<HTMLTextAreaElement>

export const CmxTextarea = React.forwardRef<HTMLTextAreaElement, CmxTextareaProps>(
  ({ className, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          'flex min-h-[88px] w-full rounded-[var(--cmx-radius-md,0.375rem)] px-3 py-2 text-sm outline-none ring-0',
          'placeholder:text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]',
          cmxFieldChrome(),
          className
        )}
        {...props}
      />
    )
  }
)

CmxTextarea.displayName = 'CmxTextarea'
