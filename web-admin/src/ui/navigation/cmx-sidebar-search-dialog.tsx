'use client'

/**
 * CmxSidebarSearchDialog - Ctrl+K Quick-Jump Command Palette for CmxSidebar.
 * Searches across all permitted navigation screens using both English & Arabic labels
 * plus parent section names, with full keyboard navigation (ArrowUp/ArrowDown/Enter/Esc).
 *
 * @module ui/navigation
 */

import * as React from 'react'
import { useRouter } from 'next/navigation'
import { useTranslations } from 'next-intl'
import { Search } from 'lucide-react'
import { CmxDialog, CmxDialogContent, CmxDialogHeader, CmxDialogTitle } from '@ui/overlays'
import { CmxInput } from '@ui/primitives'
import { cn } from '@/lib/utils'

export interface QuickJumpItem {
  key: string
  path: string
  label: string
  parentLabel?: string
  searchText: string
  icon: React.ComponentType<{ className?: string }>
  tintClass: string
}

interface CmxSidebarSearchDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: QuickJumpItem[]
}

export function CmxSidebarSearchDialog({
  open,
  onOpenChange,
  items,
}: CmxSidebarSearchDialogProps) {
  const router = useRouter()
  const t = useTranslations('layout.sidebar')
  const [query, setQuery] = React.useState('')
  const [selectedIndex, setSelectedIndex] = React.useState(0)
  const inputRef = React.useRef<HTMLInputElement>(null)

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((item) => item.searchText.includes(q))
  }, [items, query])

  const clampedIndex = filtered.length > 0 ? Math.min(selectedIndex, filtered.length - 1) : 0

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      setQuery('')
      setSelectedIndex(0)
    }
    onOpenChange(next)
  }

  const navigateTo = (path: string) => {
    handleOpenChange(false)
    router.push(path)
  }

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      if (filtered.length > 0) {
        setSelectedIndex((prev) => (prev + 1) % filtered.length)
      }
      return
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      if (filtered.length > 0) {
        setSelectedIndex((prev) => (prev - 1 + filtered.length) % filtered.length)
      }
      return
    }
    if (event.key === 'Enter' && filtered[clampedIndex]) {
      event.preventDefault()
      navigateTo(filtered[clampedIndex].path)
    }
  }

  return (
    <CmxDialog open={open} onOpenChange={handleOpenChange}>
      <CmxDialogContent className="max-w-md w-full p-0 overflow-hidden">
        <CmxDialogHeader className="sr-only">
          <CmxDialogTitle>{t('quickJumpTitle')}</CmxDialogTitle>
        </CmxDialogHeader>

        <div className="border-b border-border p-3">
          <CmxInput
            ref={inputRef}
            autoFocus
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setSelectedIndex(0)
            }}
            onKeyDown={handleKeyDown}
            placeholder={t('quickJumpPlaceholder')}
            aria-label={t('quickJumpTitle')}
            leftIcon={<Search className="h-4 w-4 text-primary-text" aria-hidden />}
          />
        </div>

        <ul
          role="listbox"
          aria-label={t('quickJumpTitle')}
          className="max-h-72 overflow-y-auto p-1.5 space-y-0.5"
        >
          {filtered.length === 0 ? (
            <li className="py-8 text-center text-xs text-muted-foreground">
              {t('noSearchResults')}
            </li>
          ) : (
            filtered.map((item, idx) => {
              const Icon = item.icon
              const isSelected = idx === clampedIndex
              return (
                <li key={item.key} role="option" aria-selected={isSelected}>
                  <button
                    type="button"
                    onMouseEnter={() => setSelectedIndex(idx)}
                    onClick={() => navigateTo(item.path)}
                    className={cn(
                      'w-full flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-xs text-start transition-colors',
                      isSelected
                        ? 'bg-primary-bg text-primary-text font-semibold'
                        : 'text-foreground hover:bg-muted',
                    )}
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      <span
                        className={cn(
                          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md',
                          item.tintClass,
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" aria-hidden />
                      </span>
                      <span className="truncate">{item.label}</span>
                    </span>
                    {item.parentLabel ? (
                      <span className="shrink-0 text-[11px] text-muted-foreground">
                        {item.parentLabel}
                      </span>
                    ) : null}
                  </button>
                </li>
              )
            })
          )}
        </ul>

        <div className="flex items-center justify-between border-t border-border bg-muted px-3.5 py-2 text-[11px] text-muted-foreground">
          <span>{t('quickJumpHint')}</span>
          <span>{t('quickJumpEsc')}</span>
        </div>
      </CmxDialogContent>
    </CmxDialog>
  )
}
