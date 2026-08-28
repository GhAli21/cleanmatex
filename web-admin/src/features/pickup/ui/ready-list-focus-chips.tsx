'use client'

import { useTranslations } from 'next-intl'
import { CmxButton } from '@ui/primitives'
import { cn } from '@lib/utils'
import {
  EMPTY_READY_LIST_QUERY,
  readyListHasFilters,
  type ReadyListQuery,
} from '@/lib/constants/ready-list-focus'

interface ReadyListFocusChipsProps {
  /** Current stacked Ready-list query from the URL. */
  query: ReadyListQuery
  /** Replace the URL query; callers reset `page` to 1. */
  onChange: (next: ReadyListQuery) => void
}

interface ReadyListToggle {
  key: keyof Pick<ReadyListQuery, 'desk' | 'staged' | 'unreleased' | 'collectionDue' | 'missingRack'>
  labelKey: 'desk' | 'counter' | 'shelf' | 'collection' | 'no_rack'
}

const MODE_TOGGLES: ReadyListToggle[] = [{ key: 'desk', labelKey: 'desk' }]

const STATUS_TOGGLES: ReadyListToggle[] = [
  { key: 'staged', labelKey: 'counter' },
  { key: 'unreleased', labelKey: 'shelf' },
]

const EXTRA_TOGGLES: ReadyListToggle[] = [
  { key: 'collectionDue', labelKey: 'collection' },
  { key: 'missingRack', labelKey: 'no_rack' },
]

/**
 * Combinable Ready-desk filters. Pickup desk is chrome plus both handover statuses
 * unless a status toggle narrows the list.
 */
export function ReadyListFocusChips({ query, onChange }: ReadyListFocusChipsProps) {
  const t = useTranslations('workflow.ready.focus')
  const tCommon = useTranslations('common')

  const toggle = (key: ReadyListToggle['key']) => {
    onChange({ ...query, [key]: !query[key], page: 1 })
  }

  const renderToggles = (toggles: ReadyListToggle[]) =>
    toggles.map((item) => {
      const active = query[item.key]
      return (
        <CmxButton
          key={item.key}
          type="button"
          aria-pressed={active}
          variant={active ? 'primary' : 'outline'}
          size="sm"
          className={cn('shrink-0 whitespace-nowrap')}
          onClick={() => toggle(item.key)}
        >
          {t(item.labelKey)}
        </CmxButton>
      )
    })

  return (
    <section aria-labelledby="ready-list-focus" className="space-y-2">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 id="ready-list-focus" className="text-sm font-semibold">
          {t('title')}
        </h2>
        <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
          {t('description')}
        </p>
      </div>
      <div className="space-y-2">
        <div role="group" aria-label={t('desk')} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {renderToggles(MODE_TOGGLES)}
        </div>
        <div role="group" aria-label={t('statusGroup')} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {renderToggles(STATUS_TOGGLES)}
        </div>
        <div role="group" aria-label={t('extraGroup')} className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
          {renderToggles(EXTRA_TOGGLES)}
          {readyListHasFilters(query) ? (
            <CmxButton
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0 whitespace-nowrap"
              onClick={() => onChange({ ...EMPTY_READY_LIST_QUERY, desk: query.desk, page: 1 })}
            >
              {tCommon('clear')}
            </CmxButton>
          ) : null}
        </div>
      </div>
    </section>
  )
}
