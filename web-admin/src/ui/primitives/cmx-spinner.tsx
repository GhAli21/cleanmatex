/**
 * CmxSpinner - Loading spinner primitive
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export interface CmxSpinnerProps extends React.HTMLAttributes<HTMLDivElement> {
  size?: 'xs' | 'sm' | 'md' | 'lg'
}

export const CmxSpinner: React.FC<CmxSpinnerProps> = ({
  size = 'md',
  className,
  ...props
}) => {
  const sizeClass = {
    xs: 'h-3 w-3 border',
    sm: 'h-4 w-4 border',
    md: 'h-5 w-5 border-2',
    lg: 'h-6 w-6 border-2',
  }[size]

  return (
    <div
      className={cn(
        'inline-block animate-spin rounded-full border-current border-r-transparent',
        sizeClass,
        className,
      )}
      {...props}
    >
      <span className="sr-only">Loading...</span>
    </div>
  )
}

CmxSpinner.displayName = 'CmxSpinner'
