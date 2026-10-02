'use client'

import { useQuery } from '@tanstack/react-query'
import { useLocale, useTranslations } from 'next-intl'

import { fetchCashDrawersWithCurrentSession } from '@features/cash-drawers/api/cash-drawer-api'
import { CmxSelect } from '@ui/primitives'

/** What the user chose; `sessionId` is the drawer's open session at selection time (pins the placement). */
export interface CashPlacementChoice {
  cashDrawerId: string
  cashDrawerSessionId: string | null
}

interface CashPlacementPickerProps {
  /** Drawers are limited to this branch when known (the gate enforces it again). */
  branchId?: string | null
  /** Drawers are limited to this currency when known. */
  currencyCode?: string | null
  value: CashPlacementChoice | null
  onChange: (choice: CashPlacementChoice | null) => void
  disabled?: boolean
  /** Drawer that just refused the cash — excluded from the choices. */
  excludeDrawerId?: string | null
}

/**
 * Drawer chooser for the "the cash gate could not place this cash" recovery
 * flow (VERIFY of a pending cash leg, voucher reversal). Lists active drawers
 * of the same branch and currency, shows each drawer's open session, and — when
 * one exists — pins the placement to it so what the user saw is what is
 * recorded. Reusable by any screen that has to re-place cash.
 * @param props component props
 */
export function CashPlacementPicker({
  branchId,
  currencyCode,
  value,
  onChange,
  disabled,
  excludeDrawerId,
}: CashPlacementPickerProps) {
  const t = useTranslations('billing.cashDrawers.placement')
  const locale = useLocale()

  const drawersQuery = useQuery({
    queryKey: ['cash-drawers', 'placement-drawers', branchId ?? null],
    queryFn: () => fetchCashDrawersWithCurrentSession(branchId ?? null),
    staleTime: 15_000,
  })

  if (drawersQuery.isLoading) {
    return <p className="text-xs text-muted-foreground">{t('loading')}</p>
  }
  if (drawersQuery.isError) {
    return (
      <p role="alert" className="text-xs text-destructive">
        {t('loadFailed')}
      </p>
    )
  }

  const eligible = (drawersQuery.data ?? []).filter(
    (d) =>
      d.is_active &&
      d.id !== excludeDrawerId &&
      (!currencyCode || d.currency_code?.toUpperCase() === currencyCode.toUpperCase()),
  )

  if (eligible.length === 0) {
    return (
      <p role="alert" className="text-xs text-destructive">
        {t('noneEligible')}
      </p>
    )
  }

  return (
    <CmxSelect
      label={t('label')}
      value={value?.cashDrawerId ?? ''}
      disabled={disabled}
      onChange={(event) => {
        const drawer = eligible.find((d) => d.id === event.target.value)
        onChange(
          drawer ? { cashDrawerId: drawer.id, cashDrawerSessionId: drawer.currentSession?.id ?? null } : null,
        )
      }}
      options={[
        { value: '', label: t('placeholder') },
        ...eligible.map((d) => {
          const name = locale === 'ar' && d.drawer_name2 ? d.drawer_name2 : d.drawer_name
          const session = d.currentSession ? t('openSession', { sessionNo: d.currentSession.session_no }) : t('noOpenSession')
          return { value: d.id, label: `${name} (${d.drawer_code}) — ${session}` }
        }),
      ]}
    />
  )
}
