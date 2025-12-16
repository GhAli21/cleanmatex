/**
 * CmxFormField - Form field with label, description, and error handling
 * @module ui/forms
 */

'use client'

import { useFormContext, Controller } from 'react-hook-form'
import { ReactNode } from 'react'

interface CmxFormFieldProps {
  name: string
  label: ReactNode
  description?: ReactNode
  required?: boolean
  children: (fieldProps: {
    value: unknown
    onChange: (v: unknown) => void
    onBlur: () => void
  }) => ReactNode
}

export function CmxFormField({
  name,
  label,
  description,
  required,
  children,
}: CmxFormFieldProps) {
  const { control, formState } = useFormContext()
  const error = formState.errors[name]?.message as string | undefined

  return (
    <div className="space-y-1">
      <label className="flex items-center text-sm font-medium text-[rgb(var(--cmx-foreground-rgb,15_23_42))]">
        <span>{label}</span>
        {required && <span className="ml-1 text-[rgb(var(--cmx-destructive-rgb,220_38_38))]">*</span>}
      </label>
      {description && (
        <p className="text-xs text-[rgb(var(--cmx-muted-foreground-rgb,148_163_184))]">{description}</p>
      )}
      <Controller
        name={name}
        control={control}
        render={({ field }) => children(field)}
      />
      {error && (
        <p className="text-xs text-[rgb(var(--cmx-destructive-rgb,220_38_38))]">
          {error}
        </p>
      )}
    </div>
  )
}
