'use client'

import { useTranslations } from 'next-intl'
import { CmxButton } from '@ui/primitives'
import { cn } from '@lib/utils'
import {
  READY_LIST_FOCUS,
  type ReadyListFocus,
} from '@/lib/constants/ready-list-focus'

const FOCUS_ORDER: ReadyListFocus[] = [
  READY_LIST_FOCUS.ALL,
  READY_LIST_FOCUS.COUNTER,
  READY_LIST_FOCUS.SHELF,
  READY_LIST_FOCUS.COLLECTION,
  READY_LIST_FOCUS.NO_RACK,
]

interface ReadyListFocusChipsProps {
  value: ReadyListFocus
  onChange: (focus: ReadyListFocus) => void
}

/**
 * Ready-area desk presets. `counter` is the Pickup-desk alias (`?focus=counter`).
 */
export function ReadyListFocusChips({ value, onChange }: ReadyListFocusChipsProps) {
  const t = useTranslations('workflow.ready.focus')

  return (
    <section aria-labelledby="ready-list-focus" className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 id="ready-list-focus" className="text-sm font-semibold">
          {t('title')}
        </h2>
        <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
          {t('description')}
        </p>
      </div>
      <div
        role="group"
        aria-label={t('title')}
        className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]"
      >
        {FOCUS_ORDER.map((focus) => {
          const active = value === focus
          return (
            <CmxButton
              key={focus}
              type="button"
              aria-pressed={active}
              variant={active ? 'primary' : 'outline'}
              size="sm"
              className={cn('shrink-0 whitespace-nowrap')}
              onClick={() => onChange(focus)}
            >
              {t(focus)}
            </CmxButton>
          )
        })}
      </div>
    </section>
  )
}
