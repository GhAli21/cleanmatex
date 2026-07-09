'use client'

import { useLocale, useTranslations } from 'next-intl'

import { useTenantCurrency } from '@lib/context/tenant-currency-context'
import { formatMoneyAmountWithCode } from '@lib/money/format-money'
import type {
  CashDrawerMovementRow,
  CashDrawerSessionListRow,
  CashDrawerSessionSummarySnapshot,
} from '@lib/types/cash-drawer'
import { CmxStatusBadge } from '@ui/feedback'
import { Badge } from '@ui/primitives/badge'
import { CmxCard, CmxCardContent } from '@ui/primitives/cmx-card'

/**
 * Shared info tile used by the upgraded cash-drawer detail surfaces.
 *
 * Why:
 * the drawer overview and session detail pages both need compact context cards,
 * so keeping one tile style avoids layout drift between the two routes.
 */
export function CashDrawerInfoTile({
  label,
  value,
}: {
  label: string
  value: string
}) {
  return (
    <CmxCard className="shadow-none">
      <CmxCardContent className="space-y-1 p-4">
        <div className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
          {label}
        </div>
        <div className="break-words text-sm font-semibold text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
          {value}
        </div>
      </CmxCardContent>
    </CmxCard>
  )
}

/**
 * Shared operational status badge for drawer and session surfaces.
 *
 * @param status low-level session or drawer status code
 * @returns Cmx status badge with consistent tone
 */
export function CashDrawerStatusBadge({ status }: { status: string }) {
  if (status === 'OPEN') {
    return <CmxStatusBadge label={status} variant="success" size="sm" />
  }

  if (status === 'FORCE_CLOSED') {
    return <CmxStatusBadge label={status} variant="error" size="sm" />
  }

  if (status === 'PAUSED') {
    return <CmxStatusBadge label={status} variant="warning" size="sm" />
  }

  return <CmxStatusBadge label={status} variant="outline" size="sm" />
}

/**
 * Shared drawer type badge so all cash-drawer routes use the same visual
 * treatment for drawer taxonomy.
 */
export function CashDrawerTypeBadge({ drawerType }: { drawerType: string }) {
  return <Badge variant="outline">{drawerType}</Badge>
}

/**
 * Tenant-aware money formatter reused by cash-drawer screens.
 *
 * Why:
 * the drawer area mixes session, movement, and payment amounts; centralizing
 * the formatter keeps decimal precision and locale behavior consistent.
 *
 * @param value amount to format
 * @param currencyCode explicit currency when different from tenant fallback
 * @returns money string including currency code
 */
export function useCashDrawerMoneyFormatter() {
  const locale = useLocale()
  const { currencyCode: tenantCurrency, decimalPlaces } = useTenantCurrency()
  const moneyLocale = locale === 'ar' ? 'ar' : 'en'

  return (value: number | null | undefined, currencyCode?: string | null) => {
    if (value == null) return '—'

    return formatMoneyAmountWithCode(value, {
      currencyCode: currencyCode || tenantCurrency,
      decimalPlaces,
      locale: moneyLocale,
    })
  }
}

/**
 * Localized date-time formatter reused by cash-drawer screens.
 *
 * @param value ISO timestamp to format
 * @returns locale-aware date/time string or em dash
 */
export function useCashDrawerDateFormatter() {
  const locale = useLocale()

  return (value: string | null | undefined) => {
    if (!value) return '—'

    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar' : 'en', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  }
}

/**
 * Human-friendly drawer status label for the hub master table.
 *
 * Why:
 * the drawer hub needs a short business label instead of exposing raw derived
 * status codes directly.
 */
export function useCashDrawerStatusText() {
  const t = useTranslations('billing.cashDrawers')

  return (status: 'OPEN' | 'CLOSED') =>
    status === 'OPEN' ? t('statusLabels.OPEN') : t('statusLabels.CLOSED')
}

/**
 * Builds a compact session badge label from the available snapshot.
 *
 * @param session current or latest session snapshot
 * @returns user-friendly badge label
 */
export function buildSessionSummaryLabel(
  session: CashDrawerSessionSummarySnapshot | CashDrawerSessionListRow | null,
) {
  if (!session) return null
  return `${session.status} · ${session.sessionNo}`
}

/**
 * Returns the most relevant movement-session badge text for the hub.
 *
 * @param currentSession current open session, if any
 * @param latestSession latest known session snapshot, if any
 * @returns short descriptive label for the drawer row
 */
export function buildDrawerSessionIndicator(
  currentSession: CashDrawerSessionSummarySnapshot | null,
  latestSession: CashDrawerSessionSummarySnapshot | null,
) {
  if (currentSession) {
    return {
      tone: 'open' as const,
      label: currentSession.sessionNo,
    }
  }

  if (latestSession) {
    return {
      tone: 'history' as const,
      label: latestSession.sessionNo,
    }
  }

  return null
}

/**
 * Shared movement tone badge for recent movement tables.
 *
 * @param movement movement row shown in overview/detail tables
 * @returns badge with a semantic movement tone
 */
export function CashDrawerMovementBadge({ movement }: { movement: CashDrawerMovementRow }) {
  const className =
    movement.direction === 'IN'
      ? 'bg-emerald-100 text-emerald-900'
      : 'bg-rose-100 text-rose-900'

  return (
    <Badge variant="outline" className={className}>
      {movement.movementType}
    </Badge>
  )
}
