'use client'

/**
 * CmxFormPhoneField - React Hook Form Controller wrapper around CmxPhoneInput.
 * Mirrors CmxFormField so RHF + Zod forms get canonical E.164 values in one line.
 *
 * @module ui/forms
 */

import * as React from 'react'
import { type FieldValues, type Path } from 'react-hook-form'
import { CmxFormField } from './cmx-form-field'
import { CmxPhoneInput, type CmxPhoneInputProps } from './cmx-phone-input'

export interface CmxFormPhoneFieldProps<TFieldValues extends FieldValues = FieldValues>
  extends Omit<CmxPhoneInputProps, 'id' | 'name' | 'value' | 'onChange' | 'onBlur' | 'error' | 'ariaDescribedBy'> {
  name: Path<TFieldValues>
  label?: React.ReactNode
  description?: React.ReactNode
  hint?: React.ReactNode
  optionalLabel?: React.ReactNode
}

export function CmxFormPhoneField<TFieldValues extends FieldValues = FieldValues>({
  name,
  label,
  description,
  hint,
  required,
  optionalLabel,
  className,
  ...phoneProps
}: CmxFormPhoneFieldProps<TFieldValues>) {
  return (
    <CmxFormField<TFieldValues>
      name={name}
      label={label}
      description={description}
      hint={hint}
      required={required}
      optionalLabel={optionalLabel}
      className={className}
    >
      {(field) => (
        <CmxPhoneInput
          {...phoneProps}
          id={field.id}
          name={field.name}
          value={typeof field.value === 'string' ? field.value : ''}
          onChange={(e164) => field.onChange(e164)}
          onBlur={field.onBlur}
          required={required}
          error={field.error}
          ariaDescribedBy={field.describedBy}
        />
      )}
    </CmxFormField>
  )
}
