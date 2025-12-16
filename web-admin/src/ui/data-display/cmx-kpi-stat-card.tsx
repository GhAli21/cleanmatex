/**
 * CmxKpiStatCard - KPI statistics card
 * @module ui/data-display
 */

import { ReactNode } from 'react'
import { CmxCard, CmxCardContent, CmxCardHeader, CmxCardTitle } from '../primitives/cmx-card'

interface CmxKpiStatCardProps {
  title: string
  value: string | number
  subtitle?: string
  icon?: ReactNode
  trend?: {
    value: number
    direction: 'up' | 'down'
  }
}

export function CmxKpiStatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
}: CmxKpiStatCardProps) {
  return (
    <CmxCard>
      <CmxCardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CmxCardTitle>{title}</CmxCardTitle>
        {icon}
      </CmxCardHeader>
      <CmxCardContent>
        <div className="text-2xl font-bold">{value}</div>
        {(subtitle || trend) && (
          <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">
            {trend && (
              <span className={trend.direction === 'up' ? 'text-green-600' : 'text-red-600'}>
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
