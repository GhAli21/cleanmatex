/**
 * CmxMoneyFieldController
 *
 * React Hook Form Controller wrapper for CmxMoneyField.
 * Automatically injects tenant decimalPlaces and formatMoneyWithCode from useTenantCurrency.
 * @module ui/primitives
 */

'use client'

import { Controller, type Control, type FieldPath, type FieldValues } from 'react-hook-form'
import { useTenantCurrency } from '@/lib/context/tenant-currency-context'
import { formatMoneyAmountWithCode } from '@/lib/money/format-money'
import { CmxMoneyField, type CmxMoneyFieldProps } from './cmx-money-field'

/**
 *
 */
export interface CmxMoneyFieldControllerProps<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
> extends Omit<CmxMoneyFieldProps, 'value' | 'onValueChange'> {
  name: TName
  control: Control<TFieldValues>
  /** Override tenant decimalPlaces for this field only. */
  decimalPlaces?: number
}

/**
 *
 * @param root0
 * @param root0.name
 * @param root0.control
 * @param root0.decimalPlaces
 */
export function CmxMoneyFieldController<
  TFieldValues extends FieldValues = FieldValues,
  TName extends FieldPath<TFieldValues> = FieldPath<TFieldValues>,
>({
  name,
  control,
  decimalPlaces: decimalPlacesProp,
  ...fieldProps
}: CmxMoneyFieldControllerProps<TFieldValues, TName>) {
  const { decimalPlaces: tenantDp, currencyCode, moneyLocale } = useTenantCurrency()
  const dp = decimalPlacesProp ?? tenantDp

  // A3-4: `formatDisplayValue` must resolve against the *field's* effective
  // decimalPlaces (`dp`, which may be the `decimalPlacesProp` override), not
  // silently fall back to the tenant default the way calling
  // `useTenantCurrency().formatMoneyWithCode` directly would. Locale comes
  // from the same context (not a direct `next-intl` import here) so this
  // component stays fully mockable via `useTenantCurrency` in tests.
  const formatDisplayValue = (value: number, decimalPlacesForDisplay: number) =>
    formatMoneyAmountWithCode(value, {
      currencyCode,
      decimalPlaces: decimalPlacesForDisplay,
      locale: moneyLocale,
    })

  return (
    <Controller
      name={name}
      control={control}
      render={({ field, fieldState }) => (
        <CmxMoneyField
          {...fieldProps}
          ref={field.ref}
          value={typeof field.value === 'number' ? field.value : null}
          decimalPlaces={dp}
          showZero
          formatDisplayValue={formatDisplayValue}
          onValueChange={(v, _draft, isComplete) => {
            field.onChange(v)
            if (isComplete) field.onBlur()
          }}
          onBlur={field.onBlur}
          error={fieldState.error?.message ?? fieldProps.error}
        />
      )}
    />
  )
}
