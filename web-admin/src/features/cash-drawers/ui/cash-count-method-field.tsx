'use client'

import { useTranslations } from 'next-intl'

import type { CountMethod } from '@features/cash-drawers/hooks/use-drawer-count-method'
import { CmxSelect } from '@ui/primitives'

/**
 * How a count is entered. When the drawer's policy leaves a real choice it is a select; when the
 * policy fixes the method (denominations required, or total only) it is stated, so the cashier is
 * never offered something the server would refuse.
 */
export function CashCountMethodField({
  methods,
  value,
  onChange,
}: {
  methods: CountMethod[]
  value: CountMethod
  onChange: (value: CountMethod) => void
}) {
  const t = useTranslations('billing.cashDrawers.wizard')
  if (methods.length > 1) {
    return (
      <CmxSelect
        label={t('countMethod')}
        value={value}
        onChange={(event) => onChange(event.target.value as CountMethod)}
        options={[
          { value: 'TOTAL_ONLY', label: t('countMethodTotal') },
          { value: 'DENOMINATION', label: t('countMethodDenomination') },
        ]}
      />
    )
  }
  return (
    <p className="text-sm text-[rgb(var(--cmx-muted-foreground-rgb,100_116_139))]">
      {methods[0] === 'DENOMINATION' ? t('countMethodFixedDenomination') : t('countMethodFixedTotal')}
    </p>
  )
}
