'use client'

import { useTranslations } from 'next-intl'
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

interface WorkboardOverviewCardsProps {
  summary?: WorkboardSummary
  ownerScreenKey?: WorkboardOwnerScreenKey
  blocker: WorkboardQueryInput['blocker']
  sla: WorkboardQueryInput['sla']
  onOwnerScreenKeyChange: (value?: WorkboardOwnerScreenKey) => void
  onBlockerChange: (value: WorkboardQueryInput['blocker']) => void
  onSlaChange: (value: WorkboardQueryInput['sla']) => void
}

function WorkboardOverviewCard({
  active,
  label,
  value,
  onClick,
}: {
  active: boolean
  label: string
  value: number
  onClick: () => void
}) {
  return (
    <CmxButton
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn(
        'h-auto min-h-28 w-full flex-col items-start justify-between gap-4 rounded-2xl px-4 py-4 text-start shadow-sm transition-all hover:-translate-y-0.5',
        active
          ? 'border-[rgb(var(--cmx-primary-rgb,14_165_233)/0.45)] bg-[rgb(var(--cmx-primary-rgb,14_165_233)/0.08)] text-[rgb(var(--cmx-primary-hover-rgb,3_105_161))]'
          : 'border-[rgb(var(--cmx-border-subtle-rgb,226_232_240))] bg-[rgb(var(--cmx-card-bg-rgb,255_255_255))]',
      )}
    >
      <span className="text-sm font-semibold">{label}</span>
      <span className="text-4xl font-semibold tracking-tight tabular-nums">
        {value}
      </span>
    </CmxButton>
  )
}

/** Quick-focus cards for stage ownership and risk segments. */
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
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">{t('overview.title')}</h2>
          <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
            {t('overview.description')}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <WorkboardOverviewCard
          active={!ownerScreenKey && blocker === 'all' && sla === 'all'}
          label={t('overview.all')}
          value={total}
          onClick={resetQuickFocus}
        />

        {OWNER_CARD_ORDER.map((screenKey) => (
          <WorkboardOverviewCard
            key={screenKey}
            active={ownerScreenKey === screenKey}
            label={t(`owners.${screenKey}`)}
            value={summary?.byOwner[screenKey] ?? 0}
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
          onClick={() => {
            onOwnerScreenKeyChange(undefined)
            onBlockerChange('all')
            onSlaChange('overdue')
          }}
        />
      </div>
    </div>
  )
}
