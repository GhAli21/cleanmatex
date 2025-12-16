/**
 * CmxTabs - Tab navigation primitive
 * @module ui/primitives
 */

'use client'

import * as React from 'react'
import * as TabsPrimitive from '@radix-ui/react-tabs'
import { cn } from '@/lib/utils'

export type CmxTabsProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>

export const CmxTabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  CmxTabsProps
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Root ref={ref} className={cn('w-full', className)} {...props} />
))
CmxTabs.displayName = 'CmxTabs'

export type CmxTabsListProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>

export const CmxTabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  CmxTabsListProps
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      'inline-flex h-10 items-center justify-center rounded-lg bg-[rgb(var(--cmx-muted-rgb,241_245_249))] p-1 text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]',
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
      'inline-flex items-center justify-center whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium ring-offset-[rgb(var(--cmx-background-rgb,255_255_255))] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--cmx-primary-rgb,14_165_233))] focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 data-[state=active]:bg-[rgb(var(--cmx-background-rgb,255_255_255))] data-[state=active]:text-[rgb(var(--cmx-foreground-rgb,15_23_42))] data-[state=active]:shadow-sm',
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
      'mt-2 ring-offset-[rgb(var(--cmx-background-rgb,255_255_255))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--cmx-primary-rgb,14_165_233))] focus-visible:ring-offset-2',
      className,
    )}
    {...props}
  />
))
CmxTabsContent.displayName = 'CmxTabsContent'

