'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'
import { useTransition, useCallback } from 'react'
import { useTranslations } from 'next-intl'
import { Search, SlidersHorizontal, X } from 'lucide-react'
import { CmxButton } from '@ui/primitives'
import { CmxInput } from '@ui/primitives'
import {
  CmxSelectDropdown,
  CmxSelectDropdownTrigger,
  CmxSelectDropdownValue,
  CmxSelectDropdownContent,
  CmxSelectDropdownItem,
} from '@ui/forms'

interface GlFilterBarProps {
  /** Distinct event codes already posted in this tenant — used to build the event dropdown. */
  eventCodes: string[]
}

const ENTRY_SIDES = ['DEBIT', 'CREDIT'] as const

/**
 * URL-driven filter bar for the GL Inquiry screen.
 * All state lives in search params so the server page can re-fetch on navigation.
 */
export function GlFilterBar({ eventCodes }: GlFilterBarProps) {
  const t = useTranslations('erpLite.reports')
  const tCommon = useTranslations('common')
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  const current = {
    journalNo: searchParams.get('journalNo') ?? '',
    accountCode: searchParams.get('accountCode') ?? '',
    dateFrom: searchParams.get('dateFrom') ?? '',
    dateTo: searchParams.get('dateTo') ?? '',
    eventCode: searchParams.get('eventCode') ?? '',
    entrySide: searchParams.get('entrySide') ?? '',
  }

  const hasActiveFilters = Object.values(current).some(Boolean)

  const push = useCallback(
    (updates: Partial<typeof current>) => {
      const params = new URLSearchParams(searchParams.toString())
      // Reset to page 1 on filter change
      params.delete('page')
      for (const [key, value] of Object.entries(updates)) {
        if (value) {
          params.set(key, value)
        } else {
          params.delete(key)
        }
      }
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`)
      })
    },
    [searchParams, pathname, router],
  )

  const clearAll = () => {
    startTransition(() => {
      router.push(pathname)
    })
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-surface-rgb,255_255_255))] p-4">
      {/* Row 1: search inputs */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1">
          <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]" />
          <CmxInput
            className="ps-8 text-sm"
            placeholder={t('gl.filters.journalNo')}
            defaultValue={current.journalNo}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                push({ journalNo: (e.target as HTMLInputElement).value })
              }
            }}
            onBlur={(e) => push({ journalNo: e.target.value })}
          />
        </div>

        <div className="relative min-w-[160px] flex-1">
          <Search className="absolute start-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]" />
          <CmxInput
            className="ps-8 text-sm"
            placeholder={t('gl.filters.accountCode')}
            defaultValue={current.accountCode}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                push({ accountCode: (e.target as HTMLInputElement).value })
              }
            }}
            onBlur={(e) => push({ accountCode: e.target.value })}
          />
        </div>

        {/* Date range */}
        <div className="flex items-center gap-1">
          <CmxInput
            type="date"
            className="text-sm"
            title={t('gl.filters.dateFrom')}
            value={current.dateFrom}
            onChange={(e) => push({ dateFrom: e.target.value })}
          />
          <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">–</span>
          <CmxInput
            type="date"
            className="text-sm"
            title={t('gl.filters.dateTo')}
            value={current.dateTo}
            onChange={(e) => push({ dateTo: e.target.value })}
          />
        </div>
      </div>

      {/* Row 2: dropdowns + clear */}
      <div className="flex flex-wrap items-center gap-2">
        <SlidersHorizontal className="h-4 w-4 shrink-0 text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]" />

        {/* Event code */}
        <CmxSelectDropdown
          value={current.eventCode}
          onValueChange={(val) => push({ eventCode: val === '_all' ? '' : val })}
        >
          <CmxSelectDropdownTrigger className="h-8 min-w-[180px] text-sm">
            <CmxSelectDropdownValue placeholder={t('gl.filters.allEvents')} />
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            <CmxSelectDropdownItem value="_all">{t('gl.filters.allEvents')}</CmxSelectDropdownItem>
            {eventCodes.map((code) => (
              <CmxSelectDropdownItem key={code} value={code}>
                {code}
              </CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>

        {/* Entry side */}
        <CmxSelectDropdown
          value={current.entrySide}
          onValueChange={(val) => push({ entrySide: val === '_all' ? '' : val })}
        >
          <CmxSelectDropdownTrigger className="h-8 min-w-[140px] text-sm">
            <CmxSelectDropdownValue placeholder={t('gl.filters.allSides')} />
          </CmxSelectDropdownTrigger>
          <CmxSelectDropdownContent>
            <CmxSelectDropdownItem value="_all">{t('gl.filters.allSides')}</CmxSelectDropdownItem>
            {ENTRY_SIDES.map((side) => (
              <CmxSelectDropdownItem key={side} value={side}>
                {t(`gl.filters.side_${side.toLowerCase()}`)}
              </CmxSelectDropdownItem>
            ))}
          </CmxSelectDropdownContent>
        </CmxSelectDropdown>

        {hasActiveFilters && (
          <CmxButton
            variant="ghost"
            size="sm"
            onClick={clearAll}
            disabled={isPending}
            className="h-8 gap-1 text-sm"
          >
            <X className="h-3.5 w-3.5" />
            {tCommon('clearFilters')}
          </CmxButton>
        )}

        {isPending && (
          <span className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
            {tCommon('loading')}…
          </span>
        )}
      </div>
    </div>
  )
}
