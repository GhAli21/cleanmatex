/* eslint-disable jsdoc/require-jsdoc */
/**
 * CmxForm - Form shell with React Hook Form + Zod
 * @module ui/forms
 */

'use client'

import { FormProvider, type FieldErrors, type FieldValues, type UseFormReturn } from 'react-hook-form'
import { useId, useMemo, type ReactNode } from 'react'
import { CmxFormStatusBanner } from './cmx-form-status-banner'

export type CmxFormLayout = 'stacked' | 'twoColumn' | 'autoFit'
export type CmxFormDensity = 'compact' | 'comfortable' | 'spacious'
export type CmxFormTone = 'default' | 'strong'

interface ErrorEntry {
  name: string
  message: string
}

function collectErrorEntries(errors: FieldErrors<FieldValues>, prefix = ''): ErrorEntry[] {
  return Object.entries(errors).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key

    if (!value || typeof value !== 'object') {
      return []
    }

    if ('message' in value && typeof value.message === 'string') {
      return [{ name: path, message: value.message }]
    }

    return collectErrorEntries(value as FieldErrors<FieldValues>, path)
  })
}

function focusField(name: string) {
  if (typeof document === 'undefined') {
    return
  }

  const target =
    document.querySelector<HTMLElement>(`[name="${name}"]`) ??
    document.querySelector<HTMLElement>(`[data-cmx-field-name="${name}"] [data-cmx-select-trigger]`) ??
    document.querySelector<HTMLElement>(`[data-cmx-field-name="${name}"] input, [data-cmx-field-name="${name}"] textarea, [data-cmx-field-name="${name}"] button`)

  if (!target) {
    return
  }

  target.scrollIntoView({ behavior: 'smooth', block: 'center' })

  if ('focus' in target) {
    window.setTimeout(() => target.focus(), 120)
  }
}

interface CmxFormProps<TFieldValues extends FieldValues = FieldValues> {
  form: UseFormReturn<TFieldValues>
  onSubmit: (values: TFieldValues) => void | Promise<void>
  children: ReactNode
  className?: string
  layout?: CmxFormLayout
  density?: CmxFormDensity
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full'
  isPending?: boolean
  isDirty?: boolean
  stickyActions?: boolean
  showErrorSummary?: boolean
  tone?: CmxFormTone
  errorSummaryTitle?: string
}

/**
 * Form shell centralizes spacing, density, error recovery, and progressive
 * states so feature screens can focus on workflow specifics instead of layout glue.
 *
 * @param root0 Form shell props.
 * @param root0.form React Hook Form instance.
 * @param root0.onSubmit Submit handler invoked with validated values.
 * @param root0.children Form body content.
 * @param root0.className Optional form className.
 * @param root0.layout Top-level layout strategy for the form body.
 * @param root0.density Density flag exposed via data attributes.
 * @param root0.maxWidth Optional max-width wrapper size.
 * @param root0.isPending Whether the form is currently pending.
 * @param root0.isDirty Whether the form currently has unsaved changes.
 * @param root0.stickyActions Whether extra bottom padding is reserved for sticky actions.
 * @param root0.showErrorSummary Whether a top validation summary is shown.
 * @param root0.tone Visual emphasis flag exposed via data attributes.
 * @param root0.errorSummaryTitle Title used by the summary banner.
 * @returns Shared form shell with RHF context.
 */
export function CmxForm<TFieldValues extends FieldValues = FieldValues>({
  form,
  onSubmit,
  children,
  className,
  layout = 'stacked',
  density = 'comfortable',
  maxWidth = 'full',
  isPending = false,
  isDirty,
  stickyActions = false,
  showErrorSummary = false,
  tone = 'default',
  errorSummaryTitle = 'Please review the highlighted fields.',
}: CmxFormProps<TFieldValues>) {
  const formId = useId()
  const errorEntries = useMemo(
    () => collectErrorEntries(form.formState.errors as FieldErrors<FieldValues>),
    [form.formState.errors]
  )

  const maxWidthClass = {
    sm: 'max-w-xl',
    md: 'max-w-2xl',
    lg: 'max-w-3xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-5xl',
    '3xl': 'max-w-6xl',
    '4xl': 'max-w-7xl',
    full: 'max-w-none',
  }[maxWidth]

  const layoutClass = {
    stacked: 'space-y-5',
    twoColumn: 'grid gap-5 md:grid-cols-2',
    autoFit: 'grid gap-5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr))]',
  }[layout]

  return (
    <FormProvider {...form}>
      <div className={maxWidth !== 'full' ? `mx-auto ${maxWidthClass}` : undefined}>
        <form
          id={formId}
          onSubmit={form.handleSubmit(onSubmit, () => {
            const firstError = collectErrorEntries(form.formState.errors as FieldErrors<FieldValues>)[0]
            if (firstError) {
              focusField(firstError.name)
            }
          })}
          className={[
            layoutClass,
            className ?? '',
            stickyActions ? 'pb-28' : '',
          ].join(' ').trim()}
          data-density={density}
          data-tone={tone}
          data-dirty={isDirty ? '' : undefined}
          aria-busy={isPending}
          noValidate
        >
          {showErrorSummary && errorEntries.length > 0 ? (
            <CmxFormStatusBanner
              type="error"
              title={errorSummaryTitle}
              items={errorEntries.map((entry) => entry.message)}
              className={layout === 'stacked' ? '' : 'md:col-span-full'
              }
            />
          ) : null}
          {children}
        </form>
      </div>
    </FormProvider>
  )
}
