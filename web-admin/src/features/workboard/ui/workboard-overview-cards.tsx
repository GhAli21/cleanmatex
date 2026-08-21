'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import { AlertCircle, Layers3, TimerReset } from 'lucide-react'
import { CmxButton } from '@ui/primitives'
import { cn } from '@lib/utils'

import type {
  WorkboardOwnerScreenKey,
  WorkboardQueryInput,
  WorkboardSummary,
} from '@features/workboard/model/workboard-types'

const OWNER_CARD_ORDER: WorkboardOwnerScreenKey[] = [
  'preparation',
  'processing',
  'assembly',
  'qa',
  'packing',
  'ready_release',
  'driver_delivery',
]

/** Inputs for the compact Workboard queue focus strip. */
interface WorkboardOverviewCardsProps {
  summary?: WorkboardSummary
  ownerScreenKey?: WorkboardOwnerScreenKey
  blocker: WorkboardQueryInput['blocker']
  sla: WorkboardQueryInput['sla']
  onOwnerScreenKeyChange: (value?: WorkboardOwnerScreenKey) => void
  onBlockerChange: (value: WorkboardQueryInput['blocker']) => void
  onSlaChange: (value: WorkboardQueryInput['sla']) => void
}

/** A single filterable queue metric that keeps summary data actionable. */
function WorkboardOverviewCard({
  active,
  label,
  value,
  icon,
  onClick,
}: {
  active: boolean
  label: string
  value: number
  icon: ReactNode
  onClick: () => void
}) {
  return (
    <CmxButton
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn(
        'h-auto min-h-20 w-[11rem] shrink-0 items-center justify-start gap-3 rounded-xl px-3 py-3 text-start shadow-sm transition-all hover:-translate-y-0.5',
        active
          ? 'border-[rgb(var(--cmx-primary-rgb,14_165_233)/0.45)] bg-[rgb(var(--cmx-primary-rgb,14_165_233)/0.08)] text-[rgb(var(--cmx-primary-hover-rgb,3_105_161))]'
          : 'border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-card-bg-rgb,255_255_255))]',
      )}
    >
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[rgb(var(--cmx-muted-rgb,241_245_249))]">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-medium text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{label}</span>
        <span className="block text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
      </span>
    </CmxButton>
  )
}

/** Compact, horizontally scrollable queue focus strip for operational triage. */
export function WorkboardOverviewCards({
  summary,
  ownerScreenKey,
  blocker,
  sla,
  onOwnerScreenKeyChange,
  onBlockerChange,
  onSlaChange,
}: WorkboardOverviewCardsProps) {
  const t = useTranslations('workboard')

  const resetQuickFocus = () => {
    onOwnerScreenKeyChange(undefined)
    onBlockerChange('all')
    onSlaChange('all')
  }

  const total = summary?.total ?? 0
  const blocked = summary?.blocked ?? 0
  const overdue = summary?.overdue ?? 0

  return (
    <section aria-labelledby="workboard-queue-focus" className="space-y-2">
      <div className="flex items-baseline justify-between gap-3">
        <div>
          <h2 id="workboard-queue-focus" className="text-sm font-semibold">{t('overview.title')}</h2>
          <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('overview.description')}</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        <WorkboardOverviewCard
          active={!ownerScreenKey && blocker === 'all' && sla === 'all'}
          label={t('overview.all')}
          value={total}
          icon={<Layers3 className="h-4 w-4" aria-hidden />}
          onClick={resetQuickFocus}
        />

        {OWNER_CARD_ORDER.map((screenKey) => (
          <WorkboardOverviewCard
            key={screenKey}
            active={ownerScreenKey === screenKey}
            label={t(`owners.${screenKey}`)}
            value={summary?.byOwner[screenKey] ?? 0}
            icon={<TimerReset className="h-4 w-4" aria-hidden />}
            onClick={() => {
              onOwnerScreenKeyChange(screenKey)
              onBlockerChange('all')
              onSlaChange('all')
            }}
          />
        ))}

        <WorkboardOverviewCard
          active={!ownerScreenKey && blocker === 'blocked'}
          label={t('overview.blocked')}
          value={blocked}
          icon={<AlertCircle className="h-4 w-4" aria-hidden />}
          onClick={() => {
            onOwnerScreenKeyChange(undefined)
            onBlockerChange('blocked')
            onSlaChange('all')
          }}
        />

        <WorkboardOverviewCard
          active={!ownerScreenKey && blocker === 'all' && sla === 'overdue'}
          label={t('overview.overdue')}
          value={overdue}
          icon={<TimerReset className="h-4 w-4" aria-hidden />}
          onClick={() => {
            onOwnerScreenKeyChange(undefined)
            onBlockerChange('all')
            onSlaChange('overdue')
          }}
        />
      </div>
    </section>
  )
}
