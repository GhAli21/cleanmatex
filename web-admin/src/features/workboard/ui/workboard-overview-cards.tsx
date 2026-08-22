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

type WorkboardOverviewTone = 'primary' | 'info' | 'success' | 'warning' | 'danger'

const OVERVIEW_TONE_CLASSES: Record<WorkboardOverviewTone, { idle: string; active: string; icon: string }> = {
  primary: {
    idle: 'border-[rgb(var(--cmx-primary-rgb,14_165_233)/0.28)] bg-[rgb(var(--cmx-primary-rgb,14_165_233)/0.05)]',
    active: 'border-[rgb(var(--cmx-primary-rgb,14_165_233)/0.7)] bg-[rgb(var(--cmx-primary-rgb,14_165_233)/0.12)] text-[rgb(var(--cmx-primary-hover-rgb,3_105_161))]',
    icon: 'bg-[rgb(var(--cmx-primary-rgb,14_165_233)/0.12)] text-[rgb(var(--cmx-primary-hover-rgb,3_105_161))]',
  },
  info: {
    idle: 'border-[rgb(var(--cmx-info-rgb,59_130_246)/0.28)] bg-[rgb(var(--cmx-info-rgb,59_130_246)/0.05)]',
    active: 'border-[rgb(var(--cmx-info-rgb,59_130_246)/0.7)] bg-[rgb(var(--cmx-info-rgb,59_130_246)/0.12)] text-[rgb(var(--cmx-info-rgb,37_99_235))]',
    icon: 'bg-[rgb(var(--cmx-info-rgb,59_130_246)/0.12)] text-[rgb(var(--cmx-info-rgb,37_99_235))]',
  },
  success: {
    idle: 'border-[rgb(var(--cmx-success-rgb,22_163_74)/0.28)] bg-[rgb(var(--cmx-success-rgb,22_163_74)/0.05)]',
    active: 'border-[rgb(var(--cmx-success-rgb,22_163_74)/0.7)] bg-[rgb(var(--cmx-success-rgb,22_163_74)/0.12)] text-[rgb(var(--cmx-success-rgb,22_163_74))]',
    icon: 'bg-[rgb(var(--cmx-success-rgb,22_163_74)/0.12)] text-[rgb(var(--cmx-success-rgb,22_163_74))]',
  },
  warning: {
    idle: 'border-[rgb(var(--cmx-warning-rgb,217_119_6)/0.28)] bg-[rgb(var(--cmx-warning-rgb,217_119_6)/0.05)]',
    active: 'border-[rgb(var(--cmx-warning-rgb,217_119_6)/0.7)] bg-[rgb(var(--cmx-warning-rgb,217_119_6)/0.12)] text-[rgb(var(--cmx-warning-rgb,180_83_9))]',
    icon: 'bg-[rgb(var(--cmx-warning-rgb,217_119_6)/0.12)] text-[rgb(var(--cmx-warning-rgb,180_83_9))]',
  },
  danger: {
    idle: 'border-[rgb(var(--cmx-destructive-rgb,220_38_38)/0.28)] bg-[rgb(var(--cmx-destructive-rgb,220_38_38)/0.05)]',
    active: 'border-[rgb(var(--cmx-destructive-rgb,220_38_38)/0.7)] bg-[rgb(var(--cmx-destructive-rgb,220_38_38)/0.12)] text-[rgb(var(--cmx-destructive-rgb,220_38_38))]',
    icon: 'bg-[rgb(var(--cmx-destructive-rgb,220_38_38)/0.12)] text-[rgb(var(--cmx-destructive-rgb,220_38_38))]',
  },
}

/** Chooses a stable semantic accent so supervisor focus cards scan quickly. */
function ownerTone(ownerScreenKey: WorkboardOwnerScreenKey): WorkboardOverviewTone {
  switch (ownerScreenKey) {
    case 'preparation':
      return 'info'
    case 'processing':
      return 'success'
    case 'assembly':
      return 'warning'
    case 'qa':
      return 'primary'
    case 'packing':
      return 'info'
    case 'ready_release':
      return 'success'
    case 'driver_delivery':
      return 'warning'
  }
}

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
  tone,
  onClick,
}: {
  active: boolean
  label: string
  value: number
  icon: ReactNode
  tone: WorkboardOverviewTone
  onClick: () => void
}) {
  return (
    <CmxButton
      type="button"
      variant="outline"
      onClick={onClick}
      className={cn(
        'h-auto min-h-[4.5rem] w-[10.5rem] shrink-0 items-center justify-start gap-3 rounded-xl px-3 py-2.5 text-start shadow-sm transition-all hover:-translate-y-0.5',
        active ? OVERVIEW_TONE_CLASSES[tone].active : OVERVIEW_TONE_CLASSES[tone].idle,
      )}
    >
      <span className={cn('grid h-9 w-9 shrink-0 place-items-center rounded-lg', OVERVIEW_TONE_CLASSES[tone].icon)}>
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
    <section aria-labelledby="workboard-queue-focus" className="space-y-1.5">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-0.5">
        <h2 id="workboard-queue-focus" className="text-sm font-semibold">{t('overview.title')}</h2>
        <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">{t('overview.description')}</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        <WorkboardOverviewCard
          active={!ownerScreenKey && blocker === 'all' && sla === 'all'}
          label={t('overview.all')}
          value={total}
          icon={<Layers3 className="h-4 w-4" aria-hidden />}
          tone="primary"
          onClick={resetQuickFocus}
        />

        {OWNER_CARD_ORDER.map((screenKey) => (
          <WorkboardOverviewCard
            key={screenKey}
            active={ownerScreenKey === screenKey}
            label={t(`owners.${screenKey}`)}
            value={summary?.byOwner[screenKey] ?? 0}
            icon={<TimerReset className="h-4 w-4" aria-hidden />}
            tone={ownerTone(screenKey)}
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
          tone="warning"
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
          tone="danger"
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
