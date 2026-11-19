/**
 * CmxKpiStatCard - KPI statistics card
 * @module ui/data-display
 */

import { ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '../primitives/cmx-card'

/** Semantic tone options for {@link CmxKpiStatCard}. */
export type CmxKpiStatCardTone = 'default' | 'info' | 'success' | 'warning' | 'danger'

interface CmxKpiStatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
  tone?: CmxKpiStatCardTone
  className?: string
}

const TONE_CARD_CLASSES: Record<CmxKpiStatCardTone, string> = {
  default: '',
  info: 'border-info-border bg-info-bg/40',
  success: 'border-success-border bg-success-bg/40',
  warning: 'border-warning-border bg-warning-bg/60',
  danger: 'border-danger-border bg-danger-bg/60',
}

const TONE_VALUE_CLASSES: Record<CmxKpiStatCardTone, string> = {
  default: 'text-foreground',
  info: 'text-info-text',
  success: 'text-success-text',
  warning: 'text-warning-text',
  danger: 'text-danger-text',
}

/**
 *
 * @param root0
 * @param root0.title
 * @param root0.value
 * @param root0.subtitle
 * @param root0.icon
 * @param root0.trend
 * @param root0.tone
 * @param root0.className
 */
export function CmxKpiStatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  tone = 'default',
  className,
}: CmxKpiStatCardProps) {
  return (
    <CmxCard className={cn(TONE_CARD_CLASSES[tone], className)}>
      <CmxCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CmxCardTitle className="text-sm font-medium text-muted-foreground">{title}</CmxCardTitle>
        {icon}
      </CmxCardHeader>
      <CmxCardContent>
        <div className={cn('text-2xl font-bold tabular-nums', TONE_VALUE_CLASSES[tone])}>{value}</div>
        {(subtitle || trend) && (
          <p className="mt-1 text-xs text-muted-foreground">
            {trend && (
              <span className={trend.direction === 'up' ? 'text-success-text' : 'text-danger-text'}>
                {trend.direction === 'up' ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
            )}
            {trend && subtitle && ' '}
            {subtitle}
          </p>
        )}
      </CmxCardContent>
    </CmxCard>
  )
}
