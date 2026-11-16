import type { ReactNode } from 'react'

import { AlertCircle, CheckCircle2, CircleDollarSign, Info, MinusCircle, type LucideIcon } from 'lucide-react'

import { CmxStatusBadge, type CmxBadgeTone } from '@ui/feedback'
import { cn } from '@lib/utils'

/** Semantic status treatment used by the workspace without relying on color alone. */
export interface OrderWorkspaceStatusBadgeProps {
  label: string
  tone?: CmxBadgeTone
  icon?: LucideIcon
  className?: string
}

const DEFAULT_ICON: Record<CmxBadgeTone, LucideIcon> = {
  neutral: MinusCircle,
  info: Info,
  brand: Info,
  success: CheckCircle2,
  warning: AlertCircle,
  danger: AlertCircle,
}

/**
 * Compact text-and-icon status badge; the icon defaults to one per tone.
 * @param props - label, tone, icon, className
 * @returns The badge
 */
export function OrderWorkspaceStatusBadge({ label, tone = 'neutral', icon, className }: OrderWorkspaceStatusBadgeProps): ReactNode {
  return (
    <CmxStatusBadge
      tone={tone}
      size="sm"
      icon={icon ?? DEFAULT_ICON[tone]}
      label={label}
      className={cn('max-w-full rounded-full font-semibold', className)}
    />
  )
}

/**
 * A financial badge with an explicit money icon for collection contexts.
 * @param props - label and tone
 * @returns The badge
 */
export function OrderWorkspacePaymentBadge({ label, tone = 'warning' }: Pick<OrderWorkspaceStatusBadgeProps, 'label' | 'tone'>) {
  return <OrderWorkspaceStatusBadge label={label} tone={tone} icon={CircleDollarSign} />
}
