/**
 * CmxCard - Card container primitive
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import { cn } from '@/lib/utils'

export type CmxCardProps = React.HTMLAttributes<HTMLDivElement>

export const CmxCard = React.forwardRef<HTMLDivElement, CmxCardProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-card-bg-rgb,255_255_255))] shadow-sm',
          className,
        )}
        {...props}
      />
    )
  },
)

CmxCard.displayName = 'CmxCard'

export type CmxCardHeaderProps = React.HTMLAttributes<HTMLDivElement>

export const CmxCardHeader = React.forwardRef<HTMLDivElement, CmxCardHeaderProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn('flex flex-col space-y-1.5 p-4 md:p-5', className)}
        {...props}
      />
    )
  },
)

CmxCardHeader.displayName = 'CmxCardHeader'

export type CmxCardTitleProps = React.HTMLAttributes<HTMLHeadingElement>

export const CmxCardTitle = React.forwardRef<HTMLParagraphElement, CmxCardTitleProps>(
  ({ className, ...props }, ref) => {
    return (
      <h3
        ref={ref}
        className={cn('text-sm font-semibold leading-none tracking-tight', className)}
        {...props}
      />
    )
  },
)

CmxCardTitle.displayName = 'CmxCardTitle'

export type CmxCardDescriptionProps = React.HTMLAttributes<HTMLParagraphElement>

export const CmxCardDescription = React.forwardRef<
  HTMLParagraphElement,
  CmxCardDescriptionProps
>(({ className, ...props }, ref) => {
  return (
    <p
      ref={ref}
      className={cn('text-xs text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]', className)}
      {...props}
    />
  )
})

CmxCardDescription.displayName = 'CmxCardDescription'

export type CmxCardContentProps = React.HTMLAttributes<HTMLDivElement>

export const CmxCardContent = React.forwardRef<HTMLDivElement, CmxCardContentProps>(
  ({ className, ...props }, ref) => {
    return <div ref={ref} className={cn('p-4 md:p-5 pt-0', className)} {...props} />
  },
)

CmxCardContent.displayName = 'CmxCardContent'

export type CmxCardFooterProps = React.HTMLAttributes<HTMLDivElement>

export const CmxCardFooter = React.forwardRef<HTMLDivElement, CmxCardFooterProps>(
  ({ className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          'flex items-center p-4 md:p-5 pt-0 border-t border-[rgb(var(--cmx-border-rgb,226_232_240))]',
          className
        )}
        {...props}
      />
    )
  },
)

CmxCardFooter.displayName = 'CmxCardFooter'
