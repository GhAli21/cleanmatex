/* eslint-disable jsdoc/require-jsdoc */
/**
 * CmxTabs - Tab navigation primitive
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'
import { useRTL } from '@/lib/hooks/useRTL'

export type CmxTabsProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>

export const CmxTabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  CmxTabsProps
>(({ className, dir, ...props }, ref) => {
  // Takes the page direction (arrow-key order) unless `dir` is passed.
  const isRTL = useRTL()
  return <TabsPrimitive.Root ref={ref} dir={dir ?? (isRTL ? 'rtl' : 'ltr')} className={cn('w-full', className)} {...props} />
})
CmxTabs.displayName = 'CmxTabs'

export type CmxTabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>

export const CmxTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  CmxTabsListProps
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-lg bg-muted p-1 text-muted-foreground',
      className,
    )}
    {...props}
  />
))
CmxTabsList.displayName = 'CmxTabsList'

export type CmxTabsTriggerProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>

export const CmxTabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  CmxTabsTriggerProps
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-sm',
      className,
    )}
    {...props}
  />
))
CmxTabsTrigger.displayName = 'CmxTabsTrigger'

export type CmxTabsContentProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>

export const CmxTabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  CmxTabsContentProps
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      'mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
))
CmxTabsContent.displayName = 'CmxTabsContent'
