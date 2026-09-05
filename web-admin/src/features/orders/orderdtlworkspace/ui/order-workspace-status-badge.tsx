import type { ReactNode } from 'react'

import { AlertCircle, CheckCircle2, CircleDollarSign, Info, MinusCircle } from 'lucide-react'

import { cn } from '@lib/utils'

/** Semantic status treatment used by the workspace without relying on color alone. */
export interface OrderWorkspaceStatusBadgeProps {
  label: string
  tone?: 'neutral' | 'info' | 'success' | 'warning' | 'danger'
  icon?: ReactNode
  className?: string
}

/** Renders a compact text-and-icon status badge using theme tokens. */
export function OrderWorkspaceStatusBadge({
  label,
  tone = 'neutral',
  icon,
  className,
}: OrderWorkspaceStatusBadgeProps) {
  const styles = {
    neutral: 'border-[rgb(var(--cmx-border-rgb,226_232_240))] bg-[rgb(var(--cmx-muted-rgb,248_250_252))] text-[rgb(var(--cmx-muted-foreground-rgb,71_85_105))]',
    info: 'border-[rgb(var(--cmx-primary-rgb,14_165_233))]/30 bg-[rgb(var(--cmx-info-bg-rgb,239_246_255))] text-[rgb(var(--cmx-primary-hover-rgb,3_105_161))]',
    success: 'border-[rgb(var(--cmx-success-rgb,34_197_94))]/30 bg-[rgb(var(--cmx-success-bg-rgb,240_253_244))] text-[rgb(var(--cmx-success-dark-rgb,22_163_74))]',
    warning: 'border-[rgb(var(--cmx-warning-rgb,234_179_8))]/40 bg-[rgb(var(--cmx-warning-bg-rgb,254_252_232))] text-[rgb(var(--cmx-warning-dark-rgb,161_98_7))]',
    danger: 'border-[rgb(var(--cmx-destructive-rgb,220_38_38))]/30 bg-[rgb(var(--cmx-error-bg-rgb,254_242_242))] text-[rgb(var(--cmx-destructive-hover-rgb,185_28_28))]',
  }[tone]
  const DefaultIcon = tone === 'success' ? CheckCircle2 : tone === 'warning' ? AlertCircle : tone === 'danger' ? AlertCircle : tone === 'info' ? Info : MinusCircle

  return (
    <span className={cn('inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold', styles, className)}>
      {icon ?? <DefaultIcon aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />}
      <span className="truncate">{label}</span>
    </span>
  )
}

/** A financial badge with an explicit money icon for collection contexts. */
export function OrderWorkspacePaymentBadge({ label, tone = 'warning' }: Pick<OrderWorkspaceStatusBadgeProps, 'label' | 'tone'>) {
  return <OrderWorkspaceStatusBadge label={label} tone={tone} icon={<CircleDollarSign aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />} />
}
