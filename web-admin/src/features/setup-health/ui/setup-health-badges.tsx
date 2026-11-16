'use client'

/**
 * Status and severity badges shared by the Setup Health screen, banner and home card.
 */
import { useTranslations } from 'next-intl'
import { CmxStatusBadge, type CmxBadgeTone } from '@ui/feedback'
import type { SetupHealthSeverity, SetupHealthStatus } from '@/lib/types/setup-health'

const STATUS_VARIANT: Record<SetupHealthStatus, CmxBadgeTone> = {
  OK: 'success',
  FAIL: 'warning',
  NA: 'neutral',
  ERROR: 'danger',
}

const SEVERITY_VARIANT: Record<SetupHealthSeverity, CmxBadgeTone> = {
  BLOCKER: 'danger',
  WARNING: 'warning',
  INFO: 'info',
}

/** Check result badge (OK / Needs attention / Not applicable / Could not check). */
export function SetupHealthStatusBadge({ status }: { status: SetupHealthStatus }) {
  const t = useTranslations('setupHealth.status')
  return <CmxStatusBadge size="sm" tone={STATUS_VARIANT[status] ?? 'neutral'} label={t(status)} />
}

/** How serious a failing check is. */
export function SetupHealthSeverityBadge({ severity }: { severity: SetupHealthSeverity }) {
  const t = useTranslations('setupHealth.severity')
  return <CmxStatusBadge size="sm" tone={SEVERITY_VARIANT[severity] ?? 'neutral'} label={t(severity)} />
}
