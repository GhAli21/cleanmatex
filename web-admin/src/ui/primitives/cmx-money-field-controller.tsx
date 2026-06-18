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
  const { decimalPlaces: tenantDp, formatMoneyWithCode } = useTenantCurrency()
  const dp = decimalPlacesProp ?? tenantDp

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
          formatDisplayValue={formatMoneyWithCode}
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
