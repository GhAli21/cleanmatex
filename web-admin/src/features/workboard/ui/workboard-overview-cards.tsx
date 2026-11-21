'use client'

import { useTranslations } from 'next-intl'
import type { ReactNode } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  ClipboardCheck,
  FileText,
  Home,
  Layers,
  Layers3,
  PackageCheck,
  PlusCircle,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TimerReset,
  Truck,
} from 'lucide-react'
import { CmxButton, CmxSkeleton } from '@ui/primitives'
import { cn } from '@lib/utils'

import {
  WORKBOARD_OWNER_SCREEN_KEYS,
  type WorkboardOwnerScreenKey,
  type WorkboardQueryInput,
  type WorkboardSummary,
} from '@features/workboard/model/workboard-types'

const OWNER_CARD_ORDER = WORKBOARD_OWNER_SCREEN_KEYS

type WorkboardOverviewTone = 'primary' | 'info' | 'success' | 'warning' | 'danger'

const OVERVIEW_TONE_CLASSES: Record<WorkboardOverviewTone, { idle: string; active: string; icon: string }> = {
  primary: {
    idle: 'border-primary/28 bg-primary/5',
    active: 'border-primary/70 bg-primary/12 text-primary-text',
    icon: 'bg-primary/12 text-primary-text',
  },
  info: {
    idle: 'border-info/28 bg-info/5',
    active: 'border-info/70 bg-info/12 text-info',
    icon: 'bg-info/12 text-info',
  },
  success: {
    idle: 'border-success/28 bg-success/5',
    active: 'border-success/70 bg-success/12 text-success',
    icon: 'bg-success/12 text-success',
  },
  warning: {
    idle: 'border-warning/28 bg-warning/5',
    active: 'border-warning/70 bg-warning/12 text-warning',
    icon: 'bg-warning/12 text-warning',
  },
  danger: {
    idle: 'border-destructive/28 bg-destructive/5',
    active: 'border-destructive/70 bg-destructive/12 text-destructive',
    icon: 'bg-destructive/12 text-destructive',
  },
}

/** Chooses a stable semantic accent so supervisor focus cards scan quickly. */
function ownerTone(ownerScreenKey: WorkboardOwnerScreenKey): WorkboardOverviewTone {
  switch (ownerScreenKey) {
    case 'new_order':
      return 'primary'
    case 'home_collection':
      return 'info'
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
    case 'pickup_handover':
      return 'success'
    case 'driver_delivery':
      return 'warning'
    case 'order_detail':
      return 'primary'
  }
}

/** Returns a distinct semantic icon for each operational stage card. */
function ownerIcon(ownerScreenKey: WorkboardOwnerScreenKey): ReactNode {
  switch (ownerScreenKey) {
    case 'new_order':
      return <PlusCircle className="h-4 w-4" aria-hidden />
    case 'home_collection':
      return <Home className="h-4 w-4" aria-hidden />
    case 'preparation':
      return <ClipboardCheck className="h-4 w-4" aria-hidden />
    case 'processing':
      return <Sparkles className="h-4 w-4" aria-hidden />
    case 'assembly':
      return <Layers className="h-4 w-4" aria-hidden />
    case 'qa':
      return <ShieldCheck className="h-4 w-4" aria-hidden />
    case 'packing':
      return <PackageCheck className="h-4 w-4" aria-hidden />
    case 'ready_release':
      return <CheckCircle2 className="h-4 w-4" aria-hidden />
    case 'pickup_handover':
      return <ShoppingBag className="h-4 w-4" aria-hidden />
    case 'driver_delivery':
      return <Truck className="h-4 w-4" aria-hidden />
    case 'order_detail':
      return <FileText className="h-4 w-4" aria-hidden />
  }
}

/** Inputs for the compact Workboard queue focus strip. */
interface WorkboardOverviewCardsProps {
  summary?: WorkboardSummary
  loading?: boolean
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
  loading,
  label,
  value,
  icon,
  tone,
  onClick,
}: {
  active: boolean
  loading?: boolean
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
      aria-pressed={active}
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
        <span className="block truncate text-xs font-medium text-muted-foreground">{label}</span>
        {loading ? (
          <CmxSkeleton className="mt-1 h-7 w-10" />
        ) : (
          <span className="block text-2xl font-semibold tracking-tight tabular-nums">{value}</span>
        )}
      </span>
    </CmxButton>
  )
}

/** Compact, horizontally scrollable queue focus strip for operational triage. */
export function WorkboardOverviewCards({
  summary,
  loading = false,
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
        <p className="text-xs text-muted-foreground">{t('overview.description')}</p>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        <WorkboardOverviewCard
          active={!ownerScreenKey && blocker === 'all' && sla === 'all'}
          loading={loading && !summary}
          label={t('overview.all')}
          value={total}
          icon={<Layers3 className="h-4 w-4" aria-hidden />}
          tone="primary"
          onClick={resetQuickFocus}
        />

        <WorkboardOverviewCard
          active={!ownerScreenKey && blocker === 'all' && sla === 'overdue'}
          loading={loading && !summary}
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

        <WorkboardOverviewCard
          active={!ownerScreenKey && blocker === 'blocked'}
          loading={loading && !summary}
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

        {OWNER_CARD_ORDER.map((screenKey) => (
          <WorkboardOverviewCard
            key={screenKey}
            active={ownerScreenKey === screenKey}
            loading={loading && !summary}
            label={t(`owners.${screenKey}`)}
            value={summary?.byOwner[screenKey] ?? 0}
            icon={ownerIcon(screenKey)}
            tone={ownerTone(screenKey)}
            onClick={() => {
              onOwnerScreenKeyChange(screenKey)
              onBlockerChange('all')
              onSlaChange('all')
            }}
          />
        ))}
      </div>
    </section>
  )
}
