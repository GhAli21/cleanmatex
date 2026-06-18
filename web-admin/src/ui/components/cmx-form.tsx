'use client'

import * as React from 'react'
import {
  Form as ShadcnForm,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from '@ui/primitives/form'
import type { UseFormReturn, FieldValues, Path } from 'react-hook-form'

interface CmxFormProps<TFieldValues extends FieldValues> {
  form: UseFormReturn<TFieldValues>
  onSubmit: (values: TFieldValues) => Promise<void> | void
  className?: string
  children: React.ReactNode
}

/**
 *
 * @param root0
 * @param root0.form
 * @param root0.onSubmit
 * @param root0.className
 * @param root0.children
 */
export function CmxForm<TFieldValues extends FieldValues>({
  form,
  onSubmit,
  className,
  children,
}: CmxFormProps<TFieldValues>) {
  return (
    <ShadcnForm {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className={className ?? 'space-y-6'}
      >
        {children}
      </form>
    </ShadcnForm>
  )
}

interface CmxFormFieldProps<TFieldValues extends FieldValues> {
  name: Path<TFieldValues>
  label?: React.ReactNode
  description?: React.ReactNode
  children: (ctx: { field: unknown }) => React.ReactNode
  form: UseFormReturn<TFieldValues>
}

/**
 *
 * @param root0
 * @param root0.name
 * @param root0.label
 * @param root0.description
 * @param root0.children
 * @param root0.form
 */
export function CmxFormField<TFieldValues extends FieldValues>({
  name,
  label,
  description,
  children,
  form,
}: CmxFormFieldProps<TFieldValues>) {
  return (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          {label && <FormLabel>{label}</FormLabel>}
          <FormControl>{children({ field })}</FormControl>
          {description && (
            <p className="text-xs text-muted-foreground">{description}</p>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  )
}
