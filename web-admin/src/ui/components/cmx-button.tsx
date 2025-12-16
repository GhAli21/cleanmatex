'use client'

import * as React from 'react'
import { Button, type ButtonProps } from '@ui/primitives/button'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface CmxButtonProps extends ButtonProps {
  loading?: boolean
  leftIcon?: React.ReactNode
  rightIcon?: React.ReactNode
}

export const CmxButton: React.FC<CmxButtonProps> = ({
  loading,
  leftIcon,
  rightIcon,
  children,
  className,
  disabled,
  ...props
}) => {
  return (
    <Button
      className={cn('gap-2', className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {!loading && leftIcon}
      <span>{children}</span>
      {!loading && rightIcon}
    </Button>
  )
}
