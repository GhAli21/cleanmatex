'use client'

/**
 * CmxCountryFlag - Renders crisp 3x2 SVG country flags across Windows, macOS, mobile, and print.
 * Uses `country-flag-icons/react/3x2` (offline-safe, zero CDN calls, works where Windows omits flag emojis).
 *
 * @module ui/data-display
 */

import * as React from 'react'
import * as FlagIcons from 'country-flag-icons/react/3x2'
import { cn } from '@/lib/utils'

type FlagComponent = React.ComponentType<React.SVGProps<SVGSVGElement>>
const FLAG_MAP = FlagIcons as unknown as Record<string, FlagComponent | undefined>

export interface CmxCountryFlagProps {
  /** ISO 3166-1 alpha-2 country code (e.g. "OM", "SA", "AE"). */
  iso: string | null | undefined
  /** Optional accessible title; omit when decorative next to a country name/dial code. */
  title?: string
  className?: string
}

export function CmxCountryFlag({ iso, title, className }: CmxCountryFlagProps) {
  const code = (iso ?? '').trim().toUpperCase()
  const Flag = code ? FLAG_MAP[code] : undefined

  if (!Flag) {
    return code ? (
      <span
        aria-hidden={!title}
        className={cn(
          'inline-flex h-3.5 w-5 shrink-0 items-center justify-center rounded-[2px] border border-border bg-muted text-[9px] font-semibold leading-none text-muted-foreground',
          className,
        )}
      >
        {code}
      </span>
    ) : null
  }

  return (
    <Flag
      aria-hidden={!title}
      role={title ? 'img' : undefined}
      aria-label={title}
      className={cn(
        'inline-block h-3.5 w-5 shrink-0 rounded-[2px] border border-border/50 object-cover',
        className,
      )}
    />
  )
}
