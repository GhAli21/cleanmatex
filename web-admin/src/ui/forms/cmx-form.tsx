/**
 * CmxForm - Form shell with React Hook Form + Zod
 * @module ui/forms
 */

'use client'

import { FormProvider, type UseFormReturn, type FieldValues } from 'react-hook-form'
import { type ReactNode } from 'react'

interface CmxFormProps<TFieldValues extends FieldValues = FieldValues> {
  form: UseFormReturn<TFieldValues>
  onSubmit: (values: TFieldValues) => void | Promise<void>
  children: ReactNode
  className?: string
}

export function CmxForm<TFieldValues extends FieldValues = FieldValues>({
  form,
  onSubmit,
  children,
  className = 'space-y-6',
}: CmxFormProps<TFieldValues>) {
  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={className}
        noValidate
      >
        {children}
      </form>
    </FormProvider>
  )
}
