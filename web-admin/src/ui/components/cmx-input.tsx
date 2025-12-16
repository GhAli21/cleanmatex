'use client'

import * as React from 'react'
import { Input, type InputProps } from '@ui/primitives/input'
import { cn } from '@/lib/utils'

export type CmxInputProps = InputProps

export const CmxInput = React.forwardRef<HTMLInputElement, CmxInputProps>(
  ({ className, ...props }, ref) => {
    return (
      <Input
        ref={ref}
        className={cn('text-sm', className)}
        {...props}
      />
    )
  }
)

CmxInput.displayName = 'CmxInput'
