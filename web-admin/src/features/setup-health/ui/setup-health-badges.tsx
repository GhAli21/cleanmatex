'use client'

/**
 * Status and severity badges shared by the Setup Health screen, banner and home card.
 */
import { useTranslations } from 'next-intl'
import { CmxStatusBadge, type StatusBadgeVariant } from '@ui/feedback'
import type { SetupHealthSeverity, SetupHealthStatus } from '@/lib/types/setup-health'

const STATUS_VARIANT: Record<SetupHealthStatus, StatusBadgeVariant> = {
  OK: 'success',
  FAIL: 'warning',
  NA: 'default',
  ERROR: 'error',
}

const SEVERITY_VARIANT: Record<SetupHealthSeverity, StatusBadgeVariant> = {
  BLOCKER: 'error',
  WARNING: 'warning',
  INFO: 'info',
}

/** Check result badge (OK / Needs attention / Not applicable / Could not check). */
export function SetupHealthStatusBadge({ status }: { status: SetupHealthStatus }) {
  const t = useTranslations('setupHealth.status')
  return <CmxStatusBadge size="sm" variant={STATUS_VARIANT[status] ?? 'default'} label={t(status)} />
}

/** How serious a failing check is. */
export function SetupHealthSeverityBadge({ severity }: { severity: SetupHealthSeverity }) {
  const t = useTranslations('setupHealth.severity')
  return <CmxStatusBadge size="sm" variant={SEVERITY_VARIANT[severity] ?? 'default'} label={t(severity)} />
}
